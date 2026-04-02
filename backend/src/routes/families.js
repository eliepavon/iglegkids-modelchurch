const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

router.post('/search', async (req, res, next) => {
  try {
    const { phone_last4, qr_token, organization_id } = req.body;
    if (!phone_last4 && !qr_token) throw new AppError('Se requiere teléfono o QR', 400);
    let sql, params;
    if (qr_token) {
      sql = `SELECT f.id,f.name,f.phone_primary,f.qr_token,f.checkin_count,f.last_checkin_at FROM families f WHERE f.qr_token=$1 AND f.is_active=TRUE AND f.organization_id=$2`;
      params = [qr_token, organization_id];
    } else {
      sql = `SELECT f.id,f.name,f.phone_primary,f.qr_token,f.checkin_count,f.last_checkin_at FROM families f WHERE RIGHT(f.phone_primary,4)=$1 AND f.is_active=TRUE AND f.organization_id=$2 ORDER BY f.checkin_count DESC LIMIT 5`;
      params = [phone_last4, organization_id];
    }
    const famRes = await query(sql, params);
    if (!famRes.rows.length) throw new AppError('Familia no encontrada', 404);
    const famIds = famRes.rows.map(f => f.id);
    const kidRes = await query(`
      SELECT c.id,c.family_id,c.first_name,c.last_name,c.full_name,c.birthdate,c.age_years,
        c.has_allergies,c.allergies,c.medical_notes,c.special_needs,c.checkin_count,
        cl.id AS suggested_classroom_id,cl.name AS suggested_classroom_name,cl.room_number AS suggested_room_number
      FROM children c
      LEFT JOIN classrooms cl ON cl.organization_id=c.organization_id AND cl.is_active=TRUE
        AND (cl.min_age IS NULL OR c.age_years>=cl.min_age)
        AND (cl.max_age IS NULL OR c.age_years<=cl.max_age)
        AND cl.id=(SELECT id FROM classrooms WHERE organization_id=c.organization_id AND is_active=TRUE
          AND (min_age IS NULL OR c.age_years>=min_age) AND (max_age IS NULL OR c.age_years<=max_age)
          ORDER BY sort_order LIMIT 1)
      WHERE c.family_id=ANY($1) AND c.is_active=TRUE ORDER BY c.age_years DESC
    `, [famIds]);
    const families = famRes.rows.map(f => ({
      ...f,
      phone_display: '···· ' + f.phone_primary.slice(-4),
      children: kidRes.rows.filter(c => c.family_id === f.id).map(c => ({
        ...c,
        alerts: [
          ...(c.has_allergies && c.allergies?.length ? [{type:'medical',severity:'high',text:`Alergia: ${c.allergies.join(', ')}`}] : []),
          ...(c.medical_notes ? [{type:'medical',severity:'medium',text:c.medical_notes}] : []),
          ...(c.special_needs ? [{type:'note',severity:'low',text:c.special_needs}] : [])
        ]
      }))
    }));
    res.json({ success: true, families, count: families.length });
  } catch(err) { next(err); }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ci.id,ci.security_code,ci.checked_in_at,ci.checked_out_at,ci.checkin_method,
        c.full_name AS child_name,e.name AS event_name,e.starts_at,
        cl.name AS classroom_name,cl.room_number
      FROM checkins ci
      JOIN children c ON c.id=ci.child_id
      JOIN events e ON e.id=ci.event_id
      LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
      WHERE ci.family_id=$1 ORDER BY ci.checked_in_at DESC LIMIT 50
    `, [req.params.id]);
    res.json({ success: true, history: result.rows });
  } catch(err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { organization_id, name, phone_primary, email } = req.body;
    if (!name || !phone_primary) throw new AppError('Nombre y teléfono requeridos', 400);
    const result = await query(`
      INSERT INTO families (organization_id,name,phone_primary,email)
      VALUES ($1,$2,$3,$4) RETURNING id,name,qr_token,created_at
    `, [organization_id, name, phone_primary, email]);
    res.status(201).json({ success: true, family: result.rows[0] });
  } catch(err) { next(err); }
});

module.exports = router;
