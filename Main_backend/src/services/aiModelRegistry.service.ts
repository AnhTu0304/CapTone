import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { AiModelRegistryModel, AIModelRecord } from '../models/aiModelRegistry.model';

export class AiModelRegistryService {
  /**
   * List all registered AI models from DB
   */
  public static async listModels(): Promise<AIModelRecord[]> {
    return await AiModelRegistryModel.findAll();
  }

  /**
   * Upload .pth file, forward to AI Backend for test.csv benchmark, and persist in DB
   */
  public static async uploadAndEvaluate(
    fileBuffer: Buffer,
    fileName: string,
    metadata: {
      name?: string;
      version?: string;
      description?: string;
      framework?: string;
      model_type?: string;
      activate_now?: boolean | string;
    }
  ): Promise<AIModelRecord> {
    const targetUrl = `${config.aiBackendUrl}/api/v1/model/upload`;

    // Forward file to AI Backend
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName);

    let aiBackendRes: any = null;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60s timeout for full test benchmark
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new ApiError(response.status, `AI Backend từ chối mô hình: ${errText}`);
      }
      aiBackendRes = await response.json();
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `Không thể kết nối đến AI Backend để kiểm định: ${err.message}`);
    }

    const modelName = metadata.name?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const modelVersion = metadata.version?.trim() || '1.0.0';
    const shouldActivate = metadata.activate_now === true || metadata.activate_now === 'true';

    // Persist to database
    const createdModel = await AiModelRegistryModel.create({
      name: modelName,
      version: modelVersion,
      description: metadata.description?.trim() || `Tệp tải lên: ${fileName}`,
      framework: metadata.framework || 'PyTorch',
      model_type: metadata.model_type || 'GRU_RISK_CLASSIFICATION',
      training_dataset: aiBackendRes?.metrics?.dataset_name || 'Holdout Test Split (3000 samples)',
      file_path: aiBackendRes?.file_path || fileName,
      evaluation_metrics: aiBackendRes?.metrics || null,
      status: shouldActivate ? 'ACTIVE' : 'STAGING',
    });

    // If immediate activation requested, hot-reload active service
    if (shouldActivate) {
      await AiModelRegistryModel.activate(createdModel.id);
      await this.hotReloadAiBackend(fileName);
      createdModel.status = 'ACTIVE';
    }

    return createdModel;
  }

  /**
   * Switch active AI model with zero-downtime hot reload
   */
  public static async activateModel(id: string): Promise<{ model: AIModelRecord; hotReload: any }> {
    const targetModel = await AiModelRegistryModel.findById(id);
    if (!targetModel) {
      throw new ApiError(404, 'Không tìm thấy mô hình với ID được cung cấp');
    }

    const updatedModel = await AiModelRegistryModel.activate(id);
    const filename = targetModel.file_path ? targetModel.file_path.split(/[/\\]/).pop()! : targetModel.name;

    const hotReloadResult = await this.hotReloadAiBackend(filename);
    return {
      model: updatedModel,
      hotReload: hotReloadResult,
    };
  }

  /**
   * Rollback current model to previous stable version
   */
  public static async rollbackModel(id: string): Promise<{ model: AIModelRecord; hotReload: any }> {
    const previousModel = await AiModelRegistryModel.findPreviousForRollback(id);
    if (!previousModel) {
      throw new ApiError(404, 'Không tìm thấy phiên bản mô hình cũ hơn để rollback');
    }

    const rolledBackModel = await AiModelRegistryModel.activate(previousModel.id);
    const filename = rolledBackModel.file_path ? rolledBackModel.file_path.split(/[/\\]/).pop()! : rolledBackModel.name;

    const hotReloadResult = await this.hotReloadAiBackend(filename);
    return {
      model: rolledBackModel,
      hotReload: hotReloadResult,
    };
  }

  /**
   * Helper: Request AI Backend to hot-reload in memory
   */
  private static async hotReloadAiBackend(filename: string): Promise<any> {
    const targetUrl = `${config.aiBackendUrl}/api/v1/model/switch`;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[AiModelRegistry] Hot-reload failed on AI Backend: ${errText}`);
        return { success: false, error: errText };
      }
      return await response.json();
    } catch (err: any) {
      console.warn(`[AiModelRegistry] Hot-reload error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
