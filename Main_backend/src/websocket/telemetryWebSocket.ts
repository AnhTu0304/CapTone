import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserModel } from '../models/user.model';
import { expandRoles } from '../middlewares/rbac.middleware';
import { TelemetryController } from '../controllers/telemetry.controller';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { WsTicketService } from '../services/wsTicket.service';
import { HealingActionModel } from '../models/healingAction.model';
import { pool } from '../config/database';
import { runWithDbContext, runWithTenantContext } from '../config/dbContext';
import { sanitizeForLog } from '../utils/logSanitizer';

interface AuthenticatedUiWebSocket extends WebSocket {
  user?: {
    id: string;
    roles: string[];
    isPrivileged: boolean;
    isSystemAdmin: boolean;
    allowedOrgIds: string[];
    privilegedOrgIds: string[];
  };
  clusterId?: string;
  organizationId?: string;
  serviceId?: string;
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
    raw_metrics: [],
    logs: [],
    events: [],
    incidents: [],
    recommendations: [],
    predictions: [],
  };
}

export function initTelemetryWebSocket(server: HttpServer): WebSocketServer {
  const uiWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const pathname = parsedUrl?.pathname || '';

    if (pathname === '/api/v1/telemetry/ws') {
      try {
        // 1. Ưu tiên xác thực bằng single-use ticket; cấm truyền JWT qua URL query ở production
        const queryTicket = parsedUrl?.query?.ticket as string | undefined;
        const queryToken = !config.isProduction ? (parsedUrl?.query?.token as string | undefined) : undefined;
        const headerToken =
          (request.headers['sec-websocket-protocol'] as string | undefined) ||
          (request.headers['authorization']?.replace(/^Bearer\s+/i, '') as string | undefined);

        let userId: string | null = null;
        if (queryTicket) {
          userId = await WsTicketService.consumeTicket(queryTicket);
          if (!userId) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
        } else {
          const token = queryToken || headerToken;
          let decoded: any = null;
          if (token) {
            try {
              decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
            } catch {
              decoded = null;
            }
          }

          // Kiểm tra Token Revocation (Fail-Closed ở production)
          if (token && decoded && decoded.id) {
            try {
              const isRevoked = await SessionRevocationService.isTokenRevoked(token);
              if (isRevoked) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
              }
            } catch {
              socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
              socket.destroy();
              return;
            }
            userId = decoded.id;
          }
        }

        let dbUser: any = null;
        if (userId) {
          dbUser = await UserModel.findAuthStatus(userId);
        }

        if (!dbUser || dbUser.status === 'SUSPENDED' || dbUser.status === 'INACTIVE' || dbUser.deleted_at) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Không bao giờ fallback sang SUPER_ADMIN nếu roles không phải mảng hợp lệ
        if (!Array.isArray(dbUser.roles)) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        const roles = dbUser.roles.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean);
        const expanded = expandRoles(roles);
        const isSystemAdmin = expanded.some((r) =>
          ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(r)
        );

        // Lấy danh sách tổ chức ACTIVE và vai trò tổ chức của user dưới ngữ cảnh AUTH
        const memberRes = await runWithDbContext({ scope: 'AUTH', userId: dbUser.id }, () =>
          pool.query(
            `SELECT om.organization_id, r.code AS role_code
             FROM organization_members om
             JOIN organization_roles r ON om.role_id = r.id
             WHERE om.user_id = $1 AND om.status = 'ACTIVE'`,
            [dbUser.id]
          )
        );
        const allowedOrgIds: string[] = memberRes.rows.map((row: any) => row.organization_id);
        const privilegedOrgIds: string[] = memberRes.rows
          .filter((row: any) =>
            ['DEVOPS', 'SME_OWNER', 'ADMIN'].includes(String(row.role_code || '').toUpperCase())
          )
          .map((row: any) => row.organization_id);
        const isPrivileged = false;

        uiWss.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedUiWebSocket;
          authWs.user = {
            id: dbUser.id,
            roles,
            isPrivileged,
            isSystemAdmin,
            allowedOrgIds,
            privilegedOrgIds,
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
    const parsedUrl = request.url ? url.parse(request.url, true) : null;
    const serviceId = (parsedUrl?.query?.service_id as string) || 'sme-order-service';
    const clusterId = (parsedUrl?.query?.cluster_id as string) || undefined;
    const rawOrgId = (parsedUrl?.query?.organization_id as string) || '';
    const requestedOrgId = rawOrgId.trim();
    const allowedOrgIds = ws.user?.allowedOrgIds ?? [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Decision 2.2: Mọi người dùng (bao gồm SUPER_ADMIN / ADMIN) đều phải thuộc tổ chức ACTIVE và cung cấp organization_id hợp lệ
    if (allowedOrgIds.length === 0) {
      ws.close(4003, 'Từ chối truy cập: Bạn chưa thuộc tổ chức nào');
      return;
    }
    if (!requestedOrgId || requestedOrgId.toUpperCase() === 'ALL' || !uuidRegex.test(requestedOrgId)) {
      ws.close(4003, 'Từ chối truy cập: Thiếu hoặc không hợp lệ organization_id cho kết nối WebSocket');
      return;
    }
    if (!allowedOrgIds.includes(requestedOrgId)) {
      ws.close(4003, 'Từ chối truy cập: Bạn không thuộc tổ chức được yêu cầu');
      return;
    }
    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      const clusterInfo = await runWithTenantContext(requestedOrgId, ws.user?.id || null, () =>
        HealingActionModel.validateClusterBelongsToOrg(clusterId, requestedOrgId)
      );
      if (!clusterInfo || clusterInfo.organization_id !== requestedOrgId) {
        ws.close(4003, 'Từ chối truy cập: Cụm Kubernetes không thuộc tổ chức được yêu cầu');
        return;
      }
    }
    if (serviceId && serviceId !== 'sme-order-service') {
      try {
        const svcRes = await runWithTenantContext(requestedOrgId, ws.user?.id || null, () =>
          pool.query(
            `SELECT e.organization_id, c.id AS cluster_id
             FROM services s
             JOIN clusters c ON s.cluster_id = c.id
             JOIN environments e ON c.environment_id = e.id
             WHERE s.id::text = $1 OR s.name = $1`,
            [serviceId]
          )
        );
        if (svcRes.rows.length > 0) {
          const matchesOrg = svcRes.rows.some((r: any) => r.organization_id === requestedOrgId);
          if (!matchesOrg) {
            ws.close(4003, 'Từ chối truy cập: Service không thuộc tổ chức được yêu cầu');
            return;
          }
          if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
            const matchesCluster = svcRes.rows.some(
              (r: any) => r.organization_id === requestedOrgId && r.cluster_id === clusterId
            );
            if (!matchesCluster) {
              ws.close(4003, 'Từ chối truy cập: Service không thuộc cụm Kubernetes đã chọn');
              return;
            }
          }
        }
      } catch {
        ws.close(4003, 'Không thể xác minh quyền sở hữu Service');
        return;
      }
    }

    if (ws.user) {
      ws.user.isPrivileged = (ws.user.privilegedOrgIds || []).includes(requestedOrgId);
    }
    ws.clusterId = clusterId;
    ws.organizationId = requestedOrgId;
    ws.serviceId = serviceId;
    uiClients.add(ws);
    console.log(
      `🖥️ [UI WebSocket] Frontend client connected! (User: ${ws.user?.id}, Org: ${ws.organizationId || 'GLOBAL'}, Privileged: ${ws.user?.isPrivileged}). Active listeners: ${uiClients.size}`
    );

    const isPrivileged = ws.user?.isPrivileged ?? false;

    // Send immediate initial state upon connection under verified TENANT context
    try {
      const summary = await runWithTenantContext(ws.organizationId, ws.user?.id || null, () =>
        TelemetryController.getLiveSummaryData(serviceId, clusterId, ws.organizationId)
      );
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
      // Also push immediate batch_accumulation state so the 12-step chart updates right away
      TelemetryPipelineService.processServiceBatch(serviceId, ws.organizationId, clusterId).catch(() => {});
    } catch (err) {
      console.error('[UI WebSocket] Error sending initial state:', err);
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.organization_id !== undefined || msg.cluster_id !== undefined) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'SCOPE_IMMUTABLE',
                message: 'Không thể thay đổi ngữ cảnh tổ chức hoặc cụm trên kết nối WebSocket hiện tại',
                timestamp: new Date().toISOString(),
              })
            );
          }
          return;
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } else if (msg.type === 'request_refresh') {
          // Luôn dùng scope bất biến đã xác thực lúc kết nối, không tin payload từ client
          const summary = await runWithTenantContext(ws.organizationId!, ws.user?.id || null, () =>
            TelemetryController.getLiveSummaryData(
              ws.serviceId || 'sme-order-service',
              ws.clusterId,
              ws.organizationId
            )
          );
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
      console.error('[UI WebSocket] Connection error:', sanitizeForLog(err));
      uiClients.delete(ws);
    });
  });

  // Heartbeat pulse every 3 seconds to push real-time sequence updates to connected UI clients
  const pulseInterval = setInterval(async () => {
    if (uiClients.size === 0) return;
    try {
      for (const client of uiClients) {
        if (client.readyState === WebSocket.OPEN && client.organizationId) {
          const cClusterId = client.clusterId;
          const cServiceId = client.serviceId || 'sme-order-service';
          const cOrgId = client.organizationId;
          const summary = await runWithTenantContext(cOrgId, client.user?.id || null, () =>
            TelemetryController.getLiveSummaryData(cServiceId, cClusterId, cOrgId)
          );
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
 * Broadcast telemetry events to active Frontend UI clients with strict role & tenant filtering
 */
export async function broadcastTelemetryToUi(payload: any) {
  if (uiClients.size === 0) return;
  const isRestricted = payload && payload.type && RESTRICTED_BROADCAST_TYPES.has(payload.type);

  const claimedOrgId: string | undefined = payload?.organization_id || payload?.data?.organization_id;
  const payloadClusterId: string | undefined = payload?.cluster_id || payload?.data?.cluster_id;

  let resolvedOrgId: string | undefined = claimedOrgId;
  if (payloadClusterId) {
    try {
      const clusterInfo = await HealingActionModel.validateClusterBelongsToOrg(payloadClusterId);
      if (clusterInfo?.organization_id) {
        // WS-12: Nếu payload khai báo organization_id mâu thuẫn với cluster thực tế -> hủy broadcast
        if (claimedOrgId && claimedOrgId !== clusterInfo.organization_id) {
          console.warn(`[TelemetryWS] Dropped inconsistent broadcast: claimed org=${claimedOrgId}, cluster org=${clusterInfo.organization_id}`);
          return;
        }
        resolvedOrgId = clusterInfo.organization_id;
      }
    } catch {
      return;
    }
  }

  const message = JSON.stringify(payload);

  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      // Viewer/User clients are prohibited from receiving sensitive RCA/AI/Logs/Events
      if (isRestricted && !client.user?.isPrivileged) {
        continue;
      }
      // WS-11 & A-C02 & Decision 2.2: Tất cả client (kể cả SUPER_ADMIN) chỉ nhận dữ liệu của tổ chức có quyền và đang bind
      if (
        !resolvedOrgId ||
        !client.user?.allowedOrgIds?.includes(resolvedOrgId) ||
        client.organizationId !== resolvedOrgId
      ) {
        continue;
      }
      client.send(message);
    }
  }
}

/**
 * Immediately close active WebSocket connections for a user upon session revocation,
 * password change/reset, or account suspension.
 */
export function disconnectUserTelemetrySessions(userId: string): number {
  let closed = 0;
  for (const client of uiClients) {
    if (client.user?.id === userId) {
      try {
        client.close(4001, 'Session Revoked');
      } catch {
        client.terminate();
      }
      uiClients.delete(client);
      closed++;
    }
  }
  return closed;
}
