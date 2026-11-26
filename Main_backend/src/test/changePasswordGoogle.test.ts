import test, { describe, after } from 'node:test';
import assert from 'node:assert';
import { UserService } from '../services/user.service';
import { UserModel } from '../models/user.model';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';

describe('UserService.changePassword passwordless Google guard', () => {
  after(async () => {
    await Promise.race([
      redisClient.quit().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ]);
    (redisClient as any).disconnect?.();
    await pool.end().catch(() => {});
  });
  test('returns 404 when user does not exist', async () => {
    const orig = UserModel.findByIdWithPassword;
    UserModel.findByIdWithPassword = async () => null;
    try {
      await assert.rejects(
        () => UserService.changePassword('missing-id', { old_password: 'old', new_password: 'newpassword1' }),
        (err: any) => err?.statusCode === 404 && /không tồn tại/i.test(err.message)
      );
    } finally {
      UserModel.findByIdWithPassword = orig;
    }
  });

  test('returns 400 with Google notice when user exists without password_hash', async () => {
    const orig = UserModel.findByIdWithPassword;
    UserModel.findByIdWithPassword = async () => ({
      id: 'google-user-1',
      email: 'google@gmail.com',
      full_name: 'Google User',
      password_hash: undefined,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    try {
      await assert.rejects(
        () => UserService.changePassword('google-user-1', { old_password: 'old', new_password: 'newpassword1' }),
        (err: any) => err?.statusCode === 400 && /Google/i.test(err.message)
      );
    } finally {
      UserModel.findByIdWithPassword = orig;
    }
  });
});
