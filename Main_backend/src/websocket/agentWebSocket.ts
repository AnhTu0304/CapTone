import { AuditService } from '../services/audit.service';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import { pool } from '../config/database';
import { runWithTenantContext } from '../config/dbContext';
import { AgentService, AuthenticatedAgent } from '../services/agent.service';
import { AgentWsMessageSchema } from '../schemas/agentWebSocket.schema';
import { broadcastTelemetryToUi } from './telemetryWebSocket';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { CriticalIncidentNotificationService } from '../services/criticalIncidentNotification.service';
import { sanitizeForLog } from '../utils/logSanitizer';
import {
  injectTraceContext,
  recordAgentHeartbeat,
  recordAuthFailure,
  recordRemediationAction,
  recordRemediationDuration,
  withBackendSpan,
} from '../telemetry/metrics';

let activeAgentWss: WebSocketServer | null = null;
const lastKnownRestartsByService: Record<string, number> = {};

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  agent?: AuthenticatedAgent;
  remoteIp?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export function initAgentWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024, // 2 MiB hard frame cap against memory DoS
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
    const rawForwarded = request.headers['x-forwarded-for'];
    const rawIp = Array.isArray(rawForwarded)
      ? rawForwarded[0]
      : (rawForwarded as string | undefined) || request.socket?.remoteAddress || null;
    ws.remoteIp = AuditService.sanitizeIp(rawIp);
    const rawUa = request.headers['user-agent'];
    ws.userAgent = typeof rawUa === 'string' && rawUa.trim() ? rawUa.trim().substring(0, 500) : null;
    const rawReqId = request.headers['x-request-id'];
    ws.requestId = typeof rawReqId === 'string' && rawReqId.trim() ? rawReqId.trim().substring(0, 100) : null;

    ws.on('pong', () => {
      ws.isAlive = true;
      recordAgentHeartbeat('ws', 'success');
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
        recordAuthFailure('agent_token', 'agent_revoked');
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
          recordAuthFailure('agent_token', 'missing_token');
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

        // Handle first-message auth if not authenticated via URL (forbid identity re-binding on authenticated socket)
        if (msg.type === 'auth') {
          if (ws.agent) {
            recordAuthFailure('agent_token', 'invalid_token');
            ws.close(4003, 'Re-authentication on an already authenticated agent session is forbidden');
            return;
          }
          const agent = await AgentService.authenticateAgent(msg.token);
          if (!agent) {
            recordAuthFailure('agent_token', 'agent_revoked');
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

        // Require authenticated agent with valid tenant context for data messages
        if (!ws.agent || !ws.agent.organization_id) {
          ws.send(
            JSON.stringify({
              status: 'error',
              message: 'Unauthorized: Connection not authenticated yet',
            })
          );
          return;
        }

        // Dispatch based on verified agent tenant context
        await runWithTenantContext(ws.agent.organization_id, null, async () => {
        if (!ws.agent) return;
        switch (msg.type) {
          case 'metrics': {
            const saved = await AgentService.storeMetrics(ws.agent, msg.data);
            console.log(`📊 [REALTIME METRICS] [${ws.agent.name}] Service: ${msg.data.service_id} | Pod: ${msg.data.pod_id || "all"} | CPU: ${msg.data.cpu}% | RAM: ${msg.data.ram}MB | Req: ${msg.data.request_rate}/s | Latency: ${msg.data.latency}ms`);
            
            broadcastTelemetryToUi({
              type: 'metrics',
              data: {
                ...msg.data,
                id: saved.id,
                organization_id: ws.agent.organization_id,
                cluster_id: ws.agent.cluster_id,
                timestamp: new Date().toISOString(),
              }
            });

            // GOM CÁI NÀO GỬI CÁI ĐÓ LUÔN: Ngay khi có 1 metric mới của service này, gom và phát ngay lập tức (không đợi service khác)
            TelemetryPipelineService.processServiceBatch(
              msg.data.service_id,
              ws.agent.organization_id,
              ws.agent.cluster_id
            ).catch((err) => {
              console.error(`[agentWebSocket] Error processing batch on metric for ${msg.data.service_id}:`, err);
            });

            // Only trigger on pod restarts if restart count actually INCREASED for this specific pod
            const restartKey = `${msg.data.service_id}:${msg.data.pod_id || 'default'}`;
            const prevRestarts = lastKnownRestartsByService[restartKey];
            const hasNewRestart = prevRestarts !== undefined && msg.data.pod_restart_count > prevRestarts;
            lastKnownRestartsByService[restartKey] = msg.data.pod_restart_count;

            // Trigger urgent AI diagnosis if metrics exceed anomaly thresholds
            if (
              msg.data.cpu >= 70 ||
              msg.data.http_5xx_rate >= 10 ||
              hasNewRestart ||
              msg.data.latency >= 1500
            ) {
              TelemetryPipelineService.triggerUrgentEvaluation(
                msg.data.service_id,
                `Metrics breached anomaly threshold (CPU: ${msg.data.cpu}%, 5xx: ${msg.data.http_5xx_rate}%, New Restarts: +${hasNewRestart ? 1 : 0})`,
                ws.agent.organization_id,
                ws.agent.cluster_id
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

          case 'node_metrics': {
            const saved = await AgentService.storeNodeMetrics(ws.agent, msg.data);
            console.log(
              `🖥️ [NODE METRICS] [${ws.agent.name}] Node: ${msg.data.node_name} | CPU: ${msg.data.cpu_usage_percent}% (${msg.data.cpu_cores} cores) | RAM: ${msg.data.ram_usage_percent}% | Disk: ${msg.data.disk_usage_percent}% | Net RX/TX: ${msg.data.net_rx_bytes_per_sec}/${msg.data.net_tx_bytes_per_sec} B/s`
            );

            broadcastTelemetryToUi({
              type: 'node_metrics',
              data: {
                ...msg.data,
                id: saved.id,
                agent_id: ws.agent.id,
                organization_id: ws.agent.organization_id,
                cluster_id: ws.agent.cluster_id,
                timestamp: new Date().toISOString(),
              },
            });

            ws.send(
              JSON.stringify({
                status: 'ack',
                type: 'node_metrics',
                record_id: saved.id,
                node_name: msg.data.node_name,
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
                organization_id: ws.agent.organization_id,
                cluster_id: ws.agent.cluster_id,
                occurred_at: new Date().toISOString(),
              }
            });

            // Check if log indicates an error / crash / OOM (ignore routine MongoDB JSON info logs)
            const upperLevel = msg.data.level.toUpperCase();
            const isRoutineJsonInfo = msg.data.message.includes('"s":"I"');
            const isErrorLog = !isRoutineJsonInfo && ['ERROR', 'FATAL', 'CRITICAL'].includes(upperLevel);
            const hasErrorKeywords = !isRoutineJsonInfo && /(exception|timeout|oom|crash|connection error|killed|deadlock|fail)/i.test(msg.data.message);

            if (isErrorLog || hasErrorKeywords) {
              TelemetryPipelineService.triggerUrgentEvaluation(
                msg.data.service_id,
                `Error log: ${msg.data.message.slice(0, 70)}`,
                ws.agent.organization_id,
                ws.agent.cluster_id
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
                organization_id: ws.agent.organization_id,
                cluster_id: ws.agent.cluster_id,
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
                `K8s Warning Event: ${msg.data.event.reason} - ${msg.data.event.message.slice(0, 70)}`,
                ws.agent.organization_id,
                ws.agent.cluster_id
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
                organization_id: ws.agent.organization_id,
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
            const { action_id, status, message: rawMessage, duration_ms, details } = msg.data;
            const actionTypeMetric = String(details?.action || 'RESTART_POD').toUpperCase();
            const isCompleted = status === 'COMPLETED' || status === 'SUCCEEDED';
            recordRemediationAction(actionTypeMetric, isCompleted ? 'succeeded' : 'failed');
            recordRemediationDuration(
              actionTypeMetric,
              isCompleted ? 'success' : 'failed',
              Math.max(0.001, Number(duration_ms || 1000) / 1000)
            );

            let message = String(rawMessage || '');
            const targetSvc = details?.target || 'dịch vụ mục tiêu';
            const targetNs = details?.namespace || 'default';
            if (message.includes('[Errno 111] Connection refused') || message.includes('Connection refused')) {
              message = `Lỗi kết nối Kubernetes API Server (10.96.0.1:443): Connection refused. Agent không thể gửi lệnh tới "${targetSvc}" do API Server cụm bị gián đoạn hoặc quá tải.`;
            } else if (message.includes('HTTPHeaderDict') || message.includes('HTTP response body:')) {
              const bodyMatch = message.match(/HTTP response body:\s*(\{[\s\S]*\})/);
              if (bodyMatch) {
                try {
                  const k8sErr = JSON.parse(bodyMatch[1]);
                  message = `Lỗi thực thi K8s (${k8sErr.code || 403} ${k8sErr.reason || 'Error'}): ${k8sErr.message || rawMessage.split('HTTP response headers:')[0].trim()}`;
                } catch {
                  message = message.split('HTTP response headers:')[0].trim();
                }
              } else {
                message = message.split('HTTP response headers:')[0].trim();
              }
            } else if (/scaled successfully to (\d+) replicas/i.test(message)) {
              const rep = message.match(/scaled successfully to (\d+) replicas/i)?.[1] || '2';
              message = `Đã điều chỉnh quy mô (SCALE_REPLICAS) dịch vụ "${targetSvc}" sang ${rep} bản sao (Replicas) thành công tại namespace "${targetNs}".`;
            } else if (/Specific unhealthy pod '([^']+)' terminated and successfully replaced/i.test(message)) {
              const pod = message.match(/Specific unhealthy pod '([^']+)'/i)?.[1] || targetSvc;
              message = `Đã chấm điểm, cô lập và xóa Pod lỗi "${pod}"; ReplicaSet/Controller trong namespace "${targetNs}" đã tự động khởi tạo Pod mới thay thế thành công.`;
            } else if (/Zero-downtime rolling restart patched successfully/i.test(message)) {
              message = `Đã thực thi khởi động lại cuốn chiếu không gián đoạn (Zero-downtime Rolling Restart) thành công cho dịch vụ "${targetSvc}" tại namespace "${targetNs}".`;
            } else if (/Replaced pod via rolling restart/i.test(message)) {
              message = `Đã thay thế Pod lỗi thông qua khởi động lại cuốn chiếu (Rolling Restart) trên dịch vụ "${targetSvc}" tại namespace "${targetNs}".`;
            } else if (/Rollback/i.test(message) && isCompleted) {
              message = `Đã khôi phục (Rollback) dịch vụ "${targetSvc}" về phiên bản ReplicaSet ổn định trước đó tại namespace "${targetNs}".`;
            } else if (/Ephemeral disk cleanup/i.test(message)) {
              message = `Đã dọn dẹp bộ nhớ tạm (emptyDir / Ephemeral Storage) và tái khởi tạo lưu trữ sạch cho dịch vụ "${targetSvc}" tại namespace "${targetNs}".`;
            } else if (/Zero-downtime preserved: System telemetry verified safe/i.test(message)) {
              message = `AI xác nhận chỉ số viễn trắc của "${targetSvc}" đang an toàn, giữ nguyên trạng thái (NO_ACTION) để bảo toàn Zero-downtime.`;
            }
            console.log(`🎯 [AGENT ACTION RESULT] [${ws.agent.name}] Action: ${action_id} | Status: ${status} | Msg: ${message}`);

            const client = await pool.connect();
            try {
              await client.query('BEGIN');

              // 1. Lock action atomically scoped to Agent's environment + organization + cluster
              const lockRes = await client.query(
                `SELECT h.id, h.incident_id, h.recommendation_id, h.target_name, h.target_id, h.policy_id, h.environment_id,
                        h.execution_status, h.result, i.cluster_id AS incident_cluster_id
                 FROM healing_actions h
                 LEFT JOIN incidents i ON i.id = h.incident_id
                 WHERE h.id = $1
                   AND h.environment_id = $2::uuid
                   AND EXISTS (SELECT 1 FROM environments e WHERE e.id = h.environment_id AND e.organization_id = $3::uuid)
                 FOR UPDATE OF h;`,
                [action_id, ws.agent.environment_id, ws.agent.organization_id]
              );

              if (lockRes.rows.length === 0) {
                await client.query('ROLLBACK');
                console.warn(`⚠️ [AGENT ACTION RESULT] Rejected cross-tenant or unknown action_result from agent '${ws.agent.name}' for action ${action_id}`);
                break;
              }

              const row = lockRes.rows[0];
              if (
                row.incident_cluster_id &&
                ws.agent.cluster_id &&
                String(row.incident_cluster_id) !== String(ws.agent.cluster_id) &&
                String(row.incident_cluster_id) !== String(ws.agent.cluster_name || '')
              ) {
                await client.query('ROLLBACK');
                console.warn(`⚠️ [AGENT ACTION RESULT] Rejected cross-cluster action_result from agent '${ws.agent.name}' for action ${action_id}`);
                break;
              }

              // Guard against out-of-state or duplicate action_result callbacks
              const alreadyAwaitingRv = String(row.result?.agent_status || '').toUpperCase() === 'COMPLETED';
              if (row.execution_status !== 'RUNNING' || alreadyAwaitingRv) {
                await client.query('ROLLBACK');
                console.warn(
                  `⚠️ [AGENT ACTION RESULT] Ignored duplicate or non-RUNNING callback for action ${action_id} (execution_status=${row.execution_status}, agent_status=${row.result?.agent_status || 'NONE'})`
                );
                ws.send(
                  JSON.stringify({
                    status: 'ignored',
                    reason: 'DUPLICATE_OR_NOT_RUNNING',
                    type: 'action_result',
                    action_id,
                    timestamp: new Date().toISOString(),
                  })
                );
                break;
              }

              const failureErrorMessage =
                isCompleted
                  ? null
                  : (message ? String(message).slice(0, 1000) : 'Thực thi tác vụ tự phục hồi thất bại trên K8s Agent');
              const canonicalStatus = isCompleted ? 'COMPLETED' : 'FAILED';

              // 2. Update the in-flight RUNNING execution_attempt (or insert attempt 1 if missing)
              const runningAttRes = await client.query(
                `SELECT id FROM execution_attempts
                 WHERE healing_action_id = $1 AND status = 'RUNNING'
                 ORDER BY attempt_number DESC
                 LIMIT 1
                 FOR UPDATE;`,
                [action_id]
              );

              if (runningAttRes.rows.length > 0) {
                await client.query(
                  `UPDATE execution_attempts
                   SET agent_id = $2,
                       status = $3::execution_status,
                       response_payload = $4::jsonb,
                       error_message = $5,
                       completed_at = NOW(),
                       duration_ms = $6
                   WHERE id = $1 AND status = 'RUNNING';`,
                  [
                    runningAttRes.rows[0].id,
                    ws.agent.id,
                    canonicalStatus,
                    JSON.stringify({ message, details }),
                    failureErrorMessage,
                    duration_ms || 1000,
                  ]
                );
              } else {
                const maxNumRes = await client.query(
                  `SELECT COALESCE(MAX(attempt_number), 0)::int AS max_num FROM execution_attempts WHERE healing_action_id = $1;`,
                  [action_id]
                );
                const nextAttempt = Number(maxNumRes.rows[0]?.max_num || 0) + 1;
                await client.query(
                  `INSERT INTO execution_attempts (
                    healing_action_id, attempt_number, agent_id, command_type,
                    request_payload, response_payload, status, error_message,
                    started_at, completed_at, duration_ms
                  ) VALUES (
                    $1, $2, $3, 'K8S_AGENT_REMEDIATION',
                    $4::jsonb, $5::jsonb, $6::execution_status, $7,
                    NOW() - interval '1 second', NOW(), $8
                  );`,
                  [
                    action_id,
                    nextAttempt,
                    ws.agent.id,
                    JSON.stringify({ target: row?.target_name, agent: ws.agent.name }),
                    JSON.stringify({ message, details }),
                    canonicalStatus,
                    failureErrorMessage,
                    duration_ms || 1000,
                  ]
                );
              }

              // 3. Persist Agent outcome WITHOUT prematurely marking COMPLETED:
              // - FAILED -> execution_status = 'FAILED', completed_at = NOW()
              // - COMPLETED from Agent -> keep execution_status = 'RUNNING' & mark awaiting RecoveryVerificationService!
              const agentCompletedAtIso = new Date().toISOString();
              if (!isCompleted) {
                await client.query(
                  `UPDATE healing_actions
                   SET execution_status = 'FAILED'::execution_status,
                       completed_at = NOW(),
                       error_message = $2,
                       result = COALESCE(result, '{}'::jsonb) || $3::jsonb
                   WHERE id = $1 AND execution_status = 'RUNNING';`,
                  [
                    action_id,
                    failureErrorMessage,
                    JSON.stringify({
                      status: 'FAILED',
                      agent_status: 'FAILED',
                      message,
                      error: failureErrorMessage,
                      duration_ms,
                      executed_by_agent: ws.agent.name,
                      failed_at: agentCompletedAtIso,
                      details,
                    }),
                  ]
                );
              } else {
                await client.query(
                  `UPDATE healing_actions
                   SET error_message = NULL,
                       result = COALESCE(result, '{}'::jsonb) || $2::jsonb
                   WHERE id = $1 AND execution_status = 'RUNNING';`,
                  [
                    action_id,
                    JSON.stringify({
                      status: 'AWAITING_RECOVERY_VERIFICATION',
                      phase: 'AWAITING_RECOVERY_VERIFICATION',
                      agent_status: 'COMPLETED',
                      agent_completed_at: agentCompletedAtIso,
                      message,
                      duration_ms,
                      executed_by_agent: ws.agent.name,
                      details,
                    }),
                  ]
                );
              }

              await client.query('COMMIT');

              // 4. Keep incident OPEN for Post-Action Verification. Mark recommendation APPLIED once Agent command succeeded.
              if (isCompleted) {
                if (row?.recommendation_id) {
                  await pool.query(
                    `UPDATE ai_recommendations SET status = 'APPLIED' WHERE id = $1;`,
                    [row.recommendation_id]
                  );
                }
                if (row?.incident_id || row?.target_name || row?.target_id) {
                  await pool.query(
                    `UPDATE ai_recommendations r
                     SET status = 'APPLIED'
                     FROM incidents i
                     WHERE r.incident_id = i.id
                       AND i.organization_id = $4::uuid
                       AND (
                         ($1::uuid IS NOT NULL AND r.incident_id = $1::uuid)
                         OR ($2::text IS NOT NULL AND (
                           i.target_id = $2
                           OR LOWER(COALESCE(i.target_name, '')) = LOWER($2)
                           OR i.title ILIKE '% on ' || $2
                           OR i.title ILIKE '% trên ' || $2
                         ))
                         OR ($3::text IS NOT NULL AND i.target_id = $3)
                       )
                       AND r.status = 'PROPOSED';`,
                    [
                      row?.incident_id || null,
                      row?.target_name || null,
                      row?.target_id ? String(row.target_id) : null,
                      ws.agent.organization_id,
                    ]
                  );
                }
              }

              const agentOrgId = ws.agent?.organization_id || null;
              AuditService.record({
                organization_id: agentOrgId,
                actor_type: 'AGENT',
                action: isCompleted ? 'REMEDIATION_AGENT_SUCCEEDED' : 'REMEDIATION_FAILED',
                resource_type: 'HEALING_ACTION',
                resource_id: action_id,
                target_type: 'WORKLOAD',
                request_id: ws.requestId || null,
                user_agent: ws.userAgent || null,
                ip_address: ws.remoteIp || null,
                description: isCompleted
                  ? `K8s Agent ${ws.agent.name} đã thực thi thành công (chờ hậu kiểm phục hồi): ${message}`
                  : `Tác vụ tự phục hồi thất bại bởi Agent ${ws.agent.name}: ${message}`,
                status: isCompleted ? 'SUCCESS' : 'FAILURE',
                before_data: { execution_status: 'RUNNING' },
                after_data: { execution_status: isCompleted ? 'RUNNING' : 'FAILED', agent_status: canonicalStatus, message, duration_ms },
                metadata: {
                  agent_id: ws.agent.id,
                  agent_name: ws.agent.name,
                  cluster_id: ws.agent.cluster_id,
                  target_name: row?.target_name,
                  duration_ms,
                  incident_id: row?.incident_id,
                },
              }).catch(() => {});

              if (!isCompleted && row?.incident_id) {
                await pool.query(
                  'UPDATE incidents SET status = \'OPEN\', resolved_at = NULL WHERE id = $1 AND status = \'RESOLVED\'',
                  [row.incident_id]
                ).catch(() => {});
                CriticalIncidentNotificationService.notifyIfNeeded(row.incident_id, {
                  reasonStage: 'HEALING_FAILED',
                  failureMessage: message,
                }).catch((err) => {
                  console.warn('[AgentWebSocket] Gửi cảnh báo khẩn HEALING_FAILED thất bại:', err?.message || err);
                });
              }

              // Broadcast live event to UI
              broadcastTelemetryToUi({
                type: isCompleted ? 'healing_action_verifying' : 'healing_action_completed',
                data: {
                  action_id,
                  status: isCompleted ? 'RUNNING' : 'FAILED',
                  agent_status: canonicalStatus,
                  message,
                  agent: ws.agent.name,
                  organization_id: ws.agent.organization_id,
                  cluster_id: ws.agent.cluster_id,
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
              await client.query('ROLLBACK').catch(() => {});
              console.error('Error persisting action_result from agent:', actErr);
            } finally {
              client.release();
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
        }); // end runWithTenantContext(ws.agent.organization_id)
      } catch (err) {
        console.error('Error handling WebSocket message from agent:', sanitizeForLog(err));
        ws.send(
          JSON.stringify({
            status: 'error',
            message: 'Internal server error handling message',
          })
        );
      }
    });

    ws.on('close', async (code, reason) => {
      if (ws.agent) {
        console.log(`🔌 Agent disconnected: [${ws.agent.name}] (Code: ${code}, Reason: ${reason})`);
        const agentObj = ws.agent;
        if (agentObj.organization_id) {
          await runWithTenantContext(agentObj.organization_id, null, () =>
            AgentService.setAgentOffline(agentObj.id)
          ).catch(() => {});
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket connection error:', sanitizeForLog(err));
    });
  });

  // Heartbeat ping interval to detect stale/dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const extWs = client as ExtWebSocket;
      if (!extWs.isAlive) {
        if (extWs.agent) {
          const agentObj = extWs.agent;
          if (agentObj.organization_id) {
            runWithTenantContext(agentObj.organization_id, null, () =>
              AgentService.setAgentOffline(agentObj.id)
            ).catch(() => {});
          }
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
  organization_id?: string;
}): Promise<{ dispatched: boolean; recipient_agent?: string; reason?: string }> {
  return withBackendSpan(
    'remediation.dispatch',
    { 'action.type': payload.action_type || 'UNKNOWN' },
    async () => {
      if (!payload.cluster_id || !payload.environment_id) {
        console.warn(`[AgentWebSocket] Refusing dispatch for action '${payload.action_id}': missing strict cluster_id/environment_id routing context.`);
        return { dispatched: false, reason: 'MISSING_ROUTING_CONTEXT' };
      }

      if (!activeAgentWss || activeAgentWss.clients.size === 0) {
        console.warn(`[AgentWebSocket] No connected agents available to receive action '${payload.action_type}' for target '${payload.target_name}'.`);
        return { dispatched: false, reason: 'NO_CONNECTED_AGENTS' };
      }

      let chosenClient: ExtWebSocket | null = null;
      // Strict tenant + cluster + environment routing: never fall back to unrelated agents or sockets
      for (const client of activeAgentWss.clients) {
        const extWs = client as ExtWebSocket;
        if (extWs.isAlive && extWs.agent && extWs.readyState === WebSocket.OPEN) {
          if (payload.organization_id && String(extWs.agent.organization_id || '') !== String(payload.organization_id)) {
            continue;
          }
          if (
            String(extWs.agent.cluster_id || '') === String(payload.cluster_id) &&
            String(extWs.agent.environment_id || '') === String(payload.environment_id)
          ) {
            chosenClient = extWs;
            break;
          }
        }
      }

      if (!chosenClient || !chosenClient.agent) {
        console.warn(`[AgentWebSocket] No matching authenticated agent WebSocket found for cluster=${payload.cluster_id}, env=${payload.environment_id}.`);
        return { dispatched: false, reason: 'NO_MATCHING_AGENT' };
      }

      const agentName = chosenClient.agent.name;
      console.log(`🚀 [AgentWebSocket] Dispatching action '${payload.action_type}' (ID: ${payload.action_id}) to Agent [${agentName}] for target '${payload.target_name}'`);

      try {
        const traceCarrier = injectTraceContext({});
        const enrichedParams = {
          ...(payload.params || {}),
          ...traceCarrier,
        };

        chosenClient.send(
          JSON.stringify({
            type: 'execute_action',
            data: {
              action_id: payload.action_id,
              action_type: payload.action_type,
              target_name: payload.target_name,
              namespace: payload.namespace || 'default',
              params: enrichedParams,
            },
          })
        );
        recordRemediationAction(payload.action_type, 'dispatched');
        return { dispatched: true, recipient_agent: agentName };
      } catch (sendErr) {
        console.error(`❌ [AgentWebSocket] Failed transmitting execute_action to agent [${agentName}]:`, sendErr);
        return { dispatched: false, recipient_agent: agentName };
      }
    }
  );
}
