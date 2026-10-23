import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const aiRoutes = Router();

// ==========================================
// 1. Health & Verification Core (Public)
// ==========================================

// GET /api/v1/ai/health - Verify connection to AI Backend & GRU Model (Public)
aiRoutes.get('/health', AiController.getAiHealth);

// ==========================================
// 2. Roles middleware
// ==========================================
const devopsOrAdmin = [authenticateToken, requireRoles('DEVOPS', 'ADMIN')];
const authenticated = [authenticateToken];

// POST /api/v1/ai/predict - Run GRU risk prediction and persist to database
aiRoutes.post('/predict', ...devopsOrAdmin, AiController.predict);

// POST /api/v1/ai/rca - Run Root Cause Analysis, open incident & record recommendations
aiRoutes.post('/rca', ...devopsOrAdmin, AiController.analyzeRootCause);

// ==========================================
// 3. AI Models Management
// ==========================================

// GET /api/v1/ai/models - List registered AI models
aiRoutes.get('/models', ...authenticated, AiController.getModels);

// ==========================================
// 4. Predictions & Inputs
// ==========================================

// GET /api/v1/ai/predictions - List historical predictions (filtering, pagination)
aiRoutes.get('/predictions', ...authenticated, AiController.getPredictions);

// GET /api/v1/ai/predictions/stats - Statistics on prediction types & confidence
aiRoutes.get('/predictions/stats', ...authenticated, AiController.getPredictionStats);

// GET /api/v1/ai/predictions/:id - Get prediction detail
aiRoutes.get('/predictions/:id', ...authenticated, AiController.getPredictionById);

// GET /api/v1/ai/predictions/:id/inputs - Get 12 timesteps input sequence
aiRoutes.get('/predictions/:id/inputs', ...authenticated, AiController.getPredictionInputs);

// ==========================================
// 5. Incidents & RCA Evidences
// ==========================================

// GET /api/v1/ai/incidents - List incidents (filtering, pagination)
aiRoutes.get('/incidents', ...authenticated, AiController.getIncidents);

// GET /api/v1/ai/incidents/:id - Get incident details with RCA summary
aiRoutes.get('/incidents/:id', ...authenticated, AiController.getIncidentById);

// PATCH /api/v1/ai/incidents/:id/status - Update incident status (OPEN, RESOLVED, IGNORED)
aiRoutes.patch('/incidents/:id/status', ...devopsOrAdmin, AiController.updateIncidentStatus);

// GET /api/v1/ai/incidents/:id/evidences - List RCA evidence logs/events
aiRoutes.get('/incidents/:id/evidences', ...authenticated, AiController.getIncidentEvidences);

// GET /api/v1/ai/incidents/:id/recommendations - List recommendations for incident
aiRoutes.get('/incidents/:id/recommendations', ...authenticated, AiController.getIncidentRecommendations);

// ==========================================
// 6. Recommendations & Healing Actions
// ==========================================

// GET /api/v1/ai/recommendations - List recommendations
aiRoutes.get('/recommendations', ...authenticated, AiController.getRecommendations);

// GET /api/v1/ai/healing-action-types - List 7 healing action types
aiRoutes.get('/healing-action-types', ...authenticated, AiController.getHealingActionTypes);

// GET /api/v1/ai/healing-actions - List executed self-healing actions
aiRoutes.get('/healing-actions', ...authenticated, AiController.getHealingActions);

// POST /api/v1/ai/recommendations/:id/apply - Apply recommendation
aiRoutes.post('/recommendations/:id/apply', ...devopsOrAdmin, AiController.applyRecommendation);

export { aiRoutes };
