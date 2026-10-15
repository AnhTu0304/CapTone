import { pool } from '../src/config/database';

async function listTables() {
  try {
    const res = await pool.query(`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`TOTAL_TABLES: ${res.rows.length}`);
    for (const row of res.rows) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM "${row.table_name}"`);
        console.log(`TABLE: ${row.table_name} | COLUMNS: ${row.column_count} | ROWS: ${countRes.rows[0].cnt}`);
      } catch (err) {
        console.log(`TABLE: ${row.table_name} | COLUMNS: ${row.column_count} | ROWS: error`);
      }
    }
  } catch (error) {
    console.error('Error querying tables:', error);
  } finally {
    await pool.end();
  }
}

listTables();
