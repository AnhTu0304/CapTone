import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuditService } from '../services/audit.service';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { AgentService } from '../services/agent.service';

export class NodeController {
  public static async getNodes(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;
      const orgMember = (req as any).orgMember;

      let query = `
        SELECT 
          n.id, 
          n.cluster_id,
          c.name AS cluster_name,
          c.status AS cluster_status,
          c.provider AS cluster_provider,
          n.name, 
          n.status, 
          n.cpu_capacity_millicores, 
          n.memory_capacity_bytes, 
          n.disk_capacity_bytes, 
          n.kubelet_version, 
          n.roles, 
          n.labels, 
          n.created_at,
          n.updated_at,
          COUNT(p.id)::int AS pods_count
        FROM nodes n
        JOIN clusters c ON n.cluster_id = c.id
        LEFT JOIN environments e ON c.environment_id = e.id
        LEFT JOIN pods p ON p.node_id = n.id AND p.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (orgMember && orgMember.roleCode !== 'SUPER_ADMIN') {
        params.push(orgMember.organizationId);
        query += ` AND e.organization_id = $${params.length}`;
      }

      if (clusterId && !clusterId.startsWith('org-') && !clusterId.startsWith('sandbox-')) {
        params.push(clusterId);
        query += ` AND (c.id::text = $${params.length} OR c.name = $${params.length})`;
      }

      query += ` GROUP BY n.id, c.name, c.status, c.provider ORDER BY c.name ASC, n.name ASC`;

      const result = await pool.query(query, params);
      return ApiResponse.success(res, 'Lấy danh sách Nodes thành công', result.rows, 200);
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
      const orgMember = (req as any).orgMember;

      let query = `SELECT 
          n.id, 
          n.cluster_id,
          c.name AS cluster_name,
          c.status AS cluster_status,
          c.provider AS cluster_provider,
          n.name, 
          n.status, 
          n.cpu_capacity_millicores, 
          n.memory_capacity_bytes, 
          n.disk_capacity_bytes, 
          n.kubelet_version, 
          n.roles, 
          n.labels, 
          n.created_at,
          n.updated_at
        FROM nodes n
        JOIN clusters c ON n.cluster_id = c.id
        LEFT JOIN environments e ON c.environment_id = e.id
        WHERE (n.id::text = $1 OR n.name = $1) AND c.deleted_at IS NULL`;

      const params: any[] = [nodeId];
      if (orgMember && orgMember.roleCode !== 'SUPER_ADMIN') {
        params.push(orgMember.organizationId);
        query += ` AND e.organization_id = $${params.length}`;
      }
      query += ` LIMIT 1`;

      const nodeRes = await pool.query(query, params);

      if (!nodeRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Node máy chủ');
      }

      const node = nodeRes.rows[0];

      const podsRes = await pool.query(
        `SELECT 
          p.id, 
          p.name, 
          p.status, 
          p.phase, 
          p.restart_count, 
          p.image, 
          p.labels,
          p.started_at,
          p.created_at,
          COALESCE(ns.name, 'default') AS namespace
        FROM pods p
        LEFT JOIN namespaces ns ON p.namespace_id = ns.id
        WHERE p.node_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.name ASC`,
        [node.id]
      );

      return ApiResponse.success(
        res,
        'Lấy chi tiết Node thành công',
        {
          ...node,
          pods_count: podsRes.rows.length,
          pods: podsRes.rows,
        },
        200
      );
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
      const isPlatformAdmin = rawRoles.some((r: string) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(String(r).toUpperCase()));

      if (!isPlatformAdmin) {
        if (!node.organization_id) {
          throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền thao tác trên Node này');
        }
        const member = await OrganizationMemberModel.findByOrgAndUser(node.organization_id, user.id);
        if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS'].includes(member.role_code.toUpperCase())) {
          throw new ApiError(403, 'Từ chối truy cập: Thao tác này yêu cầu quyền SME_OWNER hoặc DEVOPS của tổ chức');
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
