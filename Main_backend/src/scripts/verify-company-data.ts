import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { pool } from '../config/database';

async function run() {
  try {
    const org = await pool.query("SELECT id, name, slug FROM organizations WHERE name = 'Cloud DevOps Engineering Hub'");
    const orgId = org.rows[0].id;
    console.log('=== 1. TỔ CHỨC / CÔNG TY ===');
    console.log(org.rows[0]);

    console.log('\n=== 2. MÔI TRƯỜNG & CLUSTER THUỘC CÔNG TY ===');
    const env = await pool.query(
      `SELECT e.id as env_id, e.name as env_name, c.id as cluster_id, c.name as cluster_name 
       FROM environments e 
       JOIN clusters c ON c.environment_id = e.id 
       WHERE e.organization_id = $1`,
      [orgId]
    );
    console.log(env.rows);

    const clusterId = env.rows[0].cluster_id;
    const envId = env.rows[0].env_id;

    console.log('\n=== 3. SỰ CỐ (INCIDENTS) TRONG DATABASE GẮN VỚI CÔNG TY NÀY ===');
    const inc = await pool.query(
      `SELECT id, title, severity, status, organization_id, environment_id, cluster_id, created_at 
       FROM incidents 
       WHERE organization_id = $1 
       ORDER BY created_at DESC`,
      [orgId]
    );
    console.log(`Tổng số sự cố thuộc công ty (${orgId}):`, inc.rows.length);
    console.log(inc.rows);

    console.log('\n=== 4. HÀNH ĐỘNG TỰ PHỤC HỒI (HEALING_ACTIONS) GẮN VỚI SỰ CỐ CỦA CÔNG TY ===');
    const ha = await pool.query(
      `SELECT ha.id, hat.code, ha.target_name, ha.execution_status, ha.environment_id, ha.incident_id, ha.created_at 
       FROM healing_actions ha 
       JOIN healing_action_types hat ON hat.id = ha.action_type_id 
       JOIN incidents i ON i.id = ha.incident_id 
       WHERE i.organization_id = $1 
       ORDER BY ha.created_at DESC`,
      [orgId]
    );
    console.log(`Tổng số tự phục hồi thuộc công ty:`, ha.rows.length);
    console.log(ha.rows);

    console.log('\n=== 5. CÁC DỊCH VỤ MICROSERVICES THUỘC CỤM K8S CỦA CÔNG TY ===');
    const svc = await pool.query(
      `SELECT s.id, s.name, s.service_type, s.cluster_ip, s.status 
       FROM services s 
       WHERE s.cluster_id = $1`,
      [clusterId]
    );
    console.log(`Tổng số services trên cluster ${clusterId}:`, svc.rows.length);
    console.log(svc.rows);

  } catch (err) {
    console.error('Error verifying company data:', err);
  } finally {
    await pool.end();
  }
}

run();
