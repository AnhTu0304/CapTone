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
   * [POST] /api/v1/organizations/:orgId/agents/:agentId/disconnect
   * Ngắt kết nối Agent (chuyển sang OFFLINE và thu hồi token kết nối)
   * Quyền: SME_OWNER, DEVOPS
   */
  public static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId || req.params.id;
      const userId = (req as any).user?.id;
      const result = await AgentService.disconnectAgent(orgId, agentId, userId);
      return ApiResponse.success(res, 'Ngắt kết nối Agent thành công', result, 200);
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
      const userId = (req as any).user?.id;
      const force = req.query.force === 'true' || req.body?.force === true;
      await AgentService.deleteAgent(orgId, agentId, userId, force);
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

  /**
   * [POST] /api/v1/agents/node-metrics & /api/v1/agents/metrics
   * Tiếp nhận dữ liệu tài nguyên Node (CPU, RAM, Disk, Network I/O) từ Agent Daemon (Task 4.3)
   */
  public static async ingestNodeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const agent = (req as any).agent;
      if (!agent) {
        return ApiResponse.error(res, 'Thiếu thông tin xác thực Agent', 401);
      }
      const result = await AgentService.ingestNodeMetricsFromDaemon(agent, req.body);
      return ApiResponse.success(res, 'Tiếp nhận và lưu trữ Node Metrics thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/agents/apm-metrics & /api/v1/agents/service-metrics
   * Tiếp nhận dữ liệu viễn trắc APM (Latency, Request Rate, 5xx Rate, Replicas) từ Agent Daemon (PB15 1.3)
   */
  public static async ingestApmMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const agent = (req as any).agent;
      if (!agent) {
        return ApiResponse.error(res, 'Thiếu thông tin xác thực Agent', 401);
      }
      const result = await AgentService.ingestApmMetricsFromDaemon(agent, req.body);
      return ApiResponse.success(res, 'Tiếp nhận và lưu trữ APM Service Metrics thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/agents/:agentId/metrics
   * Truy vấn lịch sử Node Metrics của một Agent theo khoảng thời gian và phân trang (Task 4.3)
   */
  public static async getAgentNodeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const agentId = req.params.agentId;
      const result = await AgentService.queryNodeMetricsScoped({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        agentId,
        query: req.query as Record<string, any>,
      });
      return ApiResponse.success(res, 'Lấy lịch sử Node Metrics của Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /* =========================================================================
     GLOBAL ADMIN ENDPOINTS (/api/v1/agents)
     ========================================================================= */

  public static async getAllAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AgentService.getAllAgentsGlobal(req.query as any);
      return ApiResponse.success(res, 'Lấy danh sách toàn bộ Agent hệ thống thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getByIdAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.getAgentDetailGlobal(agentId);
      return ApiResponse.success(res, 'Lấy chi tiết Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async disconnectAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const agentId = req.params.agentId || req.params.id;
      const userId = (req as any).user?.id;
      const result = await AgentService.disconnectAgentGlobal(agentId, userId);
      return ApiResponse.success(res, 'Ngắt kết nối Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async revokeAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const agentId = req.params.agentId || req.params.id;
      const result = await AgentService.revokeAgentGlobal(agentId);
      return ApiResponse.success(res, 'Thu hồi Agent thành công (tất cả token đã bị vô hiệu hóa)', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async rotateTokenAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const agentId = req.params.agentId || req.params.id;
      const userId = (req as any).user?.id;
      const expiresInDays = req.body?.expires_in_days;
      const result = await AgentService.rotateAgentTokenGlobal(agentId, userId, expiresInDays);
      return ApiResponse.success(res, 'Xoay vòng và cấp mới Token Agent thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const agentId = req.params.agentId || req.params.id;
      const userId = (req as any).user?.id;
      const force = req.query.force === 'true' || req.body?.force === true;
      await AgentService.deleteAgentGlobal(agentId, userId, force);
      return ApiResponse.success(res, 'Xóa Agent thành công', { id: agentId }, 200);
    } catch (error) {
      next(error);
    }
  }
}
