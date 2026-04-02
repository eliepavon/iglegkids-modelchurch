const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

function generateCode() {
  const L='ABCDEFGHJKLMNPQRSTUVWXYZ', D='23456789';
  return L[Math.floor(Math.random()*L.length)] +
    Array.from({length:3},()=>D[Math.floor(Math.random()*D.length)]).join('');
}

router.post('/', async (req, res, next) => {
  try {
    const { event_id, family_id, child_ids, checkin_method='phone', organization_id } = req.body;
    if (!event_id || !family_id || !child_ids?.length) throw new AppError('Faltan datos requeridos', 400);
    const result = await withTransaction(async (client) => {
      const evRes = await client.query('SELECT id,name,status FROM events WHERE id=$1 AND organization_id=$2', [event_id, organization_id]);
      if (!evRes.rows.length) throw new AppError('Evento no encontrado', 404);
      if (evRes.rows[0].status === 'cancelled') throw new AppError('Evento cancelado', 400);
      const famRes = await client.query('SELECT id,name FROM families WHERE id=$1 AND organization_id=$2 AND is_active=TRUE', [family_id, organization_id]);
      if (!famRes.rows.length) throw new AppError('Familia no encontrada', 404);
      const existCode = await client.query('SELECT security_code FROM checkins WHERE event_id=$1 AND family_id=$2 LIMIT 1', [event_id, family_id]);
      let securityCode = existCode.rows.length ? existCode.rows[0].security_code : null;
      if (!securityCode) {
        let attempts = 0;
        do {
          securityCode = generateCode();
          const col = await client.query('SELECT 1 FROM checkins WHERE event_id=$1 AND security_code=$2', [event_id, securityCode]);
          if (!col.rows.length) break;
          attempts++;
        } while (attempts < 10);
      }
      const checkins = [];
      for (const child_id of child_ids) {
        const childRes = await client.query(`
          SELECT c.*,(SELECT id FROM classrooms WHERE organization_id=$2 AND is_active=TRUE
            AND (min_age IS NULL OR c.age_years>=min_age) AND (max_age IS NULL OR c.age_years<=max_age)
            ORDER BY sort_order LIMIT 1) AS auto_classroom_id
          FROM children c WHERE c.id=$1 AND c.family_id=$3 AND c.is_active=TRUE
        `, [child_id, organization_id, family_id]);
        if (!childRes.rows.length) throw new AppError('Niño no encontrado', 400);
        const child = childRes.rows[0];
        const dup = await client.query('SELECT id FROM checkins WHERE event_id=$1 AND child_id=$2', [event_id, child_id]);
        if (dup.rows.length) throw new AppError(`${child.full_name} ya tiene check-in en este evento`, 409);
        const classroom_id = child.auto_classroom_id;
        const ciRes = await client.query(`
          INSERT INTO checkins (event_id,family_id,child_id,classroom_id,organization_id,security_code,checkin_method)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,security_code,checked_in_at
        `, [event_id, family_id, child_id, classroom_id, organization_id, securityCode, checkin_method]);
        let classroom = null;
        if (classroom_id) {
          const clRes = await client.query('SELECT name,room_number FROM classrooms WHERE id=$1', [classroom_id]);
          classroom = clRes.rows[0];
        }
        checkins.push({ checkin_id: ciRes.rows[0].id, child_name: child.full_name, classroom, security_code: securityCode, checked_in_at: ciRes.rows[0].checked_in_at });
      }
      return { family_name: famRes.rows[0].name, event_name: evRes.rows[0].name, security_code: securityCode, checkins };
    });
    const io = req.app.get('io');
    if (io) io.to('dashboard').emit('checkin_added', { family_name: result.family_name, count: result.checkins.length, security_code: result.security_code });
    res.status(201).json({ success: true, ...result });
  } catch(err) { next(err); }
});

router.get('/event/:eventId', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ci.id,ci.security_code,ci.checked_in_at,ci.checked_out_at,ci.checkin_method,
        c.full_name AS child_name,c.age_years,c.has_allergies,c.medical_notes,
        f.name AS family_name,cl.name AS classroom_name,cl.room_number
      FROM checkins ci
      JOIN children c ON c.id=ci.child_id
      JOIN families f ON f.id=ci.family_id
      LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
      WHERE ci.event_id=$1 ORDER BY ci.checked_in_at DESC
    `, [req.params.eventId]);
    res.json({ success: true, checkins: result.rows, count: result.rows.length });
  } catch(err) { next(err); }
});

module.exports = router;
