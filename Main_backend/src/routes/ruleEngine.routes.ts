import { Router } from 'express';
import { RuleEngineController } from '../controllers/ruleEngine.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const ruleEngineRoutes = Router();

// Protect rule-engine routes with JWT authentication & DEVOPS/ADMIN roles
// (Viewer is prohibited from configuration and evaluation triggers)
ruleEngineRoutes.use(authenticateToken);
ruleEngineRoutes.use(requireRoles('DEVOPS', 'ADMIN'));

// POST /api/v1/rule-engine/evaluate - Evaluate telemetry rules and determine anomalies, RCA triggers & action proposals
ruleEngineRoutes.post('/evaluate', RuleEngineController.evaluate);

// GET /api/v1/rule-engine/thresholds - Get current active evaluation thresholds
ruleEngineRoutes.get('/thresholds', RuleEngineController.getThresholds);

export { ruleEngineRoutes };
