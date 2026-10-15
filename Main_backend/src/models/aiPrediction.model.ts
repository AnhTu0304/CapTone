import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { GRUMetricPoint } from '../schemas/ai.schema';

export interface IAiPrediction {
  id?: string;
  model_id: string;
  environment_id: string;
  cluster_id?: string | null;
  workload_id?: string | null;
  prediction_type: string;
  risk_score: number;
  confidence_score: number;
  prediction_horizon_minutes: number;
  status: string;
  predicted_at: Date;
  expires_at: Date;
}

export class AiPredictionModel {
  /**
   * Find active GRU model ID
   */
  public static async findActiveModelId(client?: PoolClient): Promise<string> {
    const db = client || pool;
    const modelRes = await db.query(
      "SELECT id FROM ai_models WHERE (name = 'GRU_RISK_CLASSIFICATION' OR name ILIKE '%GRU%') AND (status = 'ACTIVE' OR status IS NULL) LIMIT 1"
    );

    if (modelRes.rows.length === 0) {
      const anyModel = await db.query('SELECT id FROM ai_models LIMIT 1');
      if (anyModel.rows.length === 0) {
        throw new Error('No AI Model registered in ai_models table');
      }
      return anyModel.rows[0].id;
    }
    return modelRes.rows[0].id;
  }

  /**
   * Insert prediction record
   */
  public static async create(
    client: PoolClient,
    prediction: IAiPrediction
  ): Promise<{ id: string; predicted_at: Date; expires_at: Date }> {
    const query = `
      INSERT INTO ai_predictions (
        model_id,
        environment_id,
        cluster_id,
        workload_id,
        prediction_type,
        risk_score,
        confidence_score,
        prediction_horizon_minutes,
        status,
        predicted_at,
        expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id, predicted_at, expires_at;
    `;

    const res = await client.query(query, [
      prediction.model_id,
      prediction.environment_id,
      prediction.cluster_id,
      prediction.workload_id,
      prediction.prediction_type,
      prediction.risk_score,
      prediction.confidence_score,
      prediction.prediction_horizon_minutes,
      prediction.status,
      prediction.predicted_at,
      prediction.expires_at,
    ]);

    return res.rows[0];
  }

  /**
   * Batch insert 12 timesteps x 8 features into prediction_inputs
   */
  public static async batchInsertInputs(
    client: PoolClient,
    predictionId: string,
    sequence: GRUMetricPoint[],
    metricUnits: Record<keyof GRUMetricPoint, string>
  ): Promise<void> {
    const metricKeys: (keyof GRUMetricPoint)[] = [
      'cpu',
      'ram',
      'disk',
      'latency',
      'request_rate',
      'http_5xx_rate',
      'pod_restart_count',
      'replica_count',
    ];

    const inputValues: any[] = [];
    const rowPlaceholders: string[] = [];
    let paramCounter = 1;
    const now = new Date();

    for (let i = 0; i < sequence.length; i++) {
      const point = sequence[i];
      const timestepOffsetMinutes = -((sequence.length - 1 - i) * 5) / 60;
      const observedAt = new Date(now.getTime() + timestepOffsetMinutes * 60000);

      for (const key of metricKeys) {
        rowPlaceholders.push(
          `($${paramCounter}, $${paramCounter + 1}, $${paramCounter + 2}, $${paramCounter + 3}, $${paramCounter + 4})`
        );
        inputValues.push(
          predictionId,
          key,
          point[key],
          metricUnits[key],
          observedAt
        );
        paramCounter += 5;
      }
    }

    const insertInputsSql = `
      INSERT INTO prediction_inputs (
        prediction_id,
        metric_name,
        metric_value,
        unit,
        collected_at
      ) VALUES ${rowPlaceholders.join(', ')};
    `;

    await client.query(insertInputsSql, inputValues);
  }
}
