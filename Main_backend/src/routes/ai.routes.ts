import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const aiRoutes = Router();

// GET /api/v1/ai/health - Verify connection to AI Backend & GRU Model (Public health check)
aiRoutes.get('/health', AiController.getAiHealth);

// POST /api/v1/ai/predict - Run GRU risk prediction and persist to database (Protected)
aiRoutes.post('/predict', authenticateToken, AiController.predict);

// POST /api/v1/ai/rca - Run Root Cause Analysis, open incident & record recommendations (Protected)
aiRoutes.post('/rca', authenticateToken, AiController.analyzeRootCause);

export { aiRoutes };
