import { Router } from 'express';
import { PodController } from '../controllers/pod.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireOrgRole } from '../middlewares/orgAuth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.use((req, res, next) => {
  if (!req.params.clusterId && !req.params.orgId && !(req as any).orgMember) {
    return requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN')(req, res, next);
  }
  next();
});

router.get('/', PodController.getPods);

router.get('/:podId', PodController.getPodDetail);

router.get('/:podId/status', PodController.getPodDetail);

router.post(
  '/:podId/restart',
  (req, res, next) => {
    if ((req as any).orgMember) {
      return requireOrgRole('SME_OWNER', 'DEVOPS')(req, res, next);
    }
    return requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'DEVOPS', 'SME_OWNER')(req, res, next);
  },
  PodController.restartPod
);

export const podRoutes = router;
