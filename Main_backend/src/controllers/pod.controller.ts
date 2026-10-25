import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuditService } from '../services/audit.service';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { K8sStatusService } from '../services/k8sStatus.service';

export class PodController {
  public static async getPods(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;

      const pods = await K8sStatusService.getPodsStatus({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        clusterId,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(res, 'Lấy danh sách Pods thành công', pods, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getPodDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const podId = req.params.podId || req.params.id;
      if (!podId) {
        throw new ApiError(400, 'Mã Pod không hợp lệ');
      }
      const orgId = req.params.orgId;
      const clusterId = req.params.clusterId;

      const pod = await K8sStatusService.getPodStatusById(
        {
          user: (req as any).user,
          orgMember: (req as any).orgMember,
          orgId,
          clusterId,
          query: req.query as Record<string, any>,
        },
        podId
      );

      return ApiResponse.success(res, 'Lấy chi tiết trạng thái Pod thành công', pod, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async restartPod(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const podId = req.params.podId || req.params.id;
      const podRes = await pool.query(
        `SELECT p.id, p.name, p.cluster_id, c.name AS cluster_name, e.organization_id, COALESCE(ns.name, 'default') AS namespace
         FROM pods p
         JOIN clusters c ON p.cluster_id = c.id
         LEFT JOIN environments e ON c.environment_id = e.id
         LEFT JOIN namespaces ns ON p.namespace_id = ns.id
         WHERE (p.id::text = $1 OR p.name = $1) AND p.deleted_at IS NULL AND c.deleted_at IS NULL
         LIMIT 1`,
        [podId]
      );
      if (!podRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Pod');
      }
      const pod = podRes.rows[0];

      const rawRoles: string[] = Array.isArray(user?.roles) ? user.roles : [user?.roles || ''];
      const isPlatformAdmin = rawRoles.some((r: string) =>
        ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(String(r).toUpperCase())
      );

      if (!isPlatformAdmin) {
        if (!pod.organization_id) {
          throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền thao tác trên Pod này');
        }
        const member = await OrganizationMemberModel.findByOrgAndUser(pod.organization_id, user.id);
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
        organization_id: pod.organization_id || null,
        action: 'REMEDIATION_POD_RESTARTED',
        status: 'SUCCESS',
        resource_type: 'POD',
        resource_id: pod.id,
        description: `Yêu cầu khởi động lại Pod ${pod.name} (Namespace: ${pod.namespace})`,
        metadata: {
          pod_name: pod.name,
          namespace: pod.namespace,
          cluster_id: pod.cluster_id,
          cluster_name: pod.cluster_name,
        },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        `Yêu cầu khởi động lại Pod ${pod.name} (Namespace: ${pod.namespace}) đã được gửi đến hệ thống tự chữa lành MAPE-K`,
        {
          pod_id: pod.id,
          pod_name: pod.name,
          namespace: pod.namespace,
          cluster_name: pod.cluster_name,
          action: 'RESTART_POD',
          status: 'SUCCESS',
          executed_at: new Date().toISOString(),
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
