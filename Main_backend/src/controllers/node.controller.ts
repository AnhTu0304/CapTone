import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class NodeController {
  /**
   * [GET] /api/v1/nodes
   * [GET] /api/v1/clusters/:clusterId/nodes
   * Lấy danh sách các máy chủ Nodes (theo cụm hoặc toàn hệ thống)
   */
  public static async getNodes(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;

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
        LEFT JOIN pods p ON p.node_id = n.id AND p.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (clusterId && !clusterId.startsWith('org-') && !clusterId.startsWith('sandbox-')) {
        params.push(clusterId);
        query += ` AND (c.id::text = $1 OR c.name = $1)`;
      }

      query += ` GROUP BY n.id, c.name, c.status, c.provider ORDER BY c.name ASC, n.name ASC`;

      const result = await pool.query(query, params);
      return ApiResponse.success(res, 'Lấy danh sách Nodes thành công', result.rows, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/nodes/:nodeId
   * Lấy thông tin chi tiết một Node kèm danh sách Pods đang chạy trên Node
   */
  public static async getNodeDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const nodeId = req.params.nodeId || req.params.id;
      if (!nodeId) {
        throw new ApiError(400, 'Mã Node không hợp lệ');
      }

      const nodeRes = await pool.query(
        `SELECT 
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
        WHERE (n.id::text = $1 OR n.name = $1)
        LIMIT 1`,
        [nodeId]
      );

      if (!nodeRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Node máy chủ');
      }

      const node = nodeRes.rows[0];

      // Lấy danh sách Pods trên Node
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

  /**
   * [POST] /api/v1/nodes/:nodeId/drain
   * Đề xuất / Thực thi tháo tải an toàn (Safe Drain) Node qua MAPE-K
   */
  public static async drainNode(req: Request, res: Response, next: NextFunction) {
    try {
      const nodeId = req.params.nodeId || req.params.id;
      const nodeRes = await pool.query(
        `SELECT n.id, n.name, n.cluster_id, c.name as cluster_name FROM nodes n JOIN clusters c ON n.cluster_id = c.id WHERE n.id::text = $1 OR n.name = $1 LIMIT 1`,
        [nodeId]
      );
      if (!nodeRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Node');
      }
      const node = nodeRes.rows[0];

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
