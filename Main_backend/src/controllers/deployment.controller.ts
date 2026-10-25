import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { K8sStatusService } from '../services/k8sStatus.service';

export class DeploymentController {
  public static async getDeployments(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusterId = (req.params.clusterId || req.query.clusterId || req.query.cluster) as string | undefined;

      const deployments = await K8sStatusService.getDeploymentsStatus({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        orgId,
        clusterId,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(res, 'Lấy danh sách Deployments thành công', deployments, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getDeploymentDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const deploymentId = req.params.deploymentId || req.params.id;
      if (!deploymentId) {
        throw new ApiError(400, 'Mã Deployment không hợp lệ');
      }
      const orgId = req.params.orgId;
      const clusterId = req.params.clusterId;

      const deployment = await K8sStatusService.getDeploymentStatusById(
        {
          user: (req as any).user,
          orgMember: (req as any).orgMember,
          orgId,
          clusterId,
          query: req.query as Record<string, any>,
        },
        deploymentId
      );

      return ApiResponse.success(res, 'Lấy chi tiết trạng thái Deployment thành công', deployment, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getReplicaStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const deploymentId = req.params.deploymentId || req.params.id;
      if (!deploymentId) {
        throw new ApiError(400, 'Mã Deployment không hợp lệ');
      }
      const orgId = req.params.orgId;
      const clusterId = req.params.clusterId;

      const deployment = await K8sStatusService.getDeploymentStatusById(
        {
          user: (req as any).user,
          orgMember: (req as any).orgMember,
          orgId,
          clusterId,
          query: req.query as Record<string, any>,
        },
        deploymentId
      );

      return ApiResponse.success(
        res,
        'Lấy trạng thái Replica của Deployment thành công',
        {
          ...deployment.replicas,
          deployment_status: deployment.status,
          effective_status: deployment.effective_status,
          rollout_in_progress: deployment.rollout_in_progress,
          generation: deployment.generation,
          observed_generation: deployment.observed_generation,
          freshness: deployment.freshness,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
