import { pool } from '../config/database';
import { PoolClient } from 'pg';

export interface AIModelRecord {
  id: string;
  name: string;
  version: string;
  model_type: string;
  framework: string;
  status: 'ACTIVE' | 'TRAINING' | 'STAGING' | 'DEPRECATED';
  description?: string | null;
  training_dataset?: string | null;
  file_path?: string | null;
  evaluation_metrics?: any | null;
  created_at: string;
  updated_at: string;
  prediction_count?: number;
}

export class AiModelRegistryModel {
  /**
   * List all AI models in registry
   */
  public static async findAll(): Promise<AIModelRecord[]> {
    const query = `
      SELECT 
        m.id,
        m.name,
        m.version,
        m.model_type,
        m.framework,
        m.status,
        m.description,
        m.training_dataset,
        m.file_path,
        m.evaluation_metrics,
        m.created_at,
        m.updated_at,
        COALESCE(p.cnt, 0)::int as prediction_count
      FROM ai_models m
      LEFT JOIN (
        SELECT model_id, COUNT(*) as cnt
        FROM ai_predictions
        GROUP BY model_id
      ) p ON m.id = p.model_id
      ORDER BY 
        CASE WHEN m.status = 'ACTIVE' THEN 0 ELSE 1 END,
        m.created_at DESC;
    `;
    const res = await pool.query(query);
    return res.rows;
  }

  /**
   * Find a model by ID
   */
  public static async findById(id: string): Promise<AIModelRecord | null> {
    const query = `
      SELECT id, name, version, model_type, framework, status, description, 
             training_dataset, file_path, evaluation_metrics, created_at, updated_at
      FROM ai_models
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Register a new AI model with benchmark metrics
   */
  public static async create(data: {
    name: string;
    version: string;
    model_type?: string;
    framework?: string;
    description?: string | null;
    training_dataset?: string | null;
    file_path?: string | null;
    evaluation_metrics?: any | null;
    status?: string;
  }): Promise<AIModelRecord> {
    const query = `
      INSERT INTO ai_models (
        name, version, model_type, framework, description,
        training_dataset, file_path, evaluation_metrics, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      data.name,
      data.version || '1.0.0',
      data.model_type || 'GRU_RISK_CLASSIFICATION',
      data.framework || 'PyTorch',
      data.description || null,
      data.training_dataset || 'Holdout Test Split (3000 samples)',
      data.file_path || null,
      data.evaluation_metrics ? JSON.stringify(data.evaluation_metrics) : null,
      data.status || 'STAGING',
    ];
    const res = await pool.query(query, values);
    return res.rows[0];
  }

  /**
   * Activate a model: deprecate older active versions and set this model to ACTIVE
   */
  public static async activate(id: string): Promise<AIModelRecord> {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const targetModelRes = await client.query('SELECT * FROM ai_models WHERE id = $1', [id]);
      if (targetModelRes.rows.length === 0) {
        throw new Error('Không tìm thấy mô hình với ID được chỉ định');
      }
      const targetModel = targetModelRes.rows[0];

      // Set all other active models to DEPRECATED
      await client.query(
        "UPDATE ai_models SET status = 'DEPRECATED', updated_at = NOW() WHERE id != $1 AND status = 'ACTIVE'",
        [id]
      );

      // Set target model to ACTIVE
      const updatedRes = await client.query(
        "UPDATE ai_models SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      await client.query('COMMIT');
      return updatedRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Find previous model for rollback
   */
  public static async findPreviousForRollback(currentId: string): Promise<AIModelRecord | null> {
    const query = `
      SELECT * FROM ai_models
      WHERE id != $1
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [currentId]);
    return res.rows[0] || null;
  }
}
