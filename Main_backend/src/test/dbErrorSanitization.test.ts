import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import {
  isSensitiveDbDriverError,
  resolveSafeClientErrorMessage,
  SAFE_DB_ERROR_CLIENT_MESSAGE,
} from '../utils/logSanitizer';
import { errorHandler } from '../middlewares/error.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authenticateAgentToken } from '../middlewares/agentAuth.middleware';
import { config } from '../config/env';
import { UserModel } from '../models/user.model';
import { AgentModel } from '../models/agent.model';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { AiController } from '../controllers/ai.controller';
import { AiModelRegistryController } from '../controllers/aiModelRegistry.controller';
import { AiModelRegistryService } from '../services/aiModelRegistry.service';

describe('PostgreSQL Driver & Auth Error Sanitization', () => {
  it('detects PostgreSQL SQLSTATE codes and auth/network messages cleanly', () => {
    assert.strictEqual(
      isSensitiveDbDriverError(
        Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' })
      ),
      true
    );
    assert.strictEqual(isSensitiveDbDriverError(new Error('timeout exceeded when trying to connect')), true);
    assert.strictEqual(isSensitiveDbDriverError(new Error('connect ECONNREFUSED 127.0.0.1:5432')), true);
    assert.strictEqual(isSensitiveDbDriverError(new Error('Email hoặc mật khẩu không hợp lệ')), false);
  });

  it('masks raw PostgreSQL errors in errorHandler, AiController, and AiModelRegistryController even in dev mode', async () => {
    const prevDev = config.isDevelopment;
    (config as any).isDevelopment = true;
    const origErr = console.error;
    console.error = () => {};

    const app = express();
    app.get('/pg-28p01', (_req, _res, next) =>
      next(Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' }))
    );
    app.get('/ai-pg', (_req, res) =>
      (AiController as any).respondError(
        res,
        Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' }),
        '[Test]'
      )
    );
    app.get('/registry-pg', async (req, res) => {
      const m = mock.method(AiModelRegistryService, 'listModels', async () => {
        throw new Error('timeout exceeded when trying to connect');
      });
      try {
        return await AiModelRegistryController.getAllModels(req, res);
      } finally {
        m.mock.restore();
      }
    });
    app.use(errorHandler);

    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    try {
      for (const path of ['/pg-28p01', '/ai-pg', '/registry-pg']) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        const body: any = await res.json();
        assert.strictEqual(res.status, 500);
        assert.strictEqual(body.message, SAFE_DB_ERROR_CLIENT_MESSAGE);
        assert.strictEqual(body.errors?.stack, undefined);
        assert.strictEqual(JSON.stringify(body).includes('password authentication failed'), false);
        assert.strictEqual(JSON.stringify(body).includes('timeout exceeded'), false);
      }

      // Non-dev returns strict generic message for unhandled errors
      (config as any).isDevelopment = false;
      const nonDevMsg = resolveSafeClientErrorMessage(new Error('unexpected failure'), {
        isDevelopment: false,
        isApiError: false,
        statusCode: 500,
      });
      assert.strictEqual(nonDevMsg, 'Internal Server Error');
    } finally {
      (config as any).isDevelopment = prevDev;
      console.error = origErr;
      server.close();
    }
  });

  it('logs sanitized DB diagnostic details when authenticateToken and authenticateAgentToken fail closed', async () => {
    const logged: string[] = [];
    const origErr = console.error;
    console.error = (...args: any[]) => logged.push(args.map((a) => JSON.stringify(a)).join(' '));

    const revocationMock = mock.method(SessionRevocationService, 'isTokenRevoked', async () => false);
    const userMock = mock.method(UserModel, 'findAuthStatus', async () => {
      throw Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' });
    });
    const agentMock = mock.method(AgentModel, 'findByTokenHash', async () => {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5433'), { code: 'ECONNREFUSED' });
    });

    try {
      const token = jwt.sign({ id: 'u-1', email: 'test@example.com', typ: 'access' }, config.jwt.secret);
      let userNextErr: any = null;
      await authenticateToken({ headers: { authorization: `Bearer ${token}` } } as any, {} as any, (e?: any) => {
        userNextErr = e;
      });
      assert.strictEqual(userNextErr?.statusCode, 500);
      assert.strictEqual(userNextErr?.message, 'Lỗi cơ sở dữ liệu khi xác thực trạng thái tài khoản');

      let agentNextErr: any = null;
      await authenticateAgentToken(
        { headers: { 'x-agent-token': 'cap_sampletoken_123456' } } as any,
        {} as any,
        (e?: any) => {
          agentNextErr = e;
        }
      );
      assert.strictEqual(agentNextErr?.statusCode, 500);
      assert.strictEqual(agentNextErr?.message, 'Lỗi cơ sở dữ liệu khi xác thực Agent');

      const allLogs = logged.join('\n');
      assert.ok(allLogs.includes('[AuthMiddleware] DB status lookup failed:'));
      assert.ok(allLogs.includes('28P01'));
      assert.ok(allLogs.includes('[AgentAuthMiddleware] DB lookup failed:'));
    } finally {
      revocationMock.mock.restore();
      userMock.mock.restore();
      agentMock.mock.restore();
      console.error = origErr;
    }
  });
});
