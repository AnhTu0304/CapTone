import test, { describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isNonTransactionalMigration, splitSqlStatements } from '../scripts/migrate';

describe('migrate non-transactional statement splitting', () => {
  test('detects 34_optimize_logs_indexes.sql as non-transactional and splits into 5 single statements', () => {
    const sqlPath = path.resolve(__dirname, '../../migrations/34_optimize_logs_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    assert.strictEqual(isNonTransactionalMigration(sql), true);
    const statements = splitSqlStatements(sql);
    assert.strictEqual(statements.length, 5);
    for (const stmt of statements) {
      assert.match(stmt, /^CREATE INDEX CONCURRENTLY IF NOT EXISTS /);
      assert.ok(!stmt.includes(';'));
    }
  });

  test('preserves semicolons inside single-quoted string literals', () => {
    const statements = splitSqlStatements("SELECT 'a;b' AS x; -- comment;\nSELECT 1;");
    assert.deepStrictEqual(statements, ["SELECT 'a;b' AS x", 'SELECT 1']);
  });
});
