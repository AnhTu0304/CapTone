import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';

export type DbAccessScope = 'NONE' | 'AUTH' | 'TENANT' | 'PLATFORM_ADMIN' | 'SYSTEM';

export interface IDbContext {
  scope: DbAccessScope;
  organizationId?: string | null;
  userId?: string | null;
  txClient?: PoolClient;
}

interface DbContextHolder {
  ctx: IDbContext;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value.trim());

const dbContextStorage = new AsyncLocalStorage<DbContextHolder>();

export const getDbContext = (): IDbContext | undefined => dbContextStorage.getStore()?.ctx;

/**
 * Execute `fn` within an isolated AsyncLocalStorage database security context.
 * Uses a per-execution mutable holder so downstream middleware (e.g. AUTH -> TENANT)
 * can refine context strictly within the current request/task without affecting other requests.
 */
export const runWithDbContext = <T>(ctx: IDbContext, fn: () => T): T => {
  return dbContextStorage.run({ ctx: { ...ctx } }, fn);
};

export const runWithTenantContext = <T>(
  organizationId: string,
  userId: string | null | undefined,
  fn: () => T
): T => {
  if (!isValidUuid(organizationId)) {
    throw new Error(`Invalid organizationId for tenant DB context: ${String(organizationId)}`);
  }
  return runWithDbContext(
    {
      scope: 'TENANT',
      organizationId: organizationId.trim(),
      userId: isValidUuid(userId) ? userId.trim() : null,
    },
    fn
  );
};

/**
 * Update the active AsyncLocalStorage DB context inside the current execution chain.
 * Returns true if updated inside an active store, false if no store exists.
 */
export const setActiveDbContext = (ctx: IDbContext): boolean => {
  const holder = dbContextStorage.getStore();
  if (!holder) return false;
  holder.ctx = {
    ...ctx,
    organizationId: ctx.organizationId && isValidUuid(ctx.organizationId) ? ctx.organizationId.trim() : null,
    userId: ctx.userId && isValidUuid(ctx.userId) ? ctx.userId.trim() : null,
  };
  return true;
};

/**
 * Upgrade/set context inside middleware or enter a fresh async context if none exists yet.
 */
export const enterOrUpdateDbContext = (ctx: IDbContext): void => {
  if (!setActiveDbContext(ctx)) {
    dbContextStorage.enterWith({
      ctx: {
        ...ctx,
        organizationId: ctx.organizationId && isValidUuid(ctx.organizationId) ? ctx.organizationId.trim() : null,
        userId: ctx.userId && isValidUuid(ctx.userId) ? ctx.userId.trim() : null,
      },
    });
  }
};
