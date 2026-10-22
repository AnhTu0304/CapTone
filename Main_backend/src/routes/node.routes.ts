import { Router } from 'express';
import { NodeController } from '../controllers/node.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

/**
 * [GET] /api/v1/nodes hoặc /api/v1/clusters/:clusterId/nodes
 * Lấy danh sách Node máy chủ Kubernetes
 */
router.get('/', NodeController.getNodes);

/**
 * [GET] /api/v1/nodes/:nodeId
 * Lấy chi tiết Node máy chủ kèm Pods đang chạy
 */
router.get('/:nodeId', NodeController.getNodeDetail);

/**
 * [POST] /api/v1/nodes/:nodeId/drain
 * Tháo tải an toàn (Drain) cho Node
 */
router.post('/:nodeId/drain', NodeController.drainNode);

export const nodeRoutes = router;
