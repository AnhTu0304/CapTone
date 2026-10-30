import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AiModelRegistryService } from '../services/aiModelRegistry.service';

export class AiModelRegistryController {
  /**
   * GET /api/v1/ai-models
   * Retrieve all registered AI models
   */
  public static async getAllModels(req: Request, res: Response) {
    try {
      const models = await AiModelRegistryService.listModels();
      return ApiResponse.success(res, 'Danh sách mô hình học máy AI', models, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * POST /api/v1/ai-models/upload
   * Upload model checkpoint, benchmark against holdout test data, persist to DB
   */
  public static async uploadModel(req: Request, res: Response) {
    try {
      const file = (req as any).file as Express.Multer.File;
      if (!file) {
        return ApiResponse.error(res, 'Vui lòng chọn tệp mô hình (.pth, .pt, .onnx) để tải lên', 400);
      }

      const { name, version, description, framework, model_type, activate_now } = req.body;

      const createdModel = await AiModelRegistryService.uploadAndEvaluate(
        file.buffer,
        file.originalname,
        {
          name,
          version,
          description,
          framework,
          model_type,
          activate_now,
        }
      );

      return ApiResponse.success(
        res,
        'Tải lên và kiểm định mô hình thành công trên tập dữ liệu kiểm thử',
        createdModel,
        201
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * PUT /api/v1/ai-models/:id/activate
   * Hot-reload model into AI Backend and mark ACTIVE in DB
   */
  public static async activateModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await AiModelRegistryService.activateModel(id);

      return ApiResponse.success(
        res,
        `Đã kích hoạt mô hình ${result.model.name} (${result.model.version}) thành công`,
        result,
        200
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * POST /api/v1/ai-models/:id/rollback
   * Rollback to the previous stable active version
   */
  public static async rollbackModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await AiModelRegistryService.rollbackModel(id);

      return ApiResponse.success(
        res,
        `Rollback thành công về mô hình ${result.model.name} (${result.model.version})`,
        result,
        200
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }
}
