import { pool } from '../config/database';

async function main() {
  const res = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'healing_actions'::regclass
  `);
  console.log(JSON.stringify(res.rows, null, 2));

  const cols = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'healing_actions'
  `);
  console.log(JSON.stringify(cols.rows, null, 2));
  const enums = await pool.query(`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'execution_status' 
    ORDER BY enumsortorder
  `);
  console.log('execution_status enum values:', JSON.stringify(enums.rows.map(x => x.enumlabel)));
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
