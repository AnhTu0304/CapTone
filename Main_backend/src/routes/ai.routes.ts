import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';

const aiRoutes = Router();

// GET /api/v1/ai/health - Verify connection to AI Backend & GRU Model
aiRoutes.get('/health', AiController.getAiHealth);

export { aiRoutes };
