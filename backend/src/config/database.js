const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20
});
const query = async (t, p) => {
  try { return await pool.query(t, p); }
  catch(e) { console.error('DB Error:', e.message); throw e; }
};
const withTransaction = async (cb) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await cb(c);
    await c.query('COMMIT');
    return r;
  } catch(e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
};
module.exports = { pool, query, withTransaction };
