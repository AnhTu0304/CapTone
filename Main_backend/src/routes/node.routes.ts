import { Router } from 'express';
import { NodeController } from '../controllers/node.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireOrgRole } from '../middlewares/orgAuth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.get('/:nodeId/metrics', NodeController.getNodeMetrics);

router.use((req, res, next) => {
  if (!req.params.clusterId && !req.params.orgId && !(req as any).orgMember) {
    return requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN')(req, res, next);
  }
  next();
});

router.get('/', NodeController.getNodes);

router.get('/:nodeId', NodeController.getNodeDetail);

router.post(
  '/:nodeId/drain',
  (req, res, next) => {
    if ((req as any).orgMember) {
      return requireOrgRole('SME_OWNER', 'DEVOPS')(req, res, next);
    }
    return requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'DEVOPS', 'SME_OWNER')(req, res, next);
  },
  NodeController.drainNode
);

export const nodeRoutes = router;
