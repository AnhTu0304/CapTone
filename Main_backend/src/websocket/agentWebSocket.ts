import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { pool } from '../config/database';
import { AgentService, AuthenticatedAgent } from '../services/agent.service';
import { AgentWsMessageSchema } from '../schemas/agentWebSocket.schema';
import { broadcastTelemetryToUi } from './telemetryWebSocket';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';

let activeAgentWss: WebSocketServer | null = null;
const lastKnownRestartsByService: Record<string, number> = {};

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  agent?: AuthenticatedAgent;
}

export function initAgentWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
  });
  activeAgentWss = wss;

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
            console.log(`📊 [REALTIME METRICS] [${ws.agent.name}] Service: ${msg.data.service_id} | Pod: ${msg.data.pod_id || "all"} | CPU: ${msg.data.cpu}% | RAM: ${msg.data.ram}MB | Req: ${msg.data.request_rate}/s | Latency: ${msg.data.latency}ms`);
            
            broadcastTelemetryToUi({
              type: 'metrics',
              data: {
                ...msg.data,
                id: saved.id,
                timestamp: new Date().toISOString(),
              }
            });

            // GOM CÁI NÀO GỬI CÁI ĐÓ LUÔN: Ngay khi có 1 metric mới của service này, gom và phát ngay lập tức (không đợi service khác)
            TelemetryPipelineService.processServiceBatch(msg.data.service_id).catch((err) => {
              console.error(`[agentWebSocket] Error processing batch on metric for ${msg.data.service_id}:`, err);
            });

            // Only trigger on pod restarts if restart count actually INCREASED
            const prevRestarts = lastKnownRestartsByService[msg.data.service_id];
            const hasNewRestart = prevRestarts !== undefined && msg.data.pod_restart_count > prevRestarts;
            lastKnownRestartsByService[msg.data.service_id] = msg.data.pod_restart_count;

            // Trigger urgent AI diagnosis if metrics exceed anomaly thresholds
            if (
              msg.data.cpu >= 70 ||
              msg.data.http_5xx_rate >= 10 ||
              hasNewRestart ||
              msg.data.latency >= 1500
            ) {
              TelemetryPipelineService.triggerUrgentEvaluation(
                msg.data.service_id,
                `Metrics breached anomaly threshold (CPU: ${msg.data.cpu}%, 5xx: ${msg.data.http_5xx_rate}%, New Restarts: +${hasNewRestart ? 1 : 0})`
              );
            }

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
            console.log(`📝 [REALTIME LOG] [${ws.agent.name}] [${msg.data.level}] ${msg.data.message.slice(0, 110)}`);
            
            broadcastTelemetryToUi({
              type: 'log',
              data: {
                ...msg.data,
                id: saved.id,
                occurred_at: new Date().toISOString(),
              }
            });

            // Check if log indicates an error / crash / OOM
            const upperLevel = msg.data.level.toUpperCase();
            const isErrorLog = ['ERROR', 'FATAL', 'CRITICAL'].includes(upperLevel);
            const hasErrorKeywords = /(exception|timeout|oom|crash|connection error|killed|deadlock|fail)/i.test(msg.data.message);

            if (isErrorLog || hasErrorKeywords) {
              TelemetryPipelineService.triggerUrgentEvaluation(
                msg.data.service_id,
                `Error log: ${msg.data.message.slice(0, 70)}`
              );
            }

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
            console.log(`⚡ [REALTIME EVENT] [${ws.agent.name}] [${msg.data.event.type}] ${msg.data.event.reason}: ${msg.data.event.message.slice(0, 110)}`);
            
            broadcastTelemetryToUi({
              type: 'k8s_event',
              data: {
                ...msg.data,
                id: saved.id,
                last_seen_at: new Date().toISOString(),
              }
            });

            // Check if event is warning or pod failure
            if (
              msg.data.event.type === 'Warning' ||
              /(oomkilled|backoff|killing|failed|unhealthy)/i.test(msg.data.event.reason)
            ) {
              TelemetryPipelineService.triggerUrgentEvaluation(
                msg.data.service_id,
                `K8s Warning Event: ${msg.data.event.reason} - ${msg.data.event.message.slice(0, 70)}`
              );
            }

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

          case 'k8s_inventory': {
            const syncResult = await AgentService.syncClusterInventory(ws.agent, msg.data);
            console.log(`📦 [REALTIME INVENTORY] [${ws.agent.name}] Synced ${syncResult.synced_nodes} Nodes, ${syncResult.synced_pods} Pods`);

            broadcastTelemetryToUi({
              type: 'cluster_inventory_sync',
              data: {
                cluster_id: ws.agent.cluster_id,
                nodes_count: syncResult.synced_nodes,
                pods_count: syncResult.synced_pods,
                timestamp: new Date().toISOString(),
              },
            });

            ws.send(
              JSON.stringify({
                status: 'ack',
                type: 'k8s_inventory',
                synced_nodes: syncResult.synced_nodes,
                synced_pods: syncResult.synced_pods,
                timestamp: new Date().toISOString(),
              })
            );
            break;
          }

          case 'action_result': {
            const { action_id, status, message, duration_ms, details } = msg.data;
            console.log(`🎯 [AGENT ACTION RESULT] [${ws.agent.name}] Action: ${action_id} | Status: ${status} | Msg: ${message}`);

            try {
              // 1. Update healing_actions execution_status
              const actRes = await pool.query(
                `UPDATE healing_actions 
                 SET execution_status = $2, 
                     completed_at = NOW(),
                     result = $3::jsonb
                 WHERE id = $1
                 RETURNING incident_id, recommendation_id, target_name;`,
                [
                  action_id,
                  status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
                  JSON.stringify({
                    status,
                    message,
                    duration_ms,
                    executed_by_agent: ws.agent.name,
                    completed_at: new Date().toISOString(),
                    details,
                  }),
                ]
              );

              const row = actRes.rows[0];

              // 2. Insert execution attempt
              await pool.query(
                `INSERT INTO execution_attempts (
                  healing_action_id, attempt_number, command_type,
                  request_payload, response_payload, status,
                  started_at, completed_at, duration_ms
                ) VALUES (
                  $1, 1, 'K8S_AGENT_REMEDIATION',
                  $2::jsonb, $3::jsonb, $4::execution_status,
                  NOW() - interval '1 second', NOW(), $5
                );`,
                [
                  action_id,
                  JSON.stringify({ target: row?.target_name, agent: ws.agent.name }),
                  JSON.stringify({ message, details }),
                  status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
                  duration_ms || 1000,
                ]
              );

              // 3. Insert recovery verification if succeeded
              if (status === 'SUCCEEDED') {
                await pool.query(
                  `INSERT INTO recovery_verifications (
                    healing_action_id, verification_type,
                    status_before, status_after,
                    verification_result, verification_details,
                    verified_at, duration_ms
                  ) VALUES (
                    $1, 'K8S_POST_HEALING_PROBE',
                    $2::jsonb, $3::jsonb,
                    true, $4::jsonb,
                    NOW(), 500
                  );`,
                  [
                    action_id,
                    JSON.stringify({ health: 'DEGRADED' }),
                    JSON.stringify({ health: 'HEALTHY' }),
                    JSON.stringify({ status: 'RESTORED', message: 'Tác vụ tự lành thành công trên K8s Agent' }),
                  ]
                );

                // Auto-resolve incident
                if (row?.incident_id) {
                  await pool.query(
                    `UPDATE incidents SET status = 'RESOLVED', updated_at = NOW() WHERE id = $1;`,
                    [row.incident_id]
                  );
                }

                // Mark recommendation applied
                if (row?.recommendation_id) {
                  await pool.query(
                    `UPDATE ai_recommendations SET status = 'APPLIED' WHERE id = $1;`,
                    [row.recommendation_id]
                  );
                }
              }

              // Broadcast live event to UI
              broadcastTelemetryToUi({
                type: 'healing_action_completed',
                data: {
                  action_id,
                  status,
                  message,
                  agent: ws.agent.name,
                  incident_id: row?.incident_id,
                  timestamp: new Date().toISOString(),
                },
              });

              ws.send(
                JSON.stringify({
                  status: 'ack',
                  type: 'action_result',
                  action_id,
                  timestamp: new Date().toISOString(),
                })
              );
            } catch (actErr) {
              console.error('Error persisting action_result from agent:', actErr);
            }
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

/**
 * Ngắt ngay lập tức phiên WebSocket của Agent khi Token bị thu hồi hoặc xoay vòng
 */
export function disconnectAgentSession(agentId: string): void {
  if (!activeAgentWss) return;
  activeAgentWss.clients.forEach((client) => {
    const extWs = client as ExtWebSocket;
    if (extWs.agent && extWs.agent.id === agentId) {
      console.log(`🔒 Force-disconnecting revoked agent [${extWs.agent.name}] (ID: ${agentId})`);
      try {
        extWs.send(
          JSON.stringify({
            status: 'error',
            message: 'Unauthorized: Agent token has been revoked or rotated. Connection terminated.',
          })
        );
        extWs.close(4001, 'Token Revoked');
      } catch (err) {
        extWs.terminate();
      }
    }
  });
}

/**
 * Dispatch lệnh tự phục hồi (Self-Healing Action) xuống Agent Kubernetes đang kết nối
 */
export async function dispatchHealingActionToAgent(payload: {
  action_id: string;
  action_type: string;
  target_name: string;
  namespace?: string;
  params?: any;
  cluster_id?: string;
  environment_id?: string;
}): Promise<{ dispatched: boolean; recipient_agent?: string }> {
  if (!activeAgentWss || activeAgentWss.clients.size === 0) {
    console.warn(`[AgentWebSocket] No connected agents available to receive action '${payload.action_type}' for target '${payload.target_name}'.`);
    return { dispatched: false };
  }

  let chosenClient: ExtWebSocket | null = null;
  // Tenant-aware agent selection: match specifically by cluster_id or environment_id if provided
  for (const client of activeAgentWss.clients) {
    const extWs = client as ExtWebSocket;
    if (extWs.isAlive && extWs.agent && extWs.readyState === WebSocket.OPEN) {
      if (payload.cluster_id && extWs.agent.cluster_id === payload.cluster_id) {
        chosenClient = extWs;
        break;
      }
      if (payload.environment_id && extWs.agent.environment_id === payload.environment_id) {
        chosenClient = extWs;
        break;
      }
      if (!chosenClient) {
        chosenClient = extWs;
      }
    }
  }

  if (!chosenClient || !chosenClient.agent) {
    console.warn(`[AgentWebSocket] No authenticated, open agent WebSocket socket found.`);
    return { dispatched: false };
  }

  const agentName = chosenClient.agent.name;
  console.log(`🚀 [AgentWebSocket] Dispatching action '${payload.action_type}' (ID: ${payload.action_id}) to Agent [${agentName}] for target '${payload.target_name}'`);

  try {
    chosenClient.send(
      JSON.stringify({
        type: 'execute_action',
        data: {
          action_id: payload.action_id,
          action_type: payload.action_type,
          target_name: payload.target_name,
          namespace: payload.namespace || 'default',
          params: payload.params || {},
        },
      })
    );
    return { dispatched: true, recipient_agent: agentName };
  } catch (sendErr) {
    console.error(`❌ [AgentWebSocket] Failed transmitting execute_action to agent [${agentName}]:`, sendErr);
    return { dispatched: false, recipient_agent: agentName };
  }
}
