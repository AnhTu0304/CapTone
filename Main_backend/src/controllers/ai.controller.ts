import { pool } from '../config/database';
import { Request, Response } from 'express';
import { AiService } from '../services/ai.service';
import { ApiResponse } from '../utils/apiResponse';
import { PredictRequestSchema, RCARequestSchema } from '../schemas/ai.schema';
import { ApiError } from '../utils/apiError';
import {
  AiPredictionModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
  OrganizationMemberModel,
} from '../models';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';

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
  /**
   * Helper: Check if user has Platform Super Admin or Admin privileges
   */
  private static isUserSuperAdmin(user: any): boolean {
    if (!user) return false;
    const r = String(user.role || '').toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SYSTEM_ADMIN') return true;
    if (Array.isArray(user.roles)) {
      if (user.roles.some((x: string) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(String(x).toUpperCase()))) {
        return true;
      }
    }
    if (Array.isArray(user.systemRoles)) {
      if (user.systemRoles.some((x: string) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(String(x).toUpperCase()))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: Check if user belongs to requested organization and if cluster belongs to that organization
   */
  private static async validateUserOrgAndCluster(user: any, orgId?: string, clusterId?: string): Promise<string | null> {
    if (this.isUserSuperAdmin(user)) {
      return (orgId && orgId !== 'all') ? orgId : null;
    }
    const effectiveOrgId = orgId || user?.organization_id;
    if (!effectiveOrgId) {
      return null;
    }
    if (user?.id) {
      const membership = await OrganizationMemberModel.findByOrgAndUser(effectiveOrgId, user.id);
      if (!membership) {
        throw new ApiError(403, 'Bạn không thuộc tổ chức được yêu cầu (User does not belong to the requested organization)');
      }
    }
    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      const belongs = await IncidentModel.validateClusterBelongsToOrg(clusterId, effectiveOrgId);
      if (!belongs) {
        throw new ApiError(404, 'Cụm Kubernetes không thuộc tổ chức này (Cluster does not belong to the requested organization)');
      }
    }
    return effectiveOrgId;
  }

  /**
   * Helper: Check if user has read permission on an incident
   */
  private static async validateIncidentAccess(user: any, incidentId: string): Promise<any> {
    const incident = await IncidentModel.findById(incidentId);
    if (!incident) {
      throw new ApiError(404, 'Sự cố không tồn tại (Incident not found)');
    }
    if (this.isUserSuperAdmin(user)) {
      return incident;
    }
    const orgId = incident.effective_organization_id || incident.organization_id || incident.env_organization_id;
    if (orgId && user?.id) {
      const membership = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);
      if (!membership) {
        throw new ApiError(403, 'Bạn không có quyền truy cập sự cố thuộc tổ chức này');
      }
    }
    return incident;
  }

  /**
   * Helper: Check if user has write/manage permission on an incident (DevOps/Admin/Owner within the org)
   */
  private static async validateIncidentManageAccess(user: any, incidentId: string): Promise<any> {
    const incident = await this.validateIncidentAccess(user, incidentId);
    if (this.isUserSuperAdmin(user)) {
      return incident;
    }
    const orgId = incident.effective_organization_id || incident.organization_id || incident.env_organization_id;
    if (orgId && user?.id) {
      const membership = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);
      if (!membership) {
        throw new ApiError(403, 'Bạn không có quyền quản lý sự cố thuộc tổ chức này');
      }
      const roleCode = (membership.role_code || '').toUpperCase();
      if (roleCode === 'VIEWER') {
        throw new ApiError(403, 'Tài khoản quyền Viewer chỉ có quyền xem, không được cập nhật trạng thái sự cố hoặc áp dụng can thiệp');
      }
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode, error.errors);
      }
      return ApiResponse.error(
        res,
        `Unexpected error during risk prediction: ${(error as Error).message}`,
        500
      );
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode, error.errors);
      }
      return ApiResponse.error(
        res,
        `Unexpected error during RCA evaluation: ${(error as Error).message}`,
        500
      );
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
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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

      let query = `
        SELECT DISTINCT w.name 
        FROM workloads w
        WHERE 1=1
      `;
      const params: any[] = [];
      let idx = 1;
      if (cluster_id && cluster_id !== 'ALL' && cluster_id !== 'all') {
        query += ` AND (w.cluster_id = $${idx} OR w.cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx}))`;
        params.push(cluster_id);
        idx++;
      }
      if (effectiveOrgId) {
        query += ` AND EXISTS (SELECT 1 FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE (c.id::text = w.cluster_id OR c.name = w.cluster_id OR c.cluster_uid = w.cluster_id) AND e.organization_id = $${idx})`;
        params.push(effectiveOrgId);
        idx++;
      }
      query += ` AND w.name NOT IN ('coredns', 'etcd-minikube', 'kindnet', 'kube', 'kube-controller', 'storage-provisioner', 'kube-apiserver-minikube', 'kube-controller-manager-minikube', 'kube-scheduler-minikube', 'selfheal-agent', 'metrics-server')`;
      query += ` ORDER BY w.name ASC`;
      const result = await pool.query(query, params);
      const workloads = result.rows.map((r: any) => r.name);
      return ApiResponse.success(res, 'Retrieved cluster workloads', workloads, 200);
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (prediction.organization_id && user?.id && user.role !== 'SUPER_ADMIN') {
        const membership = await OrganizationMemberModel.findByOrgAndUser(prediction.organization_id, user.id);
        if (!membership) {
          return ApiResponse.error(res, 'Bạn không có quyền truy cập dự đoán thuộc tổ chức này', 403);
        }
      }

      return ApiResponse.success(res, 'Retrieved prediction details', prediction, 200);
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (prediction.organization_id && user?.id && user.role !== 'SUPER_ADMIN') {
        const membership = await OrganizationMemberModel.findByOrgAndUser(prediction.organization_id, user.id);
        if (!membership) {
          return ApiResponse.error(res, 'Bạn không có quyền truy cập dữ liệu chuỗi thời gian của tổ chức này', 403);
        }
      }

      const inputs = await AiPredictionModel.findInputsByPredictionId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${inputs.length} input observations for prediction`,
        inputs,
        200
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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
      return ApiResponse.error(res, (error as Error).message, 500);
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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
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

      // Resolve environment_id
      let environmentId = incident?.environment_id;
      if (!environmentId) {
        const envRes = await pool.query('SELECT id FROM environments LIMIT 1;');
        environmentId = envRes.rows[0]?.id || 'e0000000-0000-0000-0000-000000000001';
      }

      // Resolve action_type_id
      let actionTypeId = rec.action_type_id;
      if (!actionTypeId) {
        const actRes = await pool.query(
          'SELECT id FROM healing_action_types WHERE code = $1 OR name ILIKE $2 LIMIT 1;',
          [rec.recommendation, `%${rec.recommendation}%`]
        );
        actionTypeId = actRes.rows[0]?.id || 'd0000000-0000-0000-0000-000000000001';
      }

      const targetType = incident?.target_type || 'WORKLOAD';
      let targetName = '';
      if (incident?.target_id) {
        const wlRes = await pool.query('SELECT name FROM workloads WHERE id = $1 LIMIT 1;', [incident.target_id]);
        targetName = wlRes.rows[0]?.name || incident.target_id;
      }

      // 2. Insert into healing_actions
      const healingAction = await RecommendationModel.createHealingAction({
        incident_id: rec.incident_id,
        recommendation_id: rec.id,
        environment_id: environmentId,
        action_type_id: actionTypeId,
        target_type: targetType,
        target_name: targetName,
        risk_level: rec.risk_level || 'LOW',
        execution_mode: 'MANUAL',
        approval_status: 'APPROVED',
        execution_status: 'SUCCEEDED',
        requested_by: user?.id,
        executed_by: user?.id,
        result: {
          status: 'SUCCESS',
          action: rec.recommendation,
          target: targetName,
          applied_by: user?.email || 'admin@example.com',
          message:
            String(rec.recommendation || '').toUpperCase().includes('NO_ACTION') || String(rec.recommendation || '').toUpperCase() === 'NO ACTION'
              ? `AI đánh giá dịch vụ ${targetName} đang ổn định trong ngưỡng an toàn, quyết định giữ nguyên trạng thái (NO_ACTION) và tiếp tục giám sát viễn trắc 12 bước.`
              : `Đã khởi chạy lệnh tự phục hồi '${rec.recommendation}' trên dịch vụ ${targetName} và gửi tới Kubernetes Agent thực thi.`,
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Mark recommendation as APPLIED
      const updatedRec = await RecommendationModel.updateStatus(id, 'APPLIED');

      // 4. Mark associated incident as RESOLVED
      if (rec.incident_id) {
        await IncidentModel.updateStatus(rec.incident_id, 'RESOLVED');
      }

      // 5. Resolve actual namespace from workload
      let targetNamespace = 'default';
      try {
        const wlRes = await pool.query(
          `SELECT n.name as namespace_name 
           FROM workloads w 
           LEFT JOIN namespaces n ON n.id = w.namespace_id 
           WHERE w.name = $1 
           LIMIT 1`,
          [targetName]
        );
        if (wlRes.rows.length > 0 && wlRes.rows[0].namespace_name) {
          targetNamespace = wlRes.rows[0].namespace_name;
        } else if (targetName === 'selfheal-test-app') {
          targetNamespace = 'test-lab';
        }
      } catch {
        if (targetName === 'selfheal-test-app') targetNamespace = 'test-lab';
      }

      // 6. Dispatch action to connected K8s Agent for real cluster remediation
      const targetPod = rec.target_id || (rec.incident_title?.includes(' on ') ? rec.incident_title.split(' on ')[1]?.trim() : undefined);
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

      dispatchHealingActionToAgent({
        action_id: healingAction.id,
        action_type: actionType,
        target_name: targetName,
        namespace: targetNamespace,
        params: {
          ...rcaParams,
          ...(req.body?.params || {}),
          ...(req.body || {}),
          pod_name: targetPod || req.body?.pod_name,
          pod_id: targetPod || req.body?.pod_id,
        },
      }).catch((err) => console.warn('[AiController] Failed to dispatch action to agent:', err));

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
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }
}
