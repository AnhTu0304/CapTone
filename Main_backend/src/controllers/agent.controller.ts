import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agent.service';
import { ApiResponse } from '../utils/apiResponse';

export class AgentController {
  /**
   * [POST] /api/v1/organizations/:orgId/agents
   * Tạo Agent mới và tự động sinh Agent Token bí mật ban đầu
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const userId = (req as any).user?.id;
      const result = await AgentService.createAgent(orgId, userId, req.body);
      return ApiResponse.success(res, 'Tạo Agent và sinh Token kết nối thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/agents
   * Lấy danh sách Agent của tổ chức (hỗ trợ lọc theo environment_id, cluster_id, status, search, phân trang)
   * Quyền: Mọi thành viên tổ chức (OWNER, SME_OWNER, DEVOPS, VIEWER)
   */
  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const result = await AgentService.getAgents(orgId, req.query as any);
      return ApiResponse.success(res, 'Lấy danh sách Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/agents/:agentId
   * Xem chi tiết Agent (bao gồm môi trường, cụm K8s, danh sách tokens, và lịch sử heartbeat gần nhất)
   * Quyền: Mọi thành viên tổ chức
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.getAgentDetail(orgId, agentId);
      return ApiResponse.success(res, 'Lấy chi tiết Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:orgId/agents/:agentId
   * Cập nhật thông tin cấu hình Agent (tên, cluster_id, version)
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.updateAgent(orgId, agentId, req.body);
      return ApiResponse.success(res, 'Cập nhật thông tin Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/agents/:agentId/revoke
   * Thu hồi Agent (chuyển trạng thái REVOKED và vô hiệu hóa tất cả các Token kết nối)
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.revokeAgent(orgId, agentId);
      return ApiResponse.success(res, 'Thu hồi Agent thành công (tất cả token đã bị vô hiệu hóa)', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:orgId/agents/:agentId
   * Xóa Agent khỏi hệ thống
   * Quyền: Chỉ duy nhất SME_OWNER
   */
  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      await AgentService.deleteAgent(orgId, agentId);
      return ApiResponse.success(res, 'Xóa Agent thành công', { id: agentId }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/agents/:agentId/tokens
   * Tạo Token mới cho Agent (phục vụ việc xoay vòng token bảo mật)
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async createToken(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const userId = (req as any).user?.id;
      const expiresInDays = req.body?.expires_in_days;
      const result = await AgentService.createAgentToken(orgId, agentId, userId, expiresInDays);
      return ApiResponse.success(res, 'Tạo Token kết nối mới thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/agents/:agentId/tokens
   * Lấy danh sách các Token của Agent (chỉ hiển thị tiền tố prefix, không lộ hash)
   * Quyền: Mọi thành viên tổ chức
   */
  public static async getTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.getAgentTokens(orgId, agentId);
      return ApiResponse.success(res, 'Lấy danh sách Token của Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:orgId/agents/:agentId/tokens/:tokenId
   * Thu hồi một Token cụ thể của Agent
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async revokeToken(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const tokenId = req.params.tokenId;
      const result = await AgentService.revokeAgentToken(orgId, agentId, tokenId);
      return ApiResponse.success(res, 'Thu hồi Token Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/agents/:agentId/heartbeats
   * Lấy lịch sử Heartbeat (nhịp tim, độ trễ latency_ms) của Agent
   * Quyền: Mọi thành viên tổ chức
   */
  public static async getHeartbeats(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const result = await AgentService.getHeartbeats(orgId, agentId, limit);
      return ApiResponse.success(res, 'Lấy lịch sử Heartbeat của Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/agents/heartbeat
   * Endpoint dành riêng cho Agent Daemon pod gửi tín hiệu nhịp tim định kỳ
   * Xác thực bằng Agent Token (x-agent-token header hoặc Authorization: Bearer <agent_token>)
   */
  public static async recordHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const customHeader = req.headers['x-agent-token'] as string;
      let rawToken = customHeader || '';

      if (!rawToken && authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          rawToken = authHeader.slice(7).trim();
        } else {
          rawToken = authHeader.trim();
        }
      }

      if ((req as any).agent) {
        const result = await AgentService.recordHeartbeatForAgent((req as any).agent, req.body);
        return ApiResponse.success(res, 'Ghi nhận nhịp tim Agent thành công', result, 200);
      }
      const result = await AgentService.recordHeartbeatFromDaemon(rawToken, req.body);
      return ApiResponse.success(res, 'Ghi nhận nhịp tim Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}
