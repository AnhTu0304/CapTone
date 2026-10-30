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

  risk_outputs?: Record<string, any> | null;

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

        expires_at,

        risk_outputs

      ) VALUES (

        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12

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

      prediction.risk_outputs ? JSON.stringify(prediction.risk_outputs) : null,

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



  /**

   * List predictions with filtering and pagination

   */

  public static async findMany(params: {

    limit?: number;

    offset?: number;

    status?: string;

    prediction_type?: string;

    cluster_id?: string;

    organization_id?: string;

  }): Promise<{ items: any[]; total: number }> {

    const limit = params.limit ?? 20;

    const offset = params.offset ?? 0;

    const conditions: string[] = [];

    const values: any[] = [];

    let idx = 1;



    if (params.organization_id && params.organization_id !== 'ALL' && params.organization_id !== 'all') {

      conditions.push(`e.organization_id = $${idx++}`);

      values.push(params.organization_id);

    }



    if (params.status) {

      conditions.push(`p.status = $${idx++}`);

      values.push(params.status);

    }

    if (params.prediction_type) {

      conditions.push(`p.prediction_type ILIKE $${idx++}`);

      values.push(`%${params.prediction_type}%`);

    }

    if (params.cluster_id && params.cluster_id !== 'ALL') {
      conditions.push(`p.cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx})`);
      values.push(params.cluster_id);
      idx++;
    }



    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';



    const countSql = `SELECT count(*) FROM ai_predictions p LEFT JOIN environments e ON e.id = p.environment_id ${whereClause};`;

    const countRes = await pool.query(countSql, values);

    const total = parseInt(countRes.rows[0].count, 10);



    const query = `

      SELECT 

        p.id,

        p.model_id,

        m.name AS model_name,

        m.version AS model_version,

        p.environment_id,

        e.name AS environment_name,

        p.cluster_id,

        c.name AS cluster_name,

        p.workload_id,

        w.name AS workload_name,

        p.prediction_type,

        p.risk_score,

        p.confidence_score,

        p.prediction_horizon_minutes,

        p.status,

        p.predicted_at,

        p.expires_at,

        p.created_at,

        p.risk_outputs

      FROM ai_predictions p

      LEFT JOIN ai_models m ON m.id = p.model_id

      LEFT JOIN environments e ON e.id = p.environment_id

      LEFT JOIN clusters c ON (c.id::text = p.cluster_id OR c.name = p.cluster_id OR c.cluster_uid = p.cluster_id)

      LEFT JOIN workloads w ON w.id = p.workload_id

      ${whereClause}

      ORDER BY p.predicted_at DESC

      LIMIT $${idx++} OFFSET $${idx++};

    `;



    values.push(limit, offset);

    const res = await pool.query(query, values);



    return { items: res.rows, total };

  }



  /**

   * Find prediction by ID

   */

  public static async findById(id: string): Promise<any | null> {

    const query = `

      SELECT 

        p.id,

        p.model_id,

        m.name AS model_name,

        m.version AS model_version,

        p.environment_id,

        e.name AS environment_name,

        p.cluster_id,

        c.name AS cluster_name,

        p.workload_id,

        w.name AS workload_name,

        p.prediction_type,

        p.risk_score,

        p.confidence_score,

        p.prediction_horizon_minutes,

        p.status,

        p.predicted_at,

        p.expires_at,

        p.created_at,

        p.risk_outputs

      FROM ai_predictions p

      LEFT JOIN ai_models m ON m.id = p.model_id

      LEFT JOIN environments e ON e.id = p.environment_id

      LEFT JOIN clusters c ON (c.id::text = p.cluster_id OR c.name = p.cluster_id OR c.cluster_uid = p.cluster_id)

      LEFT JOIN workloads w ON w.id = p.workload_id

      WHERE p.id = $1

      LIMIT 1;

    `;

    const res = await pool.query(query, [id]);

    return res.rows[0] || null;

  }



  /**

   * Get inputs sequence for a prediction

   */

  public static async findInputsByPredictionId(predictionId: string): Promise<any[]> {

    const query = `

      SELECT 

        id,

        prediction_id,

        metric_name,

        metric_value,

        unit,

        source,

        collected_at

      FROM prediction_inputs

      WHERE prediction_id = $1

      ORDER BY collected_at ASC, metric_name ASC;

    `;

    const res = await pool.query(query, [predictionId]);

    return res.rows;

  }



  /**

   * Aggregated statistics of predictions

   */

  public static async getPredictionStats(clusterId?: string, workload?: string, organizationId?: string): Promise<{

    total: number;

    by_type: Record<string, number>;

    avg_confidence: number;

  }> {

    const conditions: string[] = [];

    const params: any[] = [];

    let idx = 1;



    if (organizationId && organizationId !== 'ALL' && organizationId !== 'all') {

      conditions.push(`e.organization_id = $${idx++}`);

      params.push(organizationId);

    }



    if (clusterId && clusterId !== 'ALL') {
      conditions.push(`p.cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx} OR name = $${idx})`);
      params.push(clusterId);
      idx++;
    }



    if (workload && workload !== 'ALL') {

      conditions.push(`(p.workload_id IN (SELECT id FROM workloads WHERE name = $${idx}) OR p.workload_id::text = $${idx})`);

      params.push(workload);

      idx++;

    }



    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT count(*), AVG(p.confidence_score) as avg_conf FROM ai_predictions p LEFT JOIN environments e ON e.id = p.environment_id ${whereClause};`, params);

    const byTypeRes = await pool.query(`

      SELECT p.prediction_type, count(*) as count 

      FROM ai_predictions p 

      LEFT JOIN environments e ON e.id = p.environment_id

      ${whereClause}

      GROUP BY p.prediction_type 

      ORDER BY count DESC;

    `, params);



    const byType: Record<string, number> = {};

    for (const row of byTypeRes.rows) {

      byType[row.prediction_type] = parseInt(row.count, 10);

    }



    return {

      total: parseInt(totalRes.rows[0]?.count || '0', 10),

      by_type: byType,

      avg_confidence: parseFloat(totalRes.rows[0]?.avg_conf || '0'),

    };

  }



  /**

   * List all registered AI models

   */

  public static async findAllModels(): Promise<any[]> {

    const query = `

      SELECT 

        id,

        name,

        version,

        model_type,

        framework,

        status,

        description,

        training_dataset,

        created_at,

        updated_at

      FROM ai_models

      ORDER BY created_at DESC;

    `;

    const res = await pool.query(query);

    return res.rows;

  }



  /**

   * Find linked environment, cluster, workload for a prediction

   */

  public static async findContextById(

    predictionId: string,

    client?: PoolClient

  ): Promise<{ environment_id: string; cluster_id?: string | null; workload_id?: string | null } | null> {

    const db = client || pool;

    try {

      const res = await db.query(

        'SELECT environment_id, cluster_id, workload_id FROM ai_predictions WHERE id = $1',

        [predictionId]

      );

      return res.rows[0] || null;

    } catch {

      return null;

    }

  }



  /**

   * Get recent AI predictions

   */

  public static async getRecent(limit: number = 5, client?: PoolClient) {

    const db = client || pool;

    const res = await db.query(

      `SELECT id, prediction_type, risk_score, confidence_score, status, predicted_at, expires_at

       FROM ai_predictions

       ORDER BY predicted_at DESC

       LIMIT $1`,

      [limit]

    );

    return res.rows;

  }

}

