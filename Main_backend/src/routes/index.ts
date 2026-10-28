import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { aiRoutes } from './ai.routes';
import { healingActionRoutes } from './healingAction.routes';
import { ruleEngineRoutes } from './ruleEngine.routes';
import { telemetryRoutes } from './telemetry.routes';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { systemRoleRoutes } from './systemRole.routes';
import { organizationRoutes } from './organization.routes';
import { agentDaemonRoutes } from './agent.routes';
import { clusterGlobalRoutes } from './cluster.routes';
import { nodeRoutes } from './node.routes';
import { podRoutes } from './pod.routes';
import { deploymentRoutes } from './deployment.routes';
import { auditRoutes } from './audit.routes';
import { aiModelRegistryRoutes } from './aiModelRegistry.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/ai-models', aiModelRegistryRoutes);
apiRouter.use('/healing', healingActionRoutes);
apiRouter.use('/rule-engine', ruleEngineRoutes);
apiRouter.use('/telemetry', telemetryRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/roles', systemRoleRoutes);
apiRouter.use('/system-roles', systemRoleRoutes);
apiRouter.use('/organizations', organizationRoutes);
apiRouter.use('/agents', agentDaemonRoutes);
apiRouter.use('/clusters', clusterGlobalRoutes);
apiRouter.use('/nodes', nodeRoutes);
apiRouter.use('/pods', podRoutes);
apiRouter.use('/deployments', deploymentRoutes);
apiRouter.use('/audit-logs', auditRoutes);

export default apiRouter;
