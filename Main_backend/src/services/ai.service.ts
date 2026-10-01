import { config } from '../config/env';

export interface AiBackendHealth {
  status: string;
  model_loaded: boolean;
  model_type?: string;
  input_shape?: number[];
  risk_count?: number;
  rca_provider?: string;
  version?: string;
}

export class AiService {
  /**
   * Check connection and model readiness with AI Backend
   */
  public static async checkAiHealth(): Promise<{ connected: boolean; data?: AiBackendHealth; error?: string }> {
    const targetUrl = `${config.aiBackendUrl}/health`;
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `AI Backend responded with HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as AiBackendHealth;
      return {
        connected: true,
        data,
      };
    } catch (error) {
      return {
        connected: false,
        error: `Cannot reach AI Backend at ${config.aiBackendUrl}: ${(error as Error).message}`,
      };
    }
  }
}
