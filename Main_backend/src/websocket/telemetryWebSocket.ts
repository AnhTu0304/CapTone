import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserModel } from '../models/user.model';
import { expandRoles } from '../middlewares/rbac.middleware';
import { TelemetryController } from '../controllers/telemetry.controller';

interface AuthenticatedUiWebSocket extends WebSocket {
  user?: {
    id: string;
    roles: string[];
    isPrivileged: boolean;
  };
}

const uiClients = new Set<AuthenticatedUiWebSocket>();

const RESTRICTED_BROADCAST_TYPES = new Set([
  'log',
  'logs',
  'event',
  'events',
]);

function sanitizeSummaryForViewer(summary: any) {
  if (!summary) return summary;
  return {
    ...summary,
    raw_metrics: summary.raw_metrics || [],
    logs: [],
    events: [],
    incidents: summary.incidents || [],
    recommendations: summary.recommendations || [],
    predictions: summary.predictions || [],
  };
}

export function initTelemetryWebSocket(server: HttpServer): WebSocketServer {
  const uiWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const pathname = parsedUrl?.pathname || '';

    if (pathname === '/api/v1/telemetry/ws') {
      try {
        // 1. Trích xuất token từ query param hoặc header
        const queryToken = parsedUrl?.query?.token as string | undefined;
        const headerToken =
          (request.headers['sec-websocket-protocol'] as string | undefined) ||
          (request.headers['authorization']?.replace(/^Bearer\s+/i, '') as string | undefined);

        const token = queryToken || headerToken;
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // 2. Xác thực JWT Token
        let decoded: any;
        try {
          decoded = jwt.verify(token, config.jwt.secret);
        } catch {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        if (!decoded || !decoded.id) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // 3. Kiểm tra trạng thái thực tế và vai trò trong CSDL để chống stale token & account lock
        const dbUser = await UserModel.findAuthStatus(decoded.id);
        if (!dbUser || dbUser.status === 'SUSPENDED' || dbUser.deleted_at) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        const roles = Array.isArray(dbUser.roles) ? dbUser.roles : [];
        const expanded = expandRoles(roles);
        const isPrivileged = expanded.some((r) =>
          ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'DEVOPS'].includes(r)
        );

        uiWss.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedUiWebSocket;
          authWs.user = {
            id: dbUser.id,
            roles,
            isPrivileged,
          };
          uiWss.emit('connection', authWs, request);
        });
      } catch (err) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    }
  });

  uiWss.on('connection', async (ws: AuthenticatedUiWebSocket, request) => {
    uiClients.add(ws);
    console.log(
      `🖥️ [UI WebSocket] Frontend client connected! (User: ${ws.user?.id}, Privileged: ${ws.user?.isPrivileged}). Active listeners: ${uiClients.size}`
    );

    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const serviceId = (parsedUrl?.query?.service_id as string) || 'sme-order-service';
    const clusterId = (parsedUrl?.query?.cluster_id as string) || undefined;
    (ws as any).clusterId = clusterId;
    (ws as any).serviceId = serviceId;
    const isPrivileged = ws.user?.isPrivileged ?? false;

    // Send immediate initial state upon connection
    try {
      const summary = await TelemetryController.getLiveSummaryData(serviceId, clusterId);
      const dataToSend = isPrivileged ? summary : sanitizeSummaryForViewer(summary);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'initial_state',
            data: dataToSend,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      console.error('[UI WebSocket] Error sending initial state:', err);
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } else if (msg.type === 'request_refresh') {
          const summary = await TelemetryController.getLiveSummaryData(serviceId);
          const dataToSend = isPrivileged ? summary : sanitizeSummaryForViewer(summary);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'live_summary',
                data: dataToSend,
                timestamp: new Date().toISOString(),
              })
            );
          }
        }
      } catch (e) {
        // Ignore non-json
      }
    });

    ws.on('close', () => {
      uiClients.delete(ws);
      console.log(`🔌 [UI WebSocket] Frontend client disconnected. Remaining listeners: ${uiClients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[UI WebSocket] Connection error:', err);
      uiClients.delete(ws);
    });
  });

  // Heartbeat pulse every 3 seconds to push real-time sequence updates to connected UI clients
  const pulseInterval = setInterval(async () => {
    if (uiClients.size === 0) return;
    try {
      for (const client of uiClients) {
        if (client.readyState === WebSocket.OPEN) {
          const cClusterId = (client as any).clusterId;
          const cServiceId = (client as any).serviceId || 'sme-order-service';
          const summary = await TelemetryController.getLiveSummaryData(cServiceId, cClusterId);
          const payload = JSON.stringify({
            type: 'live_pulse',
            data: client.user?.isPrivileged ? summary : sanitizeSummaryForViewer(summary),
            timestamp: new Date().toISOString(),
          });
          client.send(payload);
        }
      }
    } catch (err) {
      // Don't crash pulse loop
    }
  }, 3000);

  uiWss.on('close', () => {
    clearInterval(pulseInterval);
  });

  console.log('📡 UI Telemetry WebSocket endpoint initialized at WS /api/v1/telemetry/ws');
  return uiWss;
}

/**
 * Broadcast telemetry events to active Frontend UI clients with strict role-filtering
 */
export function broadcastTelemetryToUi(payload: any) {
  if (uiClients.size === 0) return;
  const isRestricted = payload && payload.type && RESTRICTED_BROADCAST_TYPES.has(payload.type);
  const message = JSON.stringify(payload);

  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      // Viewer/User clients are prohibited from receiving sensitive RCA/AI/Logs/Events
      if (isRestricted && !client.user?.isPrivileged) {
        continue;
      }
      client.send(message);
    }
  }
}
