import { Router } from 'express';
import { healthRoutes } from './health.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);

export default apiRouter;
