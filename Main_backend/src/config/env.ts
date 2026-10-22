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

  // Database (PostgreSQL)
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'captone_db',
    connectionString: process.env.DATABASE_URL,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
    algorithm: 'HS256' as const,
  },

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
  },
};
