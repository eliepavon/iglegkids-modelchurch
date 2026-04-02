const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

router.get('/', async (req, res, next) => {
  try {
    const { organization_id, status } = req.query;
    const result = await query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM checkins ci WHERE ci.event_id=e.id) AS total_checkins,
        (SELECT COUNT(*) FROM checkins ci WHERE ci.event_id=e.id AND ci.checked_out_at IS NULL) AS still_in
      FROM events e WHERE e.organization_id=$1 ${status ? 'AND e.status=$2' : ''}
      ORDER BY e.starts_at DESC LIMIT 50
    `, status ? [organization_id, status] : [organization_id]);
    res.json({ success: true, events: result.rows });
  } catch(err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try {
    const { organization_id } = req.query;
    const result = await query(`
      SELECT * FROM events WHERE organization_id=$1
        AND status IN ('active','scheduled')
        AND starts_at >= NOW() - INTERVAL '8 hours'
      ORDER BY starts_at ASC LIMIT 1
    `, [organization_id]);
    res.json({ success: true, event: result.rows[0] || null });
  } catch(err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { organization_id, location_id, name, starts_at, ends_at } = req.body;
    const result = await query(`
      INSERT INTO events (organization_id,location_id,name,starts_at,ends_at,status)
      VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING *
    `, [organization_id, location_id, name, starts_at, ends_at]);
    res.status(201).json({ success: true, event: result.rows[0] });
  } catch(err) { next(err); }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    await query('UPDATE events SET status=$1,updated_at=NOW() WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch(err) { next(err); }
});

module.exports = router;
