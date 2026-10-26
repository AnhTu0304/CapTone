import { Request, Response, NextFunction } from 'express';
import { HealingActionService } from '../services/healingAction.service';
import { ApiResponse } from '../utils/apiResponse';

export class HealingActionController {
  /**
   * GET /api/v1/healing/actions/running
   * Lấy danh sách hành động tự phục hồi đang chạy (RUNNING / PENDING) có kiểm tra tổ chức & cụm K8s
   */
  public static async getRunningActions(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const user = (req as any).user;
      const cluster_id = (req.query.cluster_id as string | undefined) || (req.headers['x-cluster-id'] as string | undefined);
      const organization_id =
        (req.query.organization_id as string | undefined) ||
        (req.headers['x-organization-id'] as string | undefined) ||
        user?.organization_id;
      const search = req.query.search as string | undefined;

      const result = await HealingActionService.getRunningActions(
        {
          limit,
          offset,
          cluster_id,
          organization_id,
          search,
        },
        user
      );

      return ApiResponse.success(res, 'Lấy danh sách hành động đang thực thi thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/actions
   * Lấy danh sách hành động tự phục hồi có phân trang và bộ lọc đa chiều
   */
  public static async getActions(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const user = (req as any).user;
      const cluster_id = (req.query.cluster_id as string | undefined) || (req.headers['x-cluster-id'] as string | undefined);
      const organization_id =
        (req.query.organization_id as string | undefined) ||
        (req.headers['x-organization-id'] as string | undefined) ||
        user?.organization_id;
      const risk_level = req.query.risk_level as string | undefined;
      const execution_mode = req.query.execution_mode as string | undefined;
      const execution_status = req.query.execution_status as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await HealingActionService.getActions(
        {
          limit,
          offset,
          cluster_id,
          organization_id,
          risk_level,
          execution_mode,
          execution_status,
          search,
        },
        user
      );

      return ApiResponse.success(res, 'Lấy danh sách hành động tự phục hồi thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/actions/:id
   * Lấy chi tiết một hành động tự phục hồi
   */
  public static async getActionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const action = await HealingActionService.getActionById(id, user);
      return ApiResponse.success(res, 'Lấy chi tiết hành động tự phục hồi thành công', action, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/actions
   * Tạo mới một hành động tự phục hồi
   */
  public static async createAction(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const created = await HealingActionService.createAction(req.body, user?.id || null);
      return ApiResponse.success(res, 'Khởi tạo hành động tự phục hồi thành công', created, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/actions/:id/execute
   * Kích hoạt hoặc chạy lại (retry) một hành động tự phục hồi
   */
  public static async executeAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const result = await HealingActionService.executeAction(id, user?.id || null, user);
      return ApiResponse.success(res, 'Thực thi hành động tự phục hồi thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/actions/:id/abort
   * Hủy bỏ / Dừng khẩn cấp một hành động tự phục hồi đang chạy hoặc đang chờ
   */
  public static async abortAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { reason } = req.body || {};

      const aborted = await HealingActionService.abortAction(id, user?.id || null, reason, user);
      return ApiResponse.success(res, 'Hủy bỏ hành động tự phục hồi thành công', aborted, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/healing/actions/:id/status
   * Cập nhật trạng thái thực thi của hành động
   */
  public static async updateActionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, result, error_message } = req.body;
      const updated = await HealingActionService.updateActionStatus(id, status, result, error_message);
      return ApiResponse.success(res, 'Cập nhật trạng thái hành động thành công', updated, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/action-types
   * Lấy danh mục các loại hành động chuẩn hóa
   */
  public static async getActionTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const actionTypes = await HealingActionService.getActionTypes();
      return ApiResponse.success(res, 'Lấy danh mục loại hành động thành công', actionTypes, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/healing/action-types/:id
   * Cập nhật cấu hình loại hành động
   */
  public static async updateActionType(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await HealingActionService.updateActionType(id, req.body);
      return ApiResponse.success(res, 'Cập nhật loại hành động thành công', updated, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/policies
   * Lấy danh sách chính sách tự phục hồi
   */
  public static async getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organization_id = (req.query.organization_id as string | undefined) || user?.organization_id;
      const environment_id = req.query.environment_id as string | undefined;
      const search = req.query.search as string | undefined;
      const is_active = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

      const policies = await HealingActionService.getPolicies({
        organization_id,
        environment_id,
        is_active,
        search,
      });

      return ApiResponse.success(res, 'Lấy danh sách chính sách tự phục hồi thành công', policies, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/healing/policies/:id
   * Cập nhật cấu hình chính sách
   */
  public static async updatePolicyConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await HealingActionService.updatePolicyConfig(id, req.body);
      return ApiResponse.success(res, 'Cập nhật cấu hình chính sách thành công', updated, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/healing/policies/:id/toggle
   * Bật/Tắt kích hoạt chính sách
   */
  public static async togglePolicyActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await HealingActionService.togglePolicyActive(id);
      return ApiResponse.success(res, 'Chuyển đổi trạng thái kích hoạt chính sách thành công', updated, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/policies
   * Tạo chính sách tự phục hồi mới
   */
  public static async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const policyData = {
        ...req.body,
        created_by: user?.id,
        organization_id: req.body.organization_id || user?.organization_id,
      };
      const created = await HealingActionService.createPolicy(policyData);
      return ApiResponse.success(res, 'Tạo chính sách tự phục hồi mới thành công', created, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/approvals
   * Lấy danh sách yêu cầu phê duyệt hành động (HITL)
   */
  public static async getApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const user = (req as any).user;
      const organization_id = (req.query.organization_id as string | undefined) || user?.organization_id;
      const cluster_id = req.query.cluster_id as string | undefined;
      const status = req.query.status as string | undefined;

      const approvals = await HealingActionService.getApprovals(
        {
          limit,
          offset,
          organization_id,
          cluster_id,
          status,
        },
        user
      );

      return ApiResponse.success(res, 'Lấy danh sách yêu cầu phê duyệt thành công', approvals, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/actions/:id/approve
   * Phê duyệt hành động rủi ro cao
   */
  public static async approveAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { reason } = req.body || {};

      const approved = await HealingActionService.approveAction(id, user?.id || null, reason, user);
      return ApiResponse.success(res, 'Phê duyệt hành động tự phục hồi thành công', approved, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/healing/actions/:id/reject
   * Từ chối hành động rủi ro cao
   */
  public static async rejectAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { reason } = req.body || {};

      const rejected = await HealingActionService.rejectAction(id, user?.id || null, reason, user);
      return ApiResponse.success(res, 'Từ chối thực thi hành động tự phục hồi', rejected, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/healing/analytics
   * Thống kê hiệu quả tự phục hồi và MTTR từ cơ sở dữ liệu
   */
  public static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organization_id = (req.query.organization_id as string | undefined) || user?.organization_id;
      const cluster_id = req.query.cluster_id as string | undefined;

      const stats = await HealingActionService.getAnalytics(organization_id, cluster_id, user);
      return ApiResponse.success(res, 'Lấy số liệu phân tích tự phục hồi thành công', stats, 200);
    } catch (error) {
      next(error);
    }
  }
}
