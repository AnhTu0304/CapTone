import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { aiRoutes } from './ai.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/ai', aiRoutes);

export default apiRouter;
