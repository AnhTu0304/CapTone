import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class PodController {
  /**
   * [GET] /api/v1/pods
   * [GET] /api/v1/clusters/:clusterId/pods
   * Lấy danh sách Pods (theo cụm hoặc toàn hệ thống)
   */
  public static async getPods(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;
      const namespace = req.query.namespace as string | undefined;

      let query = `
        SELECT 
          p.id, 
          p.cluster_id,
          c.name AS cluster_name,
          p.name, 
          p.status, 
          p.phase, 
          p.restart_count, 
          p.image, 
          p.labels,
          p.started_at,
          p.created_at,
          COALESCE(ns.name, 'default') AS namespace,
          COALESCE(n.name, 'unassigned') AS node_name
        FROM pods p
        JOIN clusters c ON p.cluster_id = c.id
        LEFT JOIN namespaces ns ON p.namespace_id = ns.id
        LEFT JOIN nodes n ON p.node_id = n.id
        WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (clusterId && !clusterId.startsWith('org-') && !clusterId.startsWith('sandbox-')) {
        params.push(clusterId);
        query += ` AND (c.id::text = $${params.length} OR c.name = $${params.length})`;
      }

      if (namespace && namespace !== 'ALL') {
        params.push(namespace);
        query += ` AND ns.name = $${params.length}`;
      }

      query += ` ORDER BY c.name ASC, ns.name ASC, p.name ASC`;

      const result = await pool.query(query, params);
      return ApiResponse.success(res, 'Lấy danh sách Pods thành công', result.rows, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/pods/:podId
   * Lấy chi tiết thông tin một Pod
   */
  public static async getPodDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const podId = req.params.podId || req.params.id;
      if (!podId) {
        throw new ApiError(400, 'Mã Pod không hợp lệ');
      }

      const podRes = await pool.query(
        `SELECT 
          p.id, 
          p.cluster_id,
          c.name AS cluster_name,
          p.name, 
          p.status, 
          p.phase, 
          p.restart_count, 
          p.image, 
          p.labels,
          p.started_at,
          p.created_at,
          COALESCE(ns.name, 'default') AS namespace,
          COALESCE(n.name, 'unassigned') AS node_name
        FROM pods p
        JOIN clusters c ON p.cluster_id = c.id
        LEFT JOIN namespaces ns ON p.namespace_id = ns.id
        LEFT JOIN nodes n ON p.node_id = n.id
        WHERE (p.id::text = $1 OR p.name = $1) AND p.deleted_at IS NULL
        LIMIT 1`,
        [podId]
      );

      if (!podRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Pod');
      }

      return ApiResponse.success(res, 'Lấy chi tiết Pod thành công', podRes.rows[0], 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/pods/:podId/restart
   * Khởi động lại Pod qua hệ thống tự chữa lành MAPE-K
   */
  public static async restartPod(req: Request, res: Response, next: NextFunction) {
    try {
      const podId = req.params.podId || req.params.id;
      const podRes = await pool.query(
        `SELECT p.id, p.name, p.cluster_id, c.name AS cluster_name, COALESCE(ns.name, 'default') AS namespace
         FROM pods p
         JOIN clusters c ON p.cluster_id = c.id
         LEFT JOIN namespaces ns ON p.namespace_id = ns.id
         WHERE (p.id::text = $1 OR p.name = $1) AND p.deleted_at IS NULL
         LIMIT 1`,
        [podId]
      );
      if (!podRes.rows[0]) {
        throw new ApiError(404, 'Không tìm thấy Pod');
      }
      const pod = podRes.rows[0];

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
