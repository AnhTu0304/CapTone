import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';

const aiRoutes = Router();

// GET /api/v1/ai/health - Verify connection to AI Backend & GRU Model
aiRoutes.get('/health', AiController.getAiHealth);

// POST /api/v1/ai/predict - Run GRU risk prediction and persist to database
aiRoutes.post('/predict', AiController.predict);

// POST /api/v1/ai/rca - Run Root Cause Analysis, open incident & record recommendations
aiRoutes.post('/rca', AiController.analyzeRootCause);

export { aiRoutes };
