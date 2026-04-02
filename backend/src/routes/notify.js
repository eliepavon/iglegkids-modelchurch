const express = require('express');
const router = express.Router();

router.post('/page', async (req, res, next) => {
  try {
    const { child_name, message } = req.body;
    console.log(`📣 PAGE: ${child_name} | ${message}`);
    const client = process.env.TWILIO_ACCOUNT_SID ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
    if (!client) return res.json({ success: true, method: 'logged', message: 'Twilio no configurado' });
    res.json({ success: true, method: 'sms' });
  } catch(err) { next(err); }
});

router.post('/checkin-confirmation', async (req, res) => {
  res.json({ success: true });
});

module.exports = router;
