import { pool, resolveSkippedExecutionStatus } from '../config/database';
import { enterOrUpdateDbContext } from '../config/dbContext';
import { Request, Response } from 'express';
import { AiService } from '../services/ai.service';
import { ApiResponse } from '../utils/apiResponse';
import { PredictRequestSchema, RCARequestSchema } from '../schemas/ai.schema';
import { ApiError } from '../utils/apiError';
import { config } from '../config/env';
import { resolveSafeClientErrorMessage, sanitizeForLog } from '../utils/logSanitizer';
import {
  AiPredictionModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
  OrganizationMemberModel,
  WorkloadModel,
} from '../models';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { HealingActionModel } from '../models/healingAction.model';

const ACTION_CODE_MAP: Record<string, string> = {
  'Restart Pod': 'RESTART_POD',
  'Replace Pod': 'REPLACE_POD',
  'Scale Replicas': 'SCALE_REPLICAS',
  'Rollback Deployment': 'ROLLBACK_DEPLOYMENT',
  'Cleanup Temporary Files': 'CLEANUP_STORAGE',
  'Cleanup Storage': 'CLEANUP_STORAGE',
  'Temporary IP Block': 'TEMPORARY_IP_BLOCK',
  'Block IP': 'TEMPORARY_IP_BLOCK',
  'Restart Deployment': 'RESTART_DEPLOYMENT',
  'No Action': 'NO_ACTION',
  RESTART_POD: 'RESTART_POD',
  REPLACE_POD: 'REPLACE_POD',
  'Drain Node': 'DRAIN_NODE',
  DRAIN_NODE: 'DRAIN_NODE',
  SCALE_REPLICAS: 'SCALE_REPLICAS',
  ROLLBACK_DEPLOYMENT: 'ROLLBACK_DEPLOYMENT',
  CLEANUP_STORAGE: 'CLEANUP_STORAGE',
  TEMPORARY_IP_BLOCK: 'TEMPORARY_IP_BLOCK',
  BLOCK_IP: 'TEMPORARY_IP_BLOCK',
  BLOCK_IP_TEMP: 'TEMPORARY_IP_BLOCK',
  BLOCK_SUSPICIOUS_IP: 'TEMPORARY_IP_BLOCK',
  RESTART_DEPLOYMENT: 'RESTART_DEPLOYMENT',
  NO_ACTION: 'NO_ACTION',
};

export class AiController {
  private static respondError(res: Response, error: unknown, tag: string) {
    if (error instanceof ApiError) {
      return ApiResponse.error(res, error.message, error.statusCode, error.errors);
    }
    console.error(tag, sanitizeForLog(error));
    const msg = resolveSafeClientErrorMessage(error, {
      isDevelopment: config.isDevelopment,
      isApiError: false,
      statusCode: 500,
    });
    return ApiResponse.error(res, msg, 500);
  }
  /**
   * Helper: Check if user has Platform Super Admin or Admin privileges
   */
  private static isUserSuperAdmin(user: any): boolean {
    if (!user) return false;
    const r = String(user.role || '').toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'SYSTEM_ADMIN' || r === 'ADMIN') return true;
    if (Array.isArray(user.roles)) {
      if (user.roles.some((x: string) => ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(String(x).toUpperCase()))) {
        return true;
      }
    }
    if (Array.isArray(user.systemRoles)) {
      if (user.systemRoles.some((x: string) => ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(String(x).toUpperCase()))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: Check if user belongs to requested organization and if cluster belongs to that organization
   */
  private static async validateUserOrgAndCluster(user: any, orgId?: string, clusterId?: string): Promise<string | null> {
    if (!user?.id) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập');
    }

    const rawOrgId = typeof orgId === 'string' ? orgId.trim() : '';
    if (!rawOrgId) {
      throw new ApiError(400, 'Thiếu thông tin định danh tổ chức (organization_id) hợp lệ');
    }
    if (rawOrgId.toUpperCase() === 'ALL') {
      throw new ApiError(403, 'Từ chối truy cập: Không hỗ trợ ngữ cảnh tổ chức toàn cục (all)');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawOrgId)) {
      throw new ApiError(400, 'Định dạng định danh tổ chức (organization_id) không hợp lệ');
    }

    const res = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
      [user.id]
    );
    const allowedOrgIds: string[] = res.rows.map((r: any) => r.organization_id);
    if (allowedOrgIds.length === 0 || !allowedOrgIds.includes(rawOrgId)) {
      throw new ApiError(403, 'Bạn không phải thành viên đang hoạt động của tổ chức được yêu cầu');
    }

