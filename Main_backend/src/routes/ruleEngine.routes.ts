import { Router } from 'express';
import { RuleEngineController } from '../controllers/ruleEngine.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const ruleEngineRoutes = Router();

// Protect rule-engine routes with JWT authentication
ruleEngineRoutes.use(authenticateToken);

// POST /api/v1/rule-engine/evaluate - Evaluate telemetry rules and determine anomalies, RCA triggers & action proposals
ruleEngineRoutes.post('/evaluate', RuleEngineController.evaluate);

// GET /api/v1/rule-engine/thresholds - Get current active evaluation thresholds
ruleEngineRoutes.get('/thresholds', RuleEngineController.getThresholds);

export { ruleEngineRoutes };
