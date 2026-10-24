import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { requireOrgMember, requireOrgRole } from '../middlewares/orgAuth.middleware';
import { rateLimiter } from '../middlewares/rateLimit.middleware';
import { authenticateAgentToken } from '../middlewares/agentAuth.middleware';
import {
  createAgentSchema,
  updateAgentSchema,
  createTokenSchema,
  agentHeartbeatSchema,
  agentQuerySchema,
  agentIdParamSchema,
} from '../validations/agent.validation';

/* ==========================================================================
   1. ORGANIZATIONAL AGENT ROUTES (QUẢN LÝ AGENT THEO TỔ CHỨC)
   Prefix: /api/v1/organizations/:orgId/agents
   ========================================================================== */
const router = Router({ mergeParams: true });

// Toàn bộ API Quản lý Agent yêu cầu xác thực JWT người dùng
router.use(authenticateToken);

/**
 * [GET] /api/v1/organizations/:orgId/agents
 * Lấy danh sách Agent của tổ chức (phân trang, tìm kiếm, lọc status/cluster/env)
 * Quyền: Mọi thành viên hợp lệ trong tổ chức
 */
router.get(
  '/',
  requireOrgMember,
  validate(agentQuerySchema),
  AgentController.getAll
);

/**
 * [POST] /api/v1/organizations/:orgId/agents
 * Tạo Agent mới cho một môi trường và sinh Token kết nối bí mật ban đầu
 * Quyền: SME_OWNER, DEVOPS
 */
router.post(
  '/',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(createAgentSchema),
  AgentController.create
);

/**
 * [GET] /api/v1/organizations/:orgId/agents/:agentId
 * Xem thông tin chi tiết một Agent (kèm tokens và lịch sử heartbeat gần nhất)
 * Quyền: Mọi thành viên hợp lệ trong tổ chức (SME_OWNER, DEVOPS, VIEWER)
 */
router.get(
  '/:agentId',
  requireOrgMember,
  validate(agentIdParamSchema),
  AgentController.getById
);

/**
 * [PUT] /api/v1/organizations/:orgId/agents/:agentId
 * Cập nhật cấu hình Agent (tên, cluster_id, version)
 * Quyền: SME_OWNER, DEVOPS
 */
router.put(
  '/:agentId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(agentIdParamSchema),
  validate(updateAgentSchema),
  AgentController.update
);

/**
 * [POST] /api/v1/organizations/:orgId/agents/:agentId/disconnect
 * Ngắt kết nối Agent (chuyển sang OFFLINE và thu hồi token)
 * Quyền: SME_OWNER, DEVOPS
 */
router.post(
  '/:agentId/disconnect',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(agentIdParamSchema),
  AgentController.disconnect
);

/**
 * [POST] /api/v1/organizations/:orgId/agents/:agentId/revoke
 * Thu hồi Agent (chuyển sang REVOKED và vô hiệu hóa toàn bộ Token)
 * Quyền: SME_OWNER, DEVOPS
 */
router.post(
  '/:agentId/revoke',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(agentIdParamSchema),
  AgentController.revoke
);

/**
 * [DELETE] /api/v1/organizations/:orgId/agents/:agentId
 * Xóa Agent khỏi hệ thống
 * Quyền: Chỉ duy nhất SME_OWNER
 */
router.delete(
  '/:agentId',
  requireOrgMember,
  requireOrgRole('SME_OWNER'),
  validate(agentIdParamSchema),
  AgentController.delete
);

/* ==========================================================================
   2. AGENT TOKEN MANAGEMENT ROUTES (QUẢN LÝ TOKENS KẾT NỐI CỦA AGENT)
   ========================================================================== */

/**
 * [GET] /api/v1/organizations/:orgId/agents/:agentId/tokens
 * Lấy danh sách Token của Agent (chỉ hiện token_prefix, ngày tạo, ngày hết hạn)
 * Quyền: Mọi thành viên hợp lệ trong tổ chức (SME_OWNER, DEVOPS, VIEWER)
 */
router.get(
  '/:agentId/tokens',
  requireOrgMember,
  validate(agentIdParamSchema),
  AgentController.getTokens
);

/**
 * [POST] /api/v1/organizations/:orgId/agents/:agentId/tokens
 * Sinh Token kết nối mới cho Agent (phục vụ xoay vòng token bảo mật)
 * Quyền: SME_OWNER, DEVOPS
 */
router.post(
  '/:agentId/tokens',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(agentIdParamSchema),
  validate(createTokenSchema),
  AgentController.createToken
);

/**
 * [DELETE] /api/v1/organizations/:orgId/agents/:agentId/tokens/:tokenId
 * Thu hồi một Token cụ thể của Agent
 * Quyền: SME_OWNER, DEVOPS
 */
router.delete(
  '/:agentId/tokens/:tokenId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(agentIdParamSchema),
  AgentController.revokeToken
);

/* ==========================================================================
   3. AGENT HEARTBEAT HISTORY ROUTE (XEM LỊCH SỬ NHỊP TIM TRÊN DASHBOARD)
   ========================================================================== */

/**
 * [GET] /api/v1/organizations/:orgId/agents/:agentId/heartbeats
 * Xem lịch sử nhịp tim, độ trễ phản hồi (latency_ms) của Agent
 * Quyền: Mọi thành viên hợp lệ trong tổ chức
 */
router.get(
  '/:agentId/heartbeats',
  requireOrgMember,
  validate(agentIdParamSchema),
  AgentController.getHeartbeats
);

export const agentRoutes = router;

/* ==========================================================================
   4. AGENT DAEMON HEARTBEAT ROUTE (DÀNH CHO AGENT POD GỬI TÍN HIỆU TỪ K8S)
   Prefix: /api/v1/agents
   Xác thực: x-agent-token header hoặc Authorization: Bearer <agent_token>
   ========================================================================== */
const daemonRouter = Router();

/**
 * [POST] /api/v1/agents/heartbeat
 * Tiếp nhận tín hiệu nhịp tim định kỳ từ Daemon Agent trong K8s cluster
 */
daemonRouter.post(
  '/heartbeat',
  rateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: 'Quá nhiều yêu cầu nhịp tim từ địa chỉ này, vui lòng thử lại sau.',
  }),
  authenticateAgentToken,
  validate(agentHeartbeatSchema),
  AgentController.recordHeartbeat
);

export const agentDaemonRoutes = daemonRouter;
