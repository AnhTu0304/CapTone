import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { AgentService, AuthenticatedAgent } from '../services/agent.service';
import { AgentWsMessageSchema } from '../schemas/agentWebSocket.schema';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  agent?: AuthenticatedAgent;
}

export function initAgentWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
  });

  // Handle HTTP Upgrade request for WS /api/v1/agent/connect
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? url.parse(request.url).pathname : '';

    if (pathname === '/api/v1/agent/connect') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws: ExtWebSocket, request) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Extract token from query params or headers
    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const queryToken = parsedUrl?.query?.token as string | undefined;
    const headerToken =
      (request.headers['x-agent-token'] as string) ||
      (request.headers['authorization']?.replace(/^Bearer\s+/i, '') as string | undefined);

    const token = queryToken || headerToken;

    if (token) {
      const agent = await AgentService.authenticateAgent(token);
      if (!agent) {
        ws.send(
          JSON.stringify({
            status: 'error',
            message: 'Unauthorized: Invalid, expired, or revoked agent token',
          })
        );
        ws.close(4001, 'Unauthorized');
        return;
      }

      ws.agent = agent;
      console.log(`🤖 Agent connected and authenticated: [${agent.name}] (UID: ${agent.agent_uid})`);

      ws.send(
        JSON.stringify({
          status: 'authenticated',
          message: 'Agent authenticated successfully',
          agent: {
            id: agent.id,
            name: agent.name,
            agent_uid: agent.agent_uid,
            cluster_id: agent.cluster_id,
            environment_id: agent.environment_id,
          },
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      // Grace period: allow 5 seconds for initial auth message
      const authTimeout = setTimeout(() => {
        if (!ws.agent) {
          ws.send(
            JSON.stringify({
              status: 'error',
              message: 'Authentication timeout: Missing agent token',
            })
          );
          ws.close(4001, 'Auth Timeout');
        }
      }, 5000);

      ws.on('close', () => clearTimeout(authTimeout));
    }

    // Message handler
    ws.on('message', async (rawMessage) => {
      try {
        const text = rawMessage.toString();
        let jsonPayload: unknown;

        try {
          jsonPayload = JSON.parse(text);
        } catch {
          ws.send(
            JSON.stringify({
              status: 'error',
              message: 'Malformed JSON payload',
            })
          );
          return;
        }

        // Validate message with Zod schema
        const parseResult = AgentWsMessageSchema.safeParse(jsonPayload);
        if (!parseResult.success) {
          ws.send(
            JSON.stringify({
              status: 'error',
              message: 'Validation failed: Invalid message structure',
              errors: parseResult.error.format(),
            })
          );
          return;
        }

        const msg = parseResult.data;

        // Handle first-message auth if not authenticated via URL
        if (msg.type === 'auth') {
          const agent = await AgentService.authenticateAgent(msg.token);
          if (!agent) {
            ws.send(
              JSON.stringify({
                status: 'error',
                message: 'Unauthorized: Invalid agent token',
              })
            );
            ws.close(4001, 'Unauthorized');
            return;
          }
          ws.agent = agent;
          ws.send(
            JSON.stringify({
              status: 'authenticated',
              message: 'Agent authenticated successfully via message',
              agent: { id: agent.id, name: agent.name },
            })
          );
          return;
        }

        // Require authenticated agent for data messages
        if (!ws.agent) {
          ws.send(
            JSON.stringify({
              status: 'error',
              message: 'Unauthorized: Connection not authenticated yet',
            })
          );
          return;
        }

        // Dispatch based on message type
        switch (msg.type) {
          case 'metrics': {
            const saved = await AgentService.storeMetrics(ws.agent, msg.data);
            ws.send(
              JSON.stringify({
                status: 'ack',
                type: 'metrics',
                record_id: saved.id,
                service_id: msg.data.service_id,
                timestamp: new Date().toISOString(),
              })
            );
            break;
          }

          case 'log': {
            const saved = await AgentService.storeLog(ws.agent, msg.data);
            ws.send(
              JSON.stringify({
                status: 'ack',
                type: 'log',
                record_id: saved.id,
                service_id: msg.data.service_id,
                timestamp: new Date().toISOString(),
              })
            );
            break;
          }

          case 'k8s_event': {
            const saved = await AgentService.storeK8sEvent(ws.agent, msg.data);
            ws.send(
              JSON.stringify({
                status: 'ack',
                type: 'k8s_event',
                record_id: saved.id,
                service_id: msg.data.service_id,
                timestamp: new Date().toISOString(),
              })
            );
            break;
          }

          default: {
            ws.send(
              JSON.stringify({
                status: 'error',
                message: 'Unsupported message type',
              })
            );
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message from agent:', err);
        // Do not crash server, send safe error feedback
        ws.send(
          JSON.stringify({
            status: 'error',
            message: `Internal processing error: ${(err as Error).message}`,
          })
        );
      }
    });

    ws.on('close', async (code, reason) => {
      if (ws.agent) {
        console.log(`🔌 Agent disconnected: [${ws.agent.name}] (Code: ${code}, Reason: ${reason})`);
        await AgentService.setAgentOffline(ws.agent.id);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket connection error:', err);
    });
  });

  // Heartbeat ping interval to detect stale/dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const extWs = client as ExtWebSocket;
      if (!extWs.isAlive) {
        if (extWs.agent) {
          AgentService.setAgentOffline(extWs.agent.id);
        }
        return client.terminate();
      }
      extWs.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('📡 Agent WebSocket endpoint initialized at WS /api/v1/agent/connect');
  return wss;
}
