import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // AI Backend
  aiBackendUrl: process.env.AI_BACKEND_URL || 'http://ai-backend:8000',
  aiInternalHmacSecret: (() => {
    const secret = process.env.AI_INTERNAL_HMAC_SECRET;
    if (process.env.NODE_ENV === 'production') {
      if (!secret || secret.length < 32) {
        throw new Error('FATAL SECURITY ERROR: AI_INTERNAL_HMAC_SECRET must be set to at least 32 characters in production');
      }
      return secret;
    }
    return secret || 'dev_only_ai_internal_hmac_secret_32_characters_long';
  })(),

  // Telemetry Ingestion Mode: 'MEMORY_BUFFER' (Phương án 2: Đệm RAM/Redis, chỉ lưu DB khi có sự cố) | 'PERSIST_ALL'
  telemetryIngestionMode: (process.env.TELEMETRY_INGESTION_MODE as 'MEMORY_BUFFER' | 'PERSIST_ALL') || 'MEMORY_BUFFER',

  // Database (PostgreSQL)
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'captone_db',
    connectionString: process.env.DATABASE_URL,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    sslMode: (
      process.env.DB_SSL_MODE ||
      ((process.env.DB_SSL_REQUIRE_STRICT !== undefined
        ? process.env.DB_SSL_REQUIRE_STRICT === 'true'
        : (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging'))
        ? 'verify-full'
        : 'disable')
    ).trim().toLowerCase(),
    sslCaPath: process.env.DB_SSL_CA_PATH || '',
    sslCa: process.env.DB_SSL_CA || '',
    sslCertPath: process.env.DB_SSL_CERT_PATH || '',
    sslKeyPath: process.env.DB_SSL_KEY_PATH || '',
    sslRequireStrict:
      process.env.DB_SSL_REQUIRE_STRICT !== undefined
        ? process.env.DB_SSL_REQUIRE_STRICT === 'true'
        : (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'staging'),
  },
  dbMigrator: {
    user: process.env.DB_MIGRATOR_USER || process.env.DB_USER || 'postgres',
    password: process.env.DB_MIGRATOR_PASSWORD || process.env.DB_PASSWORD || '',
    connectionString: process.env.DB_MIGRATOR_URL || process.env.DATABASE_URL,
  },

  // CORS Config
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : [process.env.CLIENT_URL || 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],

  // JWT Config
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (process.env.NODE_ENV === 'production') {
        if (!secret || secret === 'your_super_secret_jwt_key_here' || secret.length < 32) {
          throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be set to a secure string of at least 32 characters in production');
        }
        return secret;
      }
      return secret || 'dev_only_jwt_secret_key_minimum_32_characters_long_12345';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    algorithm: 'HS256' as const,
  },

  // Refresh Token & Cookie Security Config (Sprint C Phase 2)
  refreshToken: {
    pepper: (() => {
      const pepper = process.env.REFRESH_TOKEN_PEPPER;
      if (process.env.NODE_ENV === 'production') {
        if (!pepper || pepper.length < 32) {
          throw new Error('FATAL SECURITY ERROR: REFRESH_TOKEN_PEPPER must be set to at least 32 characters in production');
        }
        return pepper;
      }
      return pepper || 'dev_only_refresh_token_pepper_minimum_32_characters_long';
    })(),
    ttlDays: process.env.REFRESH_TOKEN_TTL_DAYS ? parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) : 7,
    maxLifetimeDays: process.env.REFRESH_TOKEN_MAX_LIFETIME_DAYS ? parseInt(process.env.REFRESH_TOKEN_MAX_LIFETIME_DAYS, 10) : 30,
    cookieName: 'selfheal_refresh_token',
    csrfCookieName: 'selfheal_csrf_token',
    cookieSecure:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production',
    cookieSameSite: 'Lax' as const,
  },

  // AES-256-GCM key for encrypting 2FA TOTP secrets at rest
  totpEncryptionKey: (() => {
    const key = process.env.TOTP_ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production') {
      if (!key || key.length < 32) {
        throw new Error('FATAL SECURITY ERROR: TOTP_ENCRYPTION_KEY must be set to at least 32 characters in production');
      }
      return key;
    }
    return key || 'dev_only_totp_encryption_key_min_32_characters_long';
  })(),

  // AES-256-GCM key for encrypting organization alert secrets at rest (SD-03-01)
  dataEncryptionKey: (() => {
    const key = process.env.DATA_ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production') {
      if (!key || key.length < 32) {
        throw new Error('FATAL SECURITY ERROR: DATA_ENCRYPTION_KEY must be set to at least 32 characters in production');
      }
      return key;
    }
    return key || 'dev_only_data_encryption_key_min_32_characters_long';
  })(),
  dataEncryptionPreviousKeys: (process.env.DATA_ENCRYPTION_PREVIOUS_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length >= 16),

  trustProxyHops: process.env.TRUST_PROXY_HOPS ? parseInt(process.env.TRUST_PROXY_HOPS, 10) : 1,

  // Email / SMTP Config
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '"AI Self-Heal Support" <noreply@selfheal.io>',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    inProcessWorker: process.env.EMAIL_WORKER_IN_PROCESS !== 'false',
  },

  // Redis Cache Config
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL,
    ttlSeconds: process.env.REDIS_CACHE_TTL ? parseInt(process.env.REDIS_CACHE_TTL, 10) : 300,
    enabled: process.env.REDIS_ENABLED !== 'false',
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
    tlsCaPath: process.env.REDIS_TLS_CA_PATH || '',
  },

  // Google OAuth Config
  googleClientId: process.env.GOOGLE_CLIENT_ID || '382317913247-5abqr8bdkm6si7en6asjeckrnnfgsas3.apps.googleusercontent.com',

  // OpenTelemetry Config
  otel: {
    enabled: process.env.OTEL_ENABLED !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME || 'selfheal-backend',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    serviceNamespace: process.env.OTEL_SERVICE_NAMESPACE || 'selfheal-system',
    deploymentEnvironment: process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    exportIntervalMs: process.env.OTEL_METRIC_EXPORT_INTERVAL_MS
      ? parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS, 10)
      : 10000,
  },
};
