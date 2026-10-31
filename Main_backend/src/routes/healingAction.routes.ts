import { Router } from 'express';
import { HealingActionController } from '../controllers/healingAction.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const healingActionRoutes = Router();

// GET /api/v1/healing/approvals/quick-approve?token=...
// Đặt TRƯỚC authenticateToken vì người dùng click từ Email không có Authorization header
// GET /api/v1/healing/approvals/quick-approve?token=... & quick-reject?token=...
healingActionRoutes.get('/approvals/quick-approve', HealingActionController.quickApproveFromEmail);
healingActionRoutes.get('/approvals/quick-reject', HealingActionController.quickRejectFromEmail);

// Toàn bộ các API Healing Actions yêu cầu xác thực JWT
healingActionRoutes.use(authenticateToken);

const devopsOrAdmin = requireRoles('DEVOPS', 'ADMIN', 'SUPER_ADMIN', 'SME_OWNER');

// ==========================================
// 1. Healing Actions Management
// ==========================================
// GET /api/v1/healing/actions/running - List running/in-flight actions (placed before :id)
healingActionRoutes.get('/actions/running', HealingActionController.getRunningActions);

// GET /api/v1/healing/actions - List actions with filters
healingActionRoutes.get('/actions', HealingActionController.getActions);

// GET /api/v1/healing/actions/:id - Get action detail
healingActionRoutes.get('/actions/:id', HealingActionController.getActionById);

// POST /api/v1/healing/actions - Create action
healingActionRoutes.post('/actions', devopsOrAdmin, HealingActionController.createAction);

// POST /api/v1/healing/actions/:id/execute - Execute/retry action
healingActionRoutes.post('/actions/:id/execute', devopsOrAdmin, HealingActionController.executeAction);

// POST /api/v1/healing/actions/:id/abort - Abort/Cancel in-flight action
healingActionRoutes.post('/actions/:id/abort', devopsOrAdmin, HealingActionController.abortAction);

// PATCH /api/v1/healing/actions/:id/status - Update action status
healingActionRoutes.patch('/actions/:id/status', devopsOrAdmin, HealingActionController.updateActionStatus);

// ==========================================
// 2. Action Types Catalog
// ==========================================
// GET /api/v1/healing/action-types - List action types
healingActionRoutes.get('/action-types', HealingActionController.getActionTypes);

// PUT /api/v1/healing/action-types/:id - Update action type
healingActionRoutes.put('/action-types/:id', devopsOrAdmin, HealingActionController.updateActionType);

// ==========================================
// 3. Self-Healing Policies
// ==========================================
// GET /api/v1/healing/policies - List policies
healingActionRoutes.get('/policies', HealingActionController.getPolicies);

// POST /api/v1/healing/policies - Create new policy
healingActionRoutes.post('/policies', devopsOrAdmin, HealingActionController.createPolicy);
// DELETE /api/v1/healing/policies/:id - Delete policy
healingActionRoutes.delete('/policies/:id', devopsOrAdmin, HealingActionController.deletePolicy);

// PUT /api/v1/healing/policies/:id - Update policy config
healingActionRoutes.put('/policies/:id', devopsOrAdmin, HealingActionController.updatePolicyConfig);

// PATCH /api/v1/healing/policies/:id/toggle - Toggle policy active state
healingActionRoutes.patch('/policies/:id/toggle', devopsOrAdmin, HealingActionController.togglePolicyActive);

// ==========================================
// 4. HITL Approvals
// ==========================================
// GET /api/v1/healing/approvals - List approvals
healingActionRoutes.get('/approvals', HealingActionController.getApprovals);

// POST /api/v1/healing/actions/:id/approve - Approve high-risk action
healingActionRoutes.post('/actions/:id/approve', devopsOrAdmin, HealingActionController.approveAction);

// POST /api/v1/healing/actions/:id/reject - Reject high-risk action
healingActionRoutes.post('/actions/:id/reject', devopsOrAdmin, HealingActionController.rejectAction);

// ==========================================
// 5. Analytics & MTTR
// ==========================================
// GET /api/v1/healing/analytics - Get stats from DB
healingActionRoutes.get('/analytics', HealingActionController.getAnalytics);

// POST /api/v1/healing/actions/:id/notify - Gửi lại email thông báo
healingActionRoutes.post('/actions/:id/notify', devopsOrAdmin, HealingActionController.resendNotification);

export { healingActionRoutes };
