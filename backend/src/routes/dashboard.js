const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/metrics/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const [totals, byClassroom, recent] = await Promise.all([
      query(`SELECT COUNT(*) AS total_checkins,
        COUNT(*) FILTER (WHERE checked_out_at IS NULL) AS still_in,
        COUNT(*) FILTER (WHERE checked_out_at IS NOT NULL) AS checked_out,
        COUNT(DISTINCT family_id) AS families_present,
        COUNT(*) FILTER (WHERE checkin_method='qr') AS via_qr,
        COUNT(*) FILTER (WHERE checkin_method='express') AS via_express
        FROM checkins WHERE event_id=$1`, [eventId]),
      query(`SELECT cl.name AS classroom_name,cl.room_number,cl.capacity,
        COUNT(ci.id) AS current_count,
        COUNT(ci.id) FILTER (WHERE ci.checked_out_at IS NULL) AS still_in
        FROM classrooms cl
        LEFT JOIN checkins ci ON ci.classroom_id=cl.id AND ci.event_id=$1
        WHERE cl.organization_id=(SELECT organization_id FROM events WHERE id=$1) AND cl.is_active=TRUE
        GROUP BY cl.id,cl.name,cl.room_number,cl.capacity ORDER BY cl.sort_order`, [eventId]),
      query(`SELECT ci.security_code,ci.checked_in_at,ci.checkin_method,
        c.full_name AS child_name,cl.room_number,f.name AS family_name
        FROM checkins ci
        JOIN children c ON c.id=ci.child_id
        JOIN families f ON f.id=ci.family_id
        LEFT JOIN classrooms cl ON cl.id=ci.classroom_id
        WHERE ci.event_id=$1 ORDER BY ci.checked_in_at DESC LIMIT 10`, [eventId])
    ]);
    res.json({ success: true, metrics: { ...totals.rows[0], by_classroom: byClassroom.rows, recent_checkins: recent.rows }});
  } catch(err) { next(err); }
});

router.get('/summary/:orgId', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT COUNT(DISTINCT ci.family_id) AS families_today,
        COUNT(ci.id) AS children_today,
        COUNT(ci.id) FILTER (WHERE ci.checked_out_at IS NULL) AS still_in
      FROM checkins ci JOIN events e ON e.id=ci.event_id
      WHERE e.organization_id=$1 AND e.starts_at>=CURRENT_DATE
    `, [req.params.orgId]);
    res.json({ success: true, summary: result.rows[0] });
  } catch(err) { next(err); }
});

module.exports = router;
