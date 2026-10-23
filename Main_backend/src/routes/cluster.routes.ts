import { Router } from 'express';
import { ClusterController } from '../controllers/cluster.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireOrgMember, requireOrgRole } from '../middlewares/orgAuth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { nodeRoutes } from './node.routes';
import { podRoutes } from './pod.routes';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.get('/', requireOrgMember, ClusterController.getByOrg);

router.get('/:clusterId', requireOrgMember, ClusterController.getDetail);

router.post(
  '/',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.create
);

router.post(
  '/:clusterId/rotate-token',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.rotateToken
);

router.delete(
  '/:clusterId/tokens/:tokenId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.revokeToken
);

router.put(
  '/:clusterId/agent-config',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.updateConfig
);

router.post(
  '/:clusterId/connect-agent',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.connectAgent
);

router.post(
  '/:clusterId/disconnect-agent',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.disconnectAgent
);

router.delete(
  '/:clusterId',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  ClusterController.removeCluster
);

router.use('/:clusterId/nodes', requireOrgMember, nodeRoutes);
router.use('/:clusterId/pods', requireOrgMember, podRoutes);

export const clusterRoutes = router;

const globalRouter = Router();
globalRouter.use(authenticateToken);
globalRouter.use(requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'));
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
