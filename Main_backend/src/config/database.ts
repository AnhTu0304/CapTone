import fs from 'fs';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { ConnectionOptions } from 'tls';
import { config } from './env';
import { extractSqlOperation, recordDbError, recordDbOperation } from '../telemetry/metrics';
import { getDbContext, IDbContext, isValidUuid, runWithDbContext } from './dbContext';
import { redactSensitiveString } from '../utils/logSanitizer';

export type PgSslMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';

export interface DbTlsRuntimeOptions {
  sslMode?: string;
  sslCaPath?: string;
  sslCa?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslRequireStrict?: boolean;
  connectionString?: string;
}

const VALID_SSL_MODES = new Set<string>(['disable', 'require', 'verify-ca', 'verify-full']);

function readPemFile(filePath: string, label: string, marker: string): string {
  const cleanPath = filePath.trim();
  if (!cleanPath || !fs.existsSync(cleanPath)) {
    throw new Error(`FATAL DB TLS ERROR: ${label} file not found at configured path`);
  }
  const content = fs.readFileSync(cleanPath, 'utf8').trim();
  if (!content.includes(marker)) {
    throw new Error(`FATAL DB TLS ERROR: ${label} file does not contain valid PEM data (${marker})`);
  }
  return content;
}

/**
 * Resolve and validate PostgreSQL TLS configuration cleanly with fail-closed semantics.
 * Never silently downgrades to plaintext or skips certificate validation when strict TLS is active.
 */
export function resolvePgSslConfig(overrides?: DbTlsRuntimeOptions): {
  mode: PgSslMode;
  ssl: boolean | ConnectionOptions;
  sanitizedConnectionString?: string;
} {
  const rawMode = (overrides?.sslMode ?? config.db.sslMode ?? 'disable').trim().toLowerCase();
  if (!VALID_SSL_MODES.has(rawMode)) {
    throw new Error(
      `FATAL DB TLS ERROR: Invalid DB_SSL_MODE '${rawMode}'. Allowed: disable, require, verify-ca, verify-full`
    );
  }
  const mode = rawMode as PgSslMode;
  const requireStrict = overrides?.sslRequireStrict ?? config.db.sslRequireStrict;

  if (requireStrict && mode !== 'verify-full' && mode !== 'verify-ca') {
    throw new Error(
      `FATAL DB TLS ERROR: Strict TLS is required in production/staging (DB_SSL_MODE='${mode}' rejected; expected 'verify-full')`
    );
  }

  let sanitizedConnectionString = overrides?.connectionString;
  if (sanitizedConnectionString) {
    try {
      const parsed = new URL(sanitizedConnectionString);
      const urlSslMode = (parsed.searchParams.get('sslmode') || '').trim().toLowerCase();
      if (urlSslMode && urlSslMode !== mode) {
        if (requireStrict && ['disable', 'allow', 'prefer', 'require'].includes(urlSslMode)) {
          throw new Error(
            `FATAL DB TLS ERROR: DATABASE_URL sslmode='${urlSslMode}' violates strict TLS policy`
          );
        }
      }
      // Strip sslmode from URL so explicit pg ConnectionOptions control TLS identity validation
      parsed.searchParams.delete('sslmode');
      sanitizedConnectionString = parsed.toString();
    } catch (urlErr: any) {
      if (urlErr?.message?.startsWith('FATAL DB TLS ERROR')) throw urlErr;
    }
  }

  if (mode === 'disable') {
    return { mode, ssl: false, sanitizedConnectionString };
  }

  if (mode === 'require') {
    // Only permitted when strict mode is explicitly off (e.g. non-production tests); verifies encryption without CA pinning
    return {
      mode,
      ssl: { rejectUnauthorized: false },
      sanitizedConnectionString,
    };
  }

  const inlineCa = (overrides?.sslCa ?? config.db.sslCa ?? '').trim();
  const caPath = (overrides?.sslCaPath ?? config.db.sslCaPath ?? '').trim();
  let caPem: string;
  if (inlineCa) {
    if (!inlineCa.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('FATAL DB TLS ERROR: Inline DB_SSL_CA does not contain valid PEM certificate data');
    }
    caPem = inlineCa;
  } else if (caPath) {
    caPem = readPemFile(caPath, 'DB_SSL_CA_PATH', '-----BEGIN CERTIFICATE-----');
  } else {
    throw new Error(`FATAL DB TLS ERROR: DB_SSL_MODE='${mode}' requires DB_SSL_CA_PATH or DB_SSL_CA`);
  }

  const sslOpts: ConnectionOptions = {
    rejectUnauthorized: true,
    ca: caPem,
    minVersion: 'TLSv1.2',
  };

  if (mode === 'verify-ca') {
    // Verify CA trust chain without failing on hostname SAN mismatch
    sslOpts.checkServerIdentity = () => undefined;
  }

  const certPath = (overrides?.sslCertPath ?? config.db.sslCertPath ?? '').trim();
  const keyPath = (overrides?.sslKeyPath ?? config.db.sslKeyPath ?? '').trim();
  if (certPath || keyPath) {
    if (!certPath || !keyPath) {
      throw new Error('FATAL DB TLS ERROR: Mutual TLS requires both DB_SSL_CERT_PATH and DB_SSL_KEY_PATH');
    }
    sslOpts.cert = readPemFile(certPath, 'DB_SSL_CERT_PATH', '-----BEGIN CERTIFICATE-----');
    sslOpts.key = readPemFile(keyPath, 'DB_SSL_KEY_PATH', 'PRIVATE KEY-----');
  }

  return { mode, ssl: sslOpts, sanitizedConnectionString };
}

