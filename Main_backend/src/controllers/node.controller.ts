import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuditService } from '../services/audit.service';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { AgentService } from '../services/agent.service';
import { K8sStatusService } from '../services/k8sStatus.service';

export class NodeController {
  public static async getNodes(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;

      const nodes = await K8sStatusService.getNodesStatus({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        clusterId,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(res, 'Lấy danh sách Nodes thành công', nodes, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getNodeDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const nodeId = req.params.nodeId || req.params.id;
      if (!nodeId) {
        throw new ApiError(400, 'Mã Node không hợp lệ');
      }
      const orgId = req.params.orgId;
      const clusterId = req.params.clusterId;

      const node = await K8sStatusService.getNodeStatusById(
        {
          user: (req as any).user,
          orgMember: (req as any).orgMember,
          orgId,
          clusterId,
          query: req.query as Record<string, any>,
        },
        nodeId
      );

      return ApiResponse.success(res, 'Lấy chi tiết trạng thái Node thành công', node, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getNodeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusterId = req.params.clusterId;
      const nodeId = req.params.nodeId;

      const result = await AgentService.queryNodeMetricsScoped({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        clusterId,
        nodeId,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(res, 'Lấy chuỗi Node Metrics thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getNodeTimeseries(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusterId = req.params.clusterId;
      const nodeId = req.params.nodeId;

      const result = await AgentService.queryNodeTimeseriesScoped({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        clusterId,
        nodeId,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(res, `Lấy dữ liệu chuỗi thời gian (${result.metricType}) thành công`, result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async drainNode(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const nodeId = req.params.nodeId || req.params.id;
      const nodeRes = await pool.query(
        `SELECT n.id, n.name, n.cluster_id, c.name as cluster_name, e.organization_id 
         FROM nodes n 
         JOIN clusters c ON n.cluster_id = c.id 
         LEFT JOIN environments e ON c.environment_id = e.id 
         WHERE (n.id::text = $1 OR n.name = $1) AND c.deleted_at IS NULL LIMIT 1`,
        [nodeId]
      );
      if (!nodeRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Node');
      }
      const node = nodeRes.rows[0];

      const rawRoles: string[] = Array.isArray(user?.roles) ? user.roles : [user?.roles || ''];
      const isPlatformAdmin = rawRoles.some((r: string) =>
        ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(String(r).toUpperCase())
      );

      if (!isPlatformAdmin) {
        if (!node.organization_id) {
          throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền thao tác trên Node này');
        }
        const member = await OrganizationMemberModel.findByOrgAndUser(node.organization_id, user.id);
        if (
          !member ||
          member.status !== 'ACTIVE' ||
          !['SME_OWNER', 'DEVOPS'].includes(member.role_code.toUpperCase())
        ) {
          throw new ApiError(
            403,
            'Từ chối truy cập: Thao tác này yêu cầu quyền SME_OWNER hoặc DEVOPS của tổ chức'
          );
        }
      }

      await AuditService.recordFromRequest(req, {
        organization_id: node.organization_id || null,
        action: 'REMEDIATION_NODE_DRAINED',
        status: 'SUCCESS',
        resource_type: 'NODE',
        resource_id: node.id,
        description: `Thực hiện yêu cầu tháo tải (Drain) Node ${node.name}`,
        metadata: {
          node_name: node.name,
          cluster_id: node.cluster_id,
          cluster_name: node.cluster_name,
        },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        `Yêu cầu tháo tải (Drain) Node ${node.name} đã được tiếp nhận và chuyển đến hệ thống tự chữa lành MAPE-K`,
        {
          node_id: node.id,
          node_name: node.name,
          cluster_name: node.cluster_name,
          action: 'DRAIN_NODE',
          status: 'PENDING_APPROVAL',
          requested_at: new Date().toISOString(),
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
