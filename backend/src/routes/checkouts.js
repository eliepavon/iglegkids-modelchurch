const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

router.post('/', async (req, res, next) => {
  try {
    const { security_code, event_id, checked_out_by, organization_id } = req.body;
    if (!security_code || !event_id) throw new AppError('Código y evento requeridos', 400);
    const code = security_code.toUpperCase().trim();
    const result = await withTransaction(async (client) => {
      const ciRes = await client.query(`
        SELECT ci.id,ci.security_code,ci.checked_in_at,ci.family_id,ci.child_id,
          c.full_name AS child_name,c.age_years,
          f.name AS family_name,
          cl.name AS classroom_name,cl.room_number,
          e.name AS event_name
        FROM checkins ci
        JOIN children c ON c.id=ci.child_id
        JOIN families f ON f.id=ci.family_id
        LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
        JOIN events e ON e.id=ci.event_id
        WHERE ci.security_code=$1 AND ci.event_id=$2 AND ci.checked_out_at IS NULL
        ORDER BY c.full_name
      `, [code, event_id]);
      if (!ciRes.rows.length) {
        await client.query(`INSERT INTO security_logs (organization_id,event_type,details) VALUES ($1,'failed_checkout',$2)`,
          [organization_id, JSON.stringify({ code, event_id })]);
        throw new AppError('Código inválido o ya utilizado', 400);
      }
      const ids = ciRes.rows.map(ci => ci.id);
      await client.query(`UPDATE checkins SET checked_out_at=NOW(),checked_out_by=$1,checkout_verified=TRUE WHERE id=ANY($2)`,
        [checked_out_by, ids]);
      return {
        security_code: code,
        family_name: ciRes.rows[0].family_name,
        event_name: ciRes.rows[0].event_name,
        children: ciRes.rows.map(ci => ({ child_name: ci.child_name, classroom_name: ci.classroom_name, room_number: ci.room_number, checked_in_at: ci.checked_in_at })),
        checked_out_at: new Date().toISOString(),
        count: ciRes.rows.length
      };
    });
    const io = req.app.get('io');
    if (io) io.to('dashboard').emit('checkout_completed', { family_name: result.family_name, count: result.count });
    res.json({ success: true, ...result });
  } catch(err) { next(err); }
});

router.post('/verify', async (req, res, next) => {
  try {
    const { security_code, event_id } = req.body;
    const code = security_code?.toUpperCase().trim();
    const result = await query(`
      SELECT ci.id,c.full_name AS child_name,cl.name AS classroom_name,f.name AS family_name
      FROM checkins ci
      JOIN children c ON c.id=ci.child_id
      JOIN families f ON f.id=ci.family_id
      LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
      WHERE ci.security_code=$1 AND ci.event_id=$2 AND ci.checked_out_at IS NULL
    `, [code, event_id]);
    res.json({ valid: result.rows.length > 0, children: result.rows, count: result.rows.length });
  } catch(err) { next(err); }
});

module.exports = router;
