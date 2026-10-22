import { Router } from 'express';
import { PodController } from '../controllers/pod.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

/**
 * [GET] /api/v1/pods hoặc /api/v1/clusters/:clusterId/pods
 * Lấy danh sách Pods Kubernetes
 */
router.get('/', PodController.getPods);

/**
 * [GET] /api/v1/pods/:podId
 * Lấy thông tin chi tiết một Pod
 */
router.get('/:podId', PodController.getPodDetail);

/**
 * [POST] /api/v1/pods/:podId/restart
 * Khởi động lại một Pod
 */
router.post('/:podId/restart', PodController.restartPod);

export const podRoutes = router;