export function buildPgPoolConfig(
  role: 'app' | 'migrator' = 'app',
  overrides?: DbTlsRuntimeOptions & {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    max?: number;
  }
): PoolConfig {
  const baseConnStr =
    overrides?.connectionString ??
    (role === 'migrator' ? config.dbMigrator.connectionString : config.db.connectionString);
  const resolvedTls = resolvePgSslConfig({
    ...overrides,
    connectionString: baseConnStr,
  });

  if (resolvedTls.sanitizedConnectionString) {
    return {
      connectionString: resolvedTls.sanitizedConnectionString,
      ssl: resolvedTls.ssl,
      max: overrides?.max ?? (role === 'migrator' ? 5 : config.db.max),
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    };
  }

  return {
    host: overrides?.host ?? config.db.host,
    port: overrides?.port ?? config.db.port,
    user: overrides?.user ?? (role === 'migrator' ? config.dbMigrator.user : config.db.user),
    password: overrides?.password ?? (role === 'migrator' ? config.dbMigrator.password : config.db.password),
    database: overrides?.database ?? config.db.database,
    max: overrides?.max ?? (role === 'migrator' ? 5 : config.db.max),
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    ssl: resolvedTls.ssl,
  };
}

const poolConfig: PoolConfig = buildPgPoolConfig('app');

export const pool = new Pool(poolConfig);

const origPoolQuery = pool.query.bind(pool) as (...args: any[]) => any;
const origPoolConnect = pool.connect.bind(pool) as () => Promise<PoolClient>;

const TX_BEGIN_RE = /^\s*(BEGIN|START\s+TRANSACTION)\b/i;
const TX_END_RE = /^\s*(COMMIT|END|ROLLBACK)\b/i;
const SET_CONTEXT_SQL = `SELECT set_config('app.access_scope', $1, true), set_config('app.current_org_id', $2, true), set_config('app.current_user_id', $3, true);`;

function serializeContextArgs(ctx: IDbContext): [string, string, string] {
  const scope = ctx.scope || 'NONE';
  const orgId = scope === 'TENANT' && isValidUuid(ctx.organizationId) ? ctx.organizationId.trim() : '';
  const userId = isValidUuid(ctx.userId) ? ctx.userId.trim() : '';
  return [scope, orgId, userId];
}

async function applyLocalContext(rawQueryFn: (...a: any[]) => any, ctx: IDbContext): Promise<void> {
  await rawQueryFn(SET_CONTEXT_SQL, serializeContextArgs(ctx));
}

/**
 * Wrap a pooled query inside a short local transaction when AsyncLocalStorage context is active,
 * ensuring SET LOCAL is applied strictly for that query and cleared automatically at transaction end.
 * If NO context is active, fails closed (executes without setting any GUC).
 */
