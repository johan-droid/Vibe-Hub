import '../load-env.js';
import { pool } from '../db.js';

async function check() {
  try {
    const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log('Tables in database:');
    res.rows.forEach(row => console.log(`- ${row.tablename}`));
    
    const oauthStates = res.rows.find(r => r.tablename === 'oauth_states');
    const oauthHandoffs = res.rows.find(r => r.tablename === 'oauth_handoffs');
    
    if (oauthStates && oauthHandoffs) {
      console.log('\nVerification: OAuth tables exist! ✅');
    } else {
      console.log('\nVerification: Missing OAuth tables! ❌');
    }
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    await pool.end();
    process.exit();
  }
}

check();
