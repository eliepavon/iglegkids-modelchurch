const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

router.post('/', async (req, res, next) => {
  try {
    const { family_id, organization_id, first_name, last_name, birthdate,
      has_allergies, allergies, medical_notes, special_needs, emergency_contact, emergency_phone } = req.body;
    if (!family_id || !first_name || !last_name || !birthdate) throw new AppError('Datos requeridos incompletos', 400);
    const result = await query(`
      INSERT INTO children (family_id,organization_id,first_name,last_name,birthdate,
        has_allergies,allergies,medical_notes,special_needs,emergency_contact,emergency_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id,full_name,age_years,birthdate
    `, [family_id, organization_id, first_name, last_name, birthdate,
        has_allergies||false, allergies||[], medical_notes, special_needs, emergency_contact, emergency_phone]);
    res.status(201).json({ success: true, child: result.rows[0] });
  } catch(err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { first_name, last_name, birthdate, medical_notes, has_allergies, allergies, special_needs } = req.body;
    await query(`UPDATE children SET first_name=$1,last_name=$2,birthdate=$3,medical_notes=$4,
      has_allergies=$5,allergies=$6,special_needs=$7,updated_at=NOW() WHERE id=$8`,
      [first_name, last_name, birthdate, medical_notes, has_allergies, allergies, special_needs, req.params.id]);
    res.json({ success: true });
  } catch(err) { next(err); }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ci.checked_in_at,ci.checked_out_at,ci.security_code,
        e.name AS event_name,cl.name AS classroom_name
      FROM checkins ci
      JOIN events e ON e.id=ci.event_id
      LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
      WHERE ci.child_id=$1 ORDER BY ci.checked_in_at DESC LIMIT 50
    `, [req.params.id]);
    res.json({ success: true, history: result.rows });
  } catch(err) { next(err); }
});

module.exports = router;