(pool as any).query = (...args: any[]) => {
  if (args.length > 0 && typeof args[args.length - 1] === 'function') {
    return origPoolQuery(...args);
  }

  const startHr = process.hrtime.bigint();
  const firstArg = args[0];
  const sqlText = typeof firstArg === 'string' ? firstArg : firstArg?.text;
  const op = extractSqlOperation(sqlText);
  const ctx = getDbContext();

  const execute = async () => {
    if (ctx?.txClient) {
      return await ctx.txClient.query(...(args as [any, ...any[]]));
    }
    if (ctx && ctx.scope !== 'NONE' && sqlText && !TX_BEGIN_RE.test(sqlText) && !TX_END_RE.test(sqlText)) {
      const client = await origPoolConnect();
      const rawQuery = (client as any).__rawQuery || client.query.bind(client);
      try {
        await rawQuery('BEGIN');
        await applyLocalContext(rawQuery, ctx);
        const result = await rawQuery(...args);
        await rawQuery('COMMIT');
        return result;
      } catch (err) {
        await rawQuery('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }
    return await origPoolQuery(...args);
  };

  return execute().then(
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
};

/**
 * Intercept pool.connect() so manual transactions (BEGIN...COMMIT) inside an active DbContext
 * receive SET LOCAL context automatically and always return clean connections to the pool.
 */
(pool as any).connect = (...connectArgs: any[]): any => {
  if (connectArgs.length > 0 && typeof connectArgs[connectArgs.length - 1] === 'function') {
    return (origPoolConnect as any)(...connectArgs);
  }
  return (origPoolConnect as any)(...connectArgs).then((client: PoolClient) => {
    const rawQuery = client.query.bind(client) as (...args: any[]) => any;
    const rawRelease = client.release.bind(client);
    (client as any).__rawQuery = rawQuery;

    let inManualTx = false;

    (client as any).query = (...qArgs: any[]) => {
      if (qArgs.length > 0 && typeof qArgs[qArgs.length - 1] === 'function') {
        return rawQuery(...qArgs);
      }
      const firstArg = qArgs[0];
      const sqlText = typeof firstArg === 'string' ? firstArg : firstArg?.text || '';
      const ctx = getDbContext();

      if (TX_BEGIN_RE.test(sqlText)) {
        return rawQuery(...qArgs).then(async (res: any) => {
          inManualTx = true;
          if (ctx && ctx.scope !== 'NONE') {
            await applyLocalContext(rawQuery, ctx);
          }
          return res;
        });
      }

      if (TX_END_RE.test(sqlText)) {
        inManualTx = false;
        return rawQuery(...qArgs);
      }

      if (!inManualTx && ctx && ctx.scope !== 'NONE') {
        return (async () => {
          await rawQuery('BEGIN');
          try {
            await applyLocalContext(rawQuery, ctx);
            const res = await rawQuery(...qArgs);
            await rawQuery('COMMIT');
            return res;
          } catch (err) {
            await rawQuery('ROLLBACK').catch(() => {});
            throw err;
          }
        })();
      }

      return rawQuery(...qArgs);
    };

    (client as any).release = (err?: Error | boolean) => {
      inManualTx = false;
      (client as any).query = rawQuery;
      (client as any).release = rawRelease;
      return rawRelease(err);
    };

    return client;
  });
};

/**
 * Explicit fail-closed tenant transaction helper.
 * Rejects missing or malformed organizationId immediately without any default fallback.
 */
export async function withTenantTx<T>(
  organizationId: string,
  userId: string | null | undefined,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!isValidUuid(organizationId)) {
    throw new Error(`Tenant transaction rejected: invalid organizationId '${String(organizationId)}'`);
  }
  const cleanOrgId = organizationId.trim();
  const cleanUserId = isValidUuid(userId) ? userId.trim() : null;
  const client = await origPoolConnect();
  const rawQuery = client.query.bind(client);
  try {
    await rawQuery('BEGIN');
    await applyLocalContext(rawQuery, {
      scope: 'TENANT',
      organizationId: cleanOrgId,
      userId: cleanUserId,
    });
    const result = await runWithDbContext(
      { scope: 'TENANT', organizationId: cleanOrgId, userId: cleanUserId, txClient: client },
      () => fn(client)
    );
    await rawQuery('COMMIT');
    return result;
  } catch (err) {
    await rawQuery('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function withPlatformAdminTx<T>(
  userId: string | null | undefined,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const cleanUserId = isValidUuid(userId) ? userId.trim() : null;
  const client = await origPoolConnect();
  const rawQuery = client.query.bind(client);
  try {
    await rawQuery('BEGIN');
    await applyLocalContext(rawQuery, { scope: 'PLATFORM_ADMIN', userId: cleanUserId });
    const result = await runWithDbContext(
      { scope: 'PLATFORM_ADMIN', userId: cleanUserId, txClient: client },
      () => fn(client)
    );
    await rawQuery('COMMIT');
    return result;
  } catch (err) {
    await rawQuery('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function withSystemTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await origPoolConnect();
  const rawQuery = client.query.bind(client);
  try {
    await rawQuery('BEGIN');
    await applyLocalContext(rawQuery, { scope: 'SYSTEM' });
    const result = await runWithDbContext({ scope: 'SYSTEM', txClient: client }, () => fn(client));
    await rawQuery('COMMIT');
    return result;
  } catch (err) {
    await rawQuery('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Dedicated migration pool factory using DB_MIGRATOR_* credentials when separated from runtime DB_USER.
 * Must NEVER be imported by runtime controllers/services.
 */
export function createMigratorPool(): Pool {
  return new Pool(buildPgPoolConfig('migrator'));
}

pool.on('error', (err) => {
  recordDbError('pool_error');
  console.error('Unexpected error on idle PostgreSQL client:', redactSensitiveString((err as Error)?.message || String(err)));
});

export const testDbConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT NOW() AS now, COALESCE(s.ssl, false) AS ssl_used
       FROM (SELECT 1) AS x
       LEFT JOIN pg_stat_ssl s ON s.pid = pg_backend_pid()`
    );
    client.release();
    console.log(
      `✅ PostgreSQL database connected successfully at: ${result.rows[0].now} (ssl=${Boolean(result.rows[0].ssl_used)})`
    );
    return true;
  } catch (error) {
    recordDbError('pool_error');
    const safeMsg = redactSensitiveString((error as Error).message || 'Connection failed');
    console.warn('⚠️ PostgreSQL database connection failed or TLS rejected:', safeMsg);
    if (config.db.sslRequireStrict) {
      throw new Error(`FATAL DB CONNECTION ERROR: Refusing to start with strict TLS failure (${safeMsg})`);
    }
    return false;
  }
};

export const getDbHealth = async (): Promise<{
  status: string;
  serverTime: string | null;
  ssl?: { used: boolean; version: string | null; cipher: string | null };
  error?: string;
}> => {
  try {
    const result = await pool.query(
      `SELECT NOW() AS now,
              COALESCE(s.ssl, false) AS ssl_used,
              s.version AS ssl_version,
              s.cipher AS ssl_cipher
       FROM (SELECT 1) AS x
       LEFT JOIN pg_stat_ssl s ON s.pid = pg_backend_pid()`
    );
    const row = result.rows[0];
    return {
      status: 'CONNECTED',
      serverTime: row.now,
      ssl: {
        used: Boolean(row.ssl_used),
        version: row.ssl_version || null,
        cipher: row.ssl_cipher || null,
      },
    };
  } catch (error) {
    const safeMsg = redactSensitiveString((error as Error).message || 'Database error');
    return { status: `ERROR: ${safeMsg}`, serverTime: null, error: safeMsg };
  }
};

let cachedExecutionModeLabels: string[] | null = null;
let cachedExecutionStatusLabels: string[] | null = null;

export async function getExecutionModeLabels(): Promise<string[]> {
  if (cachedExecutionModeLabels) return cachedExecutionModeLabels;
  try {
    const res = await origPoolQuery(
      `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'execution_mode';`
    );
    const labels = (res?.rows || []).map((r: any) => String(r.enumlabel).toUpperCase());
    if (labels.length > 0) {
      cachedExecutionModeLabels = labels;
      return labels;
    }
  } catch {
    // Fallback cleanly when offline or mocked
  }
  return ['MANUAL', 'AUTO'];
}

export async function resolveAutoExecutionMode(): Promise<'AUTO' | 'AUTOMATIC'> {
  const labels = await getExecutionModeLabels();
  if (labels.includes('AUTO')) return 'AUTO';
  if (labels.includes('AUTOMATIC')) return 'AUTOMATIC';
  return 'AUTO';
}

export async function resolveSemiAutoExecutionMode(): Promise<'MANUAL' | 'SEMI_AUTOMATIC'> {
  const labels = await getExecutionModeLabels();
  return labels.includes('SEMI_AUTOMATIC') ? 'SEMI_AUTOMATIC' : 'MANUAL';
}

export async function resolveSkippedExecutionStatus(): Promise<'SKIPPED' | 'CANCELLED'> {
  if (!cachedExecutionStatusLabels) {
    try {
      const res = await origPoolQuery(
        `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'execution_status';`
      );
      const labels = (res?.rows || []).map((r: any) => String(r.enumlabel).toUpperCase());
      if (labels.length > 0) {
        cachedExecutionStatusLabels = labels;
      }
    } catch {
      // Fallback
    }
  }
  const labels =
    cachedExecutionStatusLabels || ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'COMPLETED'];
  return labels.includes('SKIPPED') ? 'SKIPPED' : 'CANCELLED';
}
