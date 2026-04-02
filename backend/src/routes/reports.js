const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/attendance', async (req, res, next) => {
  try {
    const { org_id, from, to } = req.query;
    const fromDate = from || new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    const result = await query(`
      SELECT e.starts_at::date AS date, e.name AS event_name,
        COUNT(DISTINCT ci.family_id) AS families, COUNT(ci.id) AS children
      FROM events e JOIN checkins ci ON ci.event_id=e.id
      WHERE e.organization_id=$1 AND e.starts_at::date BETWEEN $2 AND $3
      GROUP BY e.starts_at::date,e.name ORDER BY e.starts_at::date DESC
    `, [org_id, fromDate, toDate]);
    res.json({ success: true, report: result.rows });
  } catch(err) { next(err); }
});

router.get('/export/csv', async (req, res, next) => {
  try {
    const { event_id } = req.query;
    const result = await query(`
      SELECT c.full_name AS "Nombre",c.age_years AS "Edad",f.name AS "Familia",
        cl.name AS "Clase",cl.room_number AS "Aula",ci.security_code AS "Código",
        TO_CHAR(ci.checked_in_at,'HH12:MI AM') AS "Check-In",
        TO_CHAR(ci.checked_out_at,'HH12:MI AM') AS "Check-Out"
      FROM checkins ci JOIN children c ON c.id=ci.child_id JOIN families f ON f.id=ci.family_id
      LEFT JOIN classrooms cl ON cl.id=ci.classroom_id WHERE ci.event_id=$1 ORDER BY ci.checked_in_at
    `, [event_id]);
    const headers = Object.keys(result.rows[0] || {});
    const csv = [headers.join(','), ...result.rows.map(r => headers.map(h => `"${r[h]||''}"`).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename="checkins-${event_id}.csv"`);
    res.send('\uFEFF'+csv);
  } catch(err) { next(err); }
});

module.exports = router;
