import { Pool, PoolConfig } from 'pg';
import { config } from './env';
import { extractSqlOperation, recordDbError, recordDbOperation } from '../telemetry/metrics';

const poolConfig: PoolConfig = config.db.connectionString
  ? { connectionString: config.db.connectionString }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: config.db.max,
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    };

export const pool = new Pool(poolConfig);

const origPoolQuery = pool.query.bind(pool) as (...args: any[]) => any;
(pool as any).query = (...args: any[]) => {
  if (args.length > 0 && typeof args[args.length - 1] === 'function') {
    return origPoolQuery(...args);
  }
  const startHr = process.hrtime.bigint();
  const firstArg = args[0];
  const sqlText = typeof firstArg === 'string' ? firstArg : firstArg?.text;
  const op = extractSqlOperation(sqlText);
  try {
    const resPromise = origPoolQuery(...args);
    if (resPromise && typeof resPromise.then === 'function') {
      return resPromise.then(
        (res: any) => {
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
          recordDbOperation(op, 'success', dur);
          return res;
        },
        (err: any) => {
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
          recordDbOperation(op, 'error', dur);
          recordDbError('query_error');
          throw err;
        }
      );
    }
    return resPromise;
  } catch (err) {
    const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
    recordDbOperation(op, 'error', dur);
    recordDbError('query_error');
    throw err;
  }
};

pool.on('error', (err) => {
  recordDbError('pool_error');
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const testDbConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL database connected successfully at:', result.rows[0].now);
    return true;
  } catch (error) {
    recordDbError('pool_error');
    console.warn('⚠️ PostgreSQL database connection failed or not configured yet:', (error as Error).message);
    return false;
  }
};

export const getDbHealth = async (): Promise<{ status: string; serverTime: string | null; error?: string }> => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    return { status: 'CONNECTED', serverTime: result.rows[0].now };
  } catch (error) {
    return { status: `ERROR: ${(error as Error).message}`, serverTime: null, error: (error as Error).message };
  }
};
