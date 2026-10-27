import { Router } from 'express';
import { DeploymentController } from '../controllers/deployment.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.use((req, res, next) => {
  if (!req.params.clusterId && !req.params.orgId && !(req as any).orgMember) {
    return requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN')(req, res, next);
  }
  next();
});

router.get('/', DeploymentController.getDeployments);

router.get('/:deploymentId', DeploymentController.getDeploymentDetail);

router.get('/:deploymentId/status', DeploymentController.getDeploymentDetail);

router.get('/:deploymentId/replicas', DeploymentController.getReplicaStatus);

export const deploymentRoutes = router;
