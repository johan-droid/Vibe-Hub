import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { pool } from './apps/server-bridge/db.js';

async function test() {
  const { rows } = await pool.query('SELECT * FROM user_sessions ORDER BY created_at DESC LIMIT 5');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

test().catch(console.error);
