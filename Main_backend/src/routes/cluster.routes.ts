import { Router } from 'express';
import { ClusterController } from '../controllers/cluster.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireOrgMember, requireOrgRole } from '../middlewares/orgAuth.middleware';
import { nodeRoutes } from './node.routes';
import { podRoutes } from './pod.routes';

// Router nhận orgId từ parent router
const router = Router({ mergeParams: true });

router.use(authenticateToken);

/**
 * [GET] /api/v1/organizations/:orgId/clusters
 * Lấy danh sách cụm Kubernetes của tổ chức
 */
router.get('/', requireOrgMember, ClusterController.getByOrg);

/**
 * [GET] /api/v1/organizations/:orgId/clusters/:clusterId
 * Lấy chi tiết toàn diện cụm Kubernetes
 */
router.get('/:clusterId', requireOrgMember, ClusterController.getDetail);

/**
 * [POST] /api/v1/organizations/:orgId/clusters
 * Đăng ký cụm mới
 */
router.post(
  '/',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.create
);

/**
 * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/rotate-token
 * Xoay vòng hoặc tạo mới Token Agent cho cụm K8s
 */
router.post(
  '/:clusterId/rotate-token',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.rotateToken
);

/**
 * [DELETE] /api/v1/organizations/:orgId/clusters/:clusterId/tokens/:tokenId
 * Thu hồi một Token Agent
 */
router.delete(
  '/:clusterId/tokens/:tokenId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.revokeToken
);

/**
 * [PUT] /api/v1/organizations/:orgId/clusters/:clusterId/agent-config
 * Cập nhật cấu hình Agent
 */
router.put(
  '/:clusterId/agent-config',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.updateConfig
);

/**
 * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/connect-agent
 * Kích hoạt / Mô phỏng kết nối Agent
 */
router.post(
  '/:clusterId/connect-agent',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.connectAgent
);

/**
 * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/disconnect-agent
 * Ngắt kết nối Agent
 */
router.post(
  '/:clusterId/disconnect-agent',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.disconnectAgent
);

/**
 * [DELETE] /api/v1/organizations/:orgId/clusters/:clusterId
 * Xóa cấu hình Cụm Kubernetes
 */
router.delete(
  '/:clusterId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.removeCluster
);

// Tuyến đường độc lập cho Nodes và Pods theo cụm
router.use('/:clusterId/nodes', nodeRoutes);
router.use('/:clusterId/pods', podRoutes);

export const clusterRoutes = router;

// Global router cho direct access
const globalRouter = Router();
globalRouter.use(authenticateToken);
globalRouter.get('/', ClusterController.getAll);
globalRouter.get('/:clusterId', ClusterController.getDetail);
globalRouter.use('/:clusterId/nodes', nodeRoutes);
globalRouter.use('/:clusterId/pods', podRoutes);
globalRouter.post('/:clusterId/rotate-token', ClusterController.rotateToken);
globalRouter.delete('/:clusterId/tokens/:tokenId', ClusterController.revokeToken);
globalRouter.put('/:clusterId/agent-config', ClusterController.updateConfig);
globalRouter.post('/:clusterId/connect-agent', ClusterController.connectAgent);
globalRouter.post('/:clusterId/disconnect-agent', ClusterController.disconnectAgent);
globalRouter.delete('/:clusterId', ClusterController.removeCluster);

export const clusterGlobalRoutes = globalRouter;