    enterOrUpdateDbContext({ scope: 'TENANT', organizationId: rawOrgId, userId: user.id });

    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      const belongs = await IncidentModel.validateClusterBelongsToOrg(clusterId, rawOrgId);
      if (!belongs) {
        throw new ApiError(403, 'Cụm Kubernetes không thuộc tổ chức này (Cluster does not belong to the requested organization)');
      }
    }

    return rawOrgId;
  }

  /**
   * Helper: Check if user has read permission on an incident
   */
  private static async validateIncidentAccess(user: any, incidentId: string): Promise<any> {
    const incident = await IncidentModel.findById(incidentId);
    if (!incident) {
      throw new ApiError(404, 'Sự cố không tồn tại (Incident not found)');
    }
    const orgId = incident.effective_organization_id || incident.organization_id || incident.env_organization_id;
    if (!orgId || !user?.id) {
      throw new ApiError(403, 'Bạn không có quyền truy cập sự cố này');
    }
    const membership = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ApiError(403, 'Bạn không có quyền truy cập sự cố thuộc tổ chức này');
    }
    return incident;
  }

  /**
   * Helper: Check if user has write/manage permission on an incident (DevOps/Admin/Owner within the org)
   */
  private static async validateIncidentManageAccess(user: any, incidentId: string): Promise<any> {
    const incident = await this.validateIncidentAccess(user, incidentId);
    const orgId = incident.effective_organization_id || incident.organization_id || incident.env_organization_id;
    const membership = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ApiError(403, 'Bạn không có quyền quản lý sự cố thuộc tổ chức này');
    }
    const roleCode = (membership.role_code || '').toUpperCase();
    if (roleCode === 'VIEWER') {
      throw new ApiError(403, 'Tài khoản quyền Viewer chỉ có quyền xem, không được cập nhật trạng thái sự cố hoặc áp dụng can thiệp');
    }
    return incident;
  }

  /**
   * Health check endpoint to verify AI Backend & GRU model readiness
   * GET /api/v1/ai/health
   */
  public static async getAiHealth(req: Request, res: Response) {
    const healthResult = await AiService.checkAiHealth();

    if (!healthResult.connected) {
      return ApiResponse.error(
        res,
        'AI Backend is not reachable or not ready',
        503,
        { error: healthResult.error }
      );
    }

    return ApiResponse.success(
      res,
      'AI Backend and GRU model are operational',
      healthResult.data,
      200
    );
  }

  /**
   * Predict multi-label risk for a service workload and persist results
   * POST /api/v1/ai/predict
   */
  public static async predict(req: Request, res: Response) {
    const validationResult = PredictRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ApiResponse.error(
        res,
        'Validation failed: Invalid prediction input payload',
        400,
        validationResult.error.format()
      );
    }

    try {
      const user = (req as any).user;
      const orgId = (req.body.organization_id as string | undefined) || user?.organization_id;
      if (validationResult.data.cluster_id || orgId) {
        await AiController.validateUserOrgAndCluster(user, orgId, validationResult.data.cluster_id);
      }

      const result = await AiService.predictRisk(validationResult.data);
      return ApiResponse.success(
        res,
        'Risk prediction evaluated and persisted successfully',
        result,
        201
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController.predict]');
    }
  }

  /**
   * Analyze root cause (RCA), create incident, record evidences and action recommendations
   * POST /api/v1/ai/rca
   */
  public static async analyzeRootCause(req: Request, res: Response) {
    const validationResult = RCARequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ApiResponse.error(
        res,
        'Validation failed: Invalid RCA request payload',
        400,
        validationResult.error.format()
      );
    }

    try {
      const user = (req as any).user;
      const orgId = (req.body.organization_id as string | undefined) || user?.organization_id;
      if (validationResult.data.cluster_id || orgId) {
        await AiController.validateUserOrgAndCluster(user, orgId, validationResult.data.cluster_id);
      }

      const result = await AiService.analyzeRootCause(validationResult.data);
      return ApiResponse.success(
        res,
        'Root cause analysis evaluated, incident opened, and recommendations recorded successfully',
        result,
        201
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController.analyzeRootCause]');
    }
  }

  /**
   * GET /api/v1/ai/models
   * List all registered AI models
   */
  public static async getModels(req: Request, res: Response) {
    try {
      const models = await AiPredictionModel.findAllModels();
      return ApiResponse.success(res, 'Retrieved AI models list', models, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController.getModels]');
    }
  }

  /**
   * GET /api/v1/ai/predictions
   * List risk predictions with filtering & pagination
   */
  public static async getPredictions(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const status = req.query.status as string | undefined;
      const prediction_type = req.query.prediction_type as string | undefined;
      const cluster_id = req.query.cluster_id as string | undefined;

      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      const result = await AiPredictionModel.findMany({
        limit,
        offset,
        status,
        prediction_type,
        cluster_id,
        organization_id: effectiveOrgId || undefined,
      });

      return ApiResponse.success(res, 'Retrieved predictions list', result, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/predictions/stats
   * Aggregated statistics of predictions
   */
  public static async getPredictionStats(req: Request, res: Response) {
    try {
      const cluster_id = req.query.cluster_id as string | undefined;
      const workload = (req.query.workload as string) || (req.query.service_id as string) || undefined;

      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      const stats = await AiPredictionModel.getPredictionStats(cluster_id, workload, effectiveOrgId || undefined);
      return ApiResponse.success(res, 'Retrieved prediction statistics', stats, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/workloads
   * Retrieve list of workloads/services for a specific cluster or all clusters
   */
  public static async getWorkloads(req: Request, res: Response) {
    try {
      const cluster_id = req.query.cluster_id as string | undefined;
      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      let clusterFilterWorkloads = '';
      let clusterFilterPods = '';
      let clusterFilterIncidents = '';
      const params: any[] = [];
      let idx = 1;
      if (cluster_id && cluster_id !== 'ALL' && cluster_id !== 'all') {
        clusterFilterWorkloads = ` AND (w.cluster_id = $${idx} OR w.cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx}))`;
        clusterFilterPods = ` AND (p.cluster_id::text = $${idx} OR p.cluster_id IN (SELECT id FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx}))`;
        clusterFilterIncidents = ` AND (i.cluster_id::text = $${idx} OR i.cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx}))`;
        params.push(cluster_id);
        idx++;
      }
      let orgFilterWorkloads = '';
      let orgFilterPods = '';
      let orgFilterIncidents = '';
      if (effectiveOrgId) {
        orgFilterWorkloads = ` AND EXISTS (SELECT 1 FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE (c.id::text = w.cluster_id OR c.name = w.cluster_id OR c.cluster_uid = w.cluster_id) AND e.organization_id = $${idx})`;
        orgFilterPods = ` AND EXISTS (SELECT 1 FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE c.id = p.cluster_id AND e.organization_id = $${idx})`;
        orgFilterIncidents = ` AND i.organization_id = $${idx}`;
        params.push(effectiveOrgId);
        idx++;
      }

      const query = `
        SELECT DISTINCT name FROM (
          SELECT w.name 
          FROM workloads w
          WHERE w.deleted_at IS NULL ${clusterFilterWorkloads} ${orgFilterWorkloads}
          UNION
          SELECT COALESCE(NULLIF(p.labels->>'app.kubernetes.io/name', ''), NULLIF(p.labels->>'k8s-app', ''), NULLIF(p.labels->>'app', ''), regexp_replace(p.name, '(-[a-z0-9]{5}|-\\d+)$', '')) AS name
          FROM pods p
          WHERE p.deleted_at IS NULL ${clusterFilterPods} ${orgFilterPods}
          UNION
          SELECT i.target_name AS name
          FROM incidents i
          WHERE i.status = 'OPEN' AND i.target_name IS NOT NULL AND i.target_name != '' ${clusterFilterIncidents} ${orgFilterIncidents}
        ) combined_workloads
        WHERE name IS NOT NULL AND name != '' AND name NOT LIKE '%-0000-%'
        ORDER BY name ASC
      `;
      const result = await pool.query(query, params);
      const CANONICAL_MAP: Record<string, string> = {
        'otel-collector-opentelemetry-collector': 'opentelemetry-collector',
        'prometheus-kube-prometheus-operator': 'kube-prometheus-stack-operator',
        'kube-prometheus-stack-prometheus-operator': 'kube-prometheus-stack-operator',
        'prometheus-kube-state-metrics': 'kube-state-metrics',
        'prometheus-prometheus-node-exporter': 'prometheus-node-exporter',
        'kube-dns': 'coredns',
        'ecommerce-store': 'ecommerce-store-app',
      };
      const workloadSet = new Set<string>();
      result.rows.forEach((r: any) => {
        let name = (r.name || '').trim();
        if (CANONICAL_MAP[name]) name = CANONICAL_MAP[name];
        if (name && !name.includes('-0000-')) workloadSet.add(name);
      });
      const workloads = Array.from(workloadSet).sort();
      return ApiResponse.success(res, 'Retrieved cluster workloads', workloads, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/predictions/:id
   * Get prediction detail by ID
   */
  public static async getPredictionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const prediction = await AiPredictionModel.findById(id);
      if (!prediction) {
        return ApiResponse.error(res, 'Prediction not found', 404);
      }

      const user = (req as any).user;
      if (!prediction.organization_id || !user?.id) {
        return ApiResponse.error(res, 'Không thể xác minh quyền sở hữu tổ chức của dự đoán này', 403);
      }
      const membership = await OrganizationMemberModel.findByOrgAndUser(prediction.organization_id, user.id);
      if (!membership || membership.status !== 'ACTIVE') {
        return ApiResponse.error(res, 'Bạn không có quyền truy cập dự đoán thuộc tổ chức này', 403);
      }

      return ApiResponse.success(res, 'Retrieved prediction details', prediction, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/predictions/:id/inputs
   * Get 12 timesteps input sequence for prediction
   */
  public static async getPredictionInputs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const prediction = await AiPredictionModel.findById(id);
      if (!prediction) {
        return ApiResponse.error(res, 'Prediction not found', 404);
      }

      const user = (req as any).user;
      if (!prediction.organization_id || !user?.id) {
        return ApiResponse.error(res, 'Không thể xác minh quyền sở hữu tổ chức của dữ liệu chuỗi thời gian này', 403);
      }
      const membership = await OrganizationMemberModel.findByOrgAndUser(prediction.organization_id, user.id);
      if (!membership || membership.status !== 'ACTIVE') {
        return ApiResponse.error(res, 'Bạn không có quyền truy cập dữ liệu chuỗi thời gian của tổ chức này', 403);
      }

      const inputs = await AiPredictionModel.findInputsByPredictionId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${inputs.length} input observations for prediction`,
        inputs,
        200
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/incidents
   * List incidents with filtering & pagination
   */
  public static async getIncidents(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const cluster_id = req.query.cluster_id as string | undefined;
      const search = req.query.search as string | undefined;

      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      const result = await IncidentModel.findMany({
        limit,
        offset,
        status,
        severity,
        cluster_id,
        organization_id: effectiveOrgId || undefined,
        search,
      });

      return ApiResponse.success(res, 'Retrieved incidents list', result, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id
   * Get incident detail by ID (including RCA)
   */
  public static async getIncidentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const incident = await AiController.validateIncidentAccess(user, id);
      return ApiResponse.success(res, 'Retrieved incident details', incident, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * PATCH /api/v1/ai/incidents/:id/status
   * Update incident status (e.g. INVESTIGATING, RESOLVED, IGNORED)
   */
  public static async updateIncidentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return ApiResponse.error(res, 'Missing status field in request body', 400);
      }

      const user = (req as any).user;
      await AiController.validateIncidentManageAccess(user, id);

      const updated = await IncidentModel.updateStatus(id, status);
      if (!updated) {
        return ApiResponse.error(res, 'Incident not found', 404);
      }

      return ApiResponse.success(res, 'Updated incident status successfully', updated, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id/evidences
   * Get RCA evidence items for an incident
   */
  public static async getIncidentEvidences(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      await AiController.validateIncidentAccess(user, id);

      const evidences = await RcaModel.findEvidencesByIncidentId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${evidences.length} RCA evidence records`,
        evidences,
        200
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id/recommendations
   * Get recommendations for an incident
   */
  public static async getIncidentRecommendations(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      await AiController.validateIncidentAccess(user, id);

      const recommendations = await RecommendationModel.findByIncidentId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${recommendations.length} recommendations for incident`,
        recommendations,
        200
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/recommendations
   * List recommendations across incidents
   */
  public static async getRecommendations(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cluster_id = req.query.cluster_id as string | undefined;

      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      const result = await RecommendationModel.getRecent(limit, cluster_id, undefined, effectiveOrgId || undefined);
      return ApiResponse.success(res, 'Retrieved recommendations list', result, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * GET /api/v1/ai/healing-action-types
   * List all healing action types
   */
  public static async getHealingActionTypes(req: Request, res: Response) {
    try {
      const actionTypes = await RecommendationModel.findAllActionTypes();
      return ApiResponse.success(
        res,
        'Retrieved healing action types',
        actionTypes,
        200
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController.getModels]');
    }
  }

  /**
   * GET /api/v1/ai/healing-actions
   * List executed self-healing actions from healing_actions table
   */
  public static async getHealingActions(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cluster_id = req.query.cluster_id as string | undefined;

      const user = (req as any).user;
      const requestedOrgId = (req.query.organization_id as string | undefined) || user?.organization_id;
      const effectiveOrgId = await AiController.validateUserOrgAndCluster(user, requestedOrgId, cluster_id);

      const actions = await RecommendationModel.getHealingActions(limit, cluster_id, effectiveOrgId || undefined);
      return ApiResponse.success(res, 'Retrieved executed healing actions', actions, 200);
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }

  /**
   * POST /api/v1/ai/recommendations/:id/apply
   * Mark recommendation as applied and insert an audit record into healing_actions
   */
  public static async applyRecommendation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rec = await RecommendationModel.findById(id);
      if (!rec) {
        return ApiResponse.error(res, 'Recommendation not found', 404);
      }

      // Check organization manage permissions on incident
      const user = (req as any).user;
      if (rec.incident_id) {
        await AiController.validateIncidentManageAccess(user, rec.incident_id);
      }

      // 1. Fetch incident details to bind environment_id and target workload
      let incident: any = null;
      if (rec.incident_id) {
        incident = await IncidentModel.findById(rec.incident_id);
      }

      // Resolve strict environment_id without arbitrary cross-tenant fallback
      const environmentId = incident?.environment_id;
      if (!environmentId) {
        throw new ApiError(
          400,
          'Sự cố chưa gắn environment_id hợp lệ; từ chối fallback sang môi trường mặc định để bảo toàn cô lập tenant.'
        );
      }

      // Resolve action_type_id & HITL default requirement
      let actionTypeId = rec.action_type_id;
      let requiresApprovalByDefault = false;
      if (!actionTypeId) {
        const actRes = await pool.query(
          'SELECT id, requires_approval_by_default FROM healing_action_types WHERE code = $1 OR name ILIKE $2 LIMIT 1;',
          [rec.recommendation, `%${rec.recommendation}%`]
        );
        actionTypeId = actRes.rows[0]?.id || 'd0000000-0000-0000-0000-000000000001';
        requiresApprovalByDefault = Boolean(actRes.rows[0]?.requires_approval_by_default);
      } else {
        const typeRes = await pool.query(
          'SELECT requires_approval_by_default FROM healing_action_types WHERE id = $1 LIMIT 1;',
          [actionTypeId]
        );
        requiresApprovalByDefault = Boolean(typeRes.rows[0]?.requires_approval_by_default);
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetType = incident?.target_type || 'WORKLOAD';
      const rawTitleTarget = rec.incident_title?.includes(' on ')
        ? rec.incident_title.split(' on ')[1]?.trim()
        : (rec.incident_title?.includes(' trên ') ? rec.incident_title.split(' trên ')[1]?.trim() : '');
      const rawLookupKey =
        incident?.workload_name ||
        incident?.target_name ||
        (incident?.target_id && !uuidRegex.test(String(incident.target_id)) ? incident.target_id : '') ||
        rawTitleTarget ||
        (rec.target_id && !uuidRegex.test(String(rec.target_id)) ? rec.target_id : '') ||
        '';
      const resolvedTarget = await WorkloadModel.resolveK8sTarget(rawLookupKey, incident?.cluster_id || null);
      const targetName = resolvedTarget.targetName || rawLookupKey || 'unknown-service';
      const validTargetWorkloadId =
        resolvedTarget.workloadId && uuidRegex.test(resolvedTarget.workloadId)
          ? resolvedTarget.workloadId
          : (incident?.target_id && uuidRegex.test(String(incident.target_id)) ? String(incident.target_id) : null);

      // 2. Insert into healing_actions
      const isNoAction =
        String(rec.recommendation || '').toUpperCase().includes('NO_ACTION') ||
        String(rec.recommendation || '').toUpperCase() === 'NO ACTION';
      const riskLevelUpper = String(rec.risk_level || 'LOW').toUpperCase();
      const requiresHitlApproval =
        !isNoAction && (['HIGH', 'CRITICAL'].includes(riskLevelUpper) || requiresApprovalByDefault);
      const approvalStatus = requiresHitlApproval ? 'PENDING' : 'APPROVED';
      const initialExecStatus = isNoAction ? await resolveSkippedExecutionStatus() : 'PENDING';

      // Concurrency Lock: Prevent simultaneous RUNNING actions on the same target (Resolves DEF-04 concurrency bug: 2 actions RUNNING at 01:41:35)
      if (!isNoAction) {
        const runningCheck = await pool.query(
          `SELECT h.id, t.code AS action_type_code, h.execution_status, h.created_at 
           FROM healing_actions h
           LEFT JOIN healing_action_types t ON t.id = h.action_type_id
           WHERE h.execution_status IN ('RUNNING', 'PENDING')
             AND (
               (h.target_name IS NOT NULL AND h.target_name = $1)
               OR (h.incident_id IS NOT NULL AND h.incident_id = $2)
             )
           LIMIT 1;`,
          [targetName, rec.incident_id]
        );
        if (runningCheck.rows.length > 0) {
          const activeAction = runningCheck.rows[0];
          return res.status(409).json({
            success: false,
            message: `Mục tiêu '${targetName}' hiện đang có hành động tự phục hồi '${activeAction.action_type_code || 'REMEDIATION'}' ở trạng thái ${activeAction.execution_status}. Không thể chạy đồng thời 2 hành động. Vui lòng chờ hành động trước hoàn tất hoặc bị hủy.`,
            data: { running_action_id: activeAction.id },
          });
        }
      }

      const healingAction = await RecommendationModel.createHealingAction({
        incident_id: rec.incident_id,
        recommendation_id: rec.id,
        environment_id: environmentId,
        action_type_id: actionTypeId,
        target_type: targetType,
        target_id: validTargetWorkloadId,
        target_name: targetName,
        risk_level: rec.risk_level || 'LOW',
        execution_mode: 'MANUAL',
        approval_status: approvalStatus,
        execution_status: initialExecStatus,
        requested_by: user?.id,
        executed_by: requiresHitlApproval ? undefined : user?.id,
        result: {
          status: isNoAction
            ? 'SKIPPED'
            : requiresHitlApproval
              ? 'PENDING_APPROVAL'
              : 'PENDING_DISPATCH',
          action: rec.recommendation,
          target: targetName,
          applied_by: user?.email || 'admin@example.com',
          message:
            isNoAction
              ? `AI đánh giá dịch vụ ${targetName} đang ổn định trong ngưỡng an toàn, quyết định giữ nguyên trạng thái (NO_ACTION) và tiếp tục giám sát viễn trắc 12 bước.`
              : requiresHitlApproval
                ? `Khuyến nghị '${rec.recommendation}' trên dịch vụ ${targetName} có rủi ro ${riskLevelUpper} và đang chờ phê duyệt HITL trước khi gửi tới Kubernetes Agent.`
                : `Đang chuyển lệnh tự phục hồi '${rec.recommendation}' trên dịch vụ ${targetName} tới Kubernetes Agent thực thi.`,
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Mark recommendation as APPLIED (incident stays OPEN until post-action telemetry verification confirms recovery)
      const updatedRec = await RecommendationModel.updateStatus(id, 'APPLIED');

      if (requiresHitlApproval) {
        return ApiResponse.success(
          res,
          `Recommendation '${rec.recommendation}' requires HITL approval before execution on target '${targetName}'.`,
          {
            recommendation: updatedRec,
            healing_action: healingAction,
            hitl_required: true,
          },
          202
        );
      }

      // 5. Resolve actual namespace from workload / incident
      let targetNamespace = 'default';
      if (resolvedTarget.namespace && resolvedTarget.namespace !== 'default') {
        targetNamespace = resolvedTarget.namespace;
      } else if (incident?.namespace) {
        targetNamespace = incident.namespace;
      } else if (resolvedTarget.namespace) {
        targetNamespace = resolvedTarget.namespace;
      }

      // 6. Dispatch action to connected K8s Agent for real cluster remediation
      const targetPod = incident?.actual_pod_name || rec.target_id || rawTitleTarget || undefined;
      const actionType = ACTION_CODE_MAP[rec.recommendation] || (rec.recommendation === 'Restart Pod' ? 'RESTART_POD' : rec.recommendation);

      // Extract parameters & playbook from RCA analysis_result if available
      let rcaParams: any = {};
      let manualPlaybook: string[] = [];
      try {
        const rcaRes = await pool.query(
          'SELECT analysis_result FROM rca_analyses WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1;',
          [rec.incident_id]
        );
        if (rcaRes.rows.length > 0 && rcaRes.rows[0].analysis_result) {
          const parsed = typeof rcaRes.rows[0].analysis_result === 'string'
            ? JSON.parse(rcaRes.rows[0].analysis_result)
            : rcaRes.rows[0].analysis_result;
          rcaParams = parsed?.recommendation?.action_parameters || {};
          manualPlaybook = rcaParams?.manual_playbook || [];
        }
      } catch (err) {
        console.warn('[AiController] Could not parse rca action_parameters:', err);
      }

      if (actionType === 'NO_ACTION') {
        console.log(`🛡️ [AiController] Recommendation '${rec.recommendation}' is NO_ACTION (Circuit Breaker / Manual Playbook). Skipping agent dispatch.`);
        return ApiResponse.success(
          res,
          `Applied acknowledgement for recommendation '${rec.recommendation}'. Circuit breaker active - manual intervention requested via playbook.`,
          {
            recommendation: updatedRec,
            healing_action: healingAction,
            manual_playbook: manualPlaybook,
          },
          200
        );
      }

      const execLock = await HealingActionModel.executeAction(healingAction.id, user?.id || undefined);
      const attemptId = execLock?.attempt?.id || null;

      const dispatchRes = await dispatchHealingActionToAgent({
        action_id: healingAction.id,
        action_type: actionType,
        target_name: targetName,
        namespace: targetNamespace,
        cluster_id: incident?.cluster_id || undefined,
        environment_id: environmentId,
        organization_id: incident?.organization_id || undefined,
        params: {
          ...rcaParams,
          ...(req.body?.params || {}),
          ...(req.body || {}),
          pod_name: targetPod || req.body?.pod_name,
          pod_id: targetPod || req.body?.pod_id,
        },
      });

      if (!dispatchRes.dispatched) {
        await HealingActionModel.recordDispatchFailure(
          healingAction.id,
          attemptId,
          'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
          { reason: dispatchRes.reason || 'NO_MATCHING_AGENT' }
        );
      } else {
        const timeoutHandle = setTimeout(async () => {
          try {
            await HealingActionModel.recordDispatchFailure(
              healingAction.id,
              attemptId,
              'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
              { timeout: true }
            );
          } catch {}
        }, 60000);
        if (typeof timeoutHandle.unref === 'function') {
          timeoutHandle.unref();
        }
      }

      return ApiResponse.success(
        res,
        `Applied recommendation '${rec.recommendation}' and executed healing action successfully`,
        {
          recommendation: updatedRec,
          healing_action: healingAction,
        },
        200
      );
    } catch (error) {
      return AiController.respondError(res, error, '[AiController]');
    }
  }
}
