import { Router } from 'express';
import { AiModelRegistryController } from '../controllers/aiModelRegistry.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';
import { uploadModelFile } from '../middlewares/upload.middleware';

const aiModelRegistryRoutes = Router();

const adminOrSuperAdmin = [authenticateToken, requireRoles('ADMIN', 'SUPER_ADMIN')];
const authenticated = [authenticateToken];

// GET /api/v1/ai-models - List registered models with evaluation metrics (Người dùng đã đăng nhập có thể xem)
aiModelRegistryRoutes.get('/', ...authenticated, AiModelRegistryController.getAllModels);

// POST /api/v1/ai-models/upload - Upload .pth file, benchmark against holdout test, save to DB (ADMIN & SUPER_ADMIN)
aiModelRegistryRoutes.post('/upload', ...adminOrSuperAdmin, uploadModelFile.single('file'), AiModelRegistryController.uploadModel);

// PUT /api/v1/ai-models/:id/activate - Switch active AI model with zero-downtime hot reload (ADMIN & SUPER_ADMIN)
aiModelRegistryRoutes.put('/:id/activate', ...adminOrSuperAdmin, AiModelRegistryController.activateModel);

// POST /api/v1/ai-models/:id/rollback - Rollback to previous active model (ADMIN & SUPER_ADMIN)
aiModelRegistryRoutes.post('/:id/rollback', ...adminOrSuperAdmin, AiModelRegistryController.rollbackModel);

export { aiModelRegistryRoutes };
export default aiModelRegistryRoutes;
