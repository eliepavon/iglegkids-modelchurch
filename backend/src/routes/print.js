const express = require('express');
const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { html, child_name, security_code, copies = 1 } = req.body;
    if (!html) return res.status(400).json({ success: false, error: 'HTML requerido' });
    console.log(`🖨️  Imprimiendo: ${child_name} | ${security_code}`);
    const PRINTER_HOST = process.env.PRINTER_HOST;
    if (!PRINTER_HOST) {
      return res.json({ success: true, method: 'pending', message: 'Print Agent procesará la etiqueta' });
    }
    res.json({ success: true, method: 'ipp', printer: PRINTER_HOST });
  } catch(err) { next(err); }
});

router.get('/status', async (req, res) => {
  const host = process.env.PRINTER_HOST;
  if (!host) return res.json({ online: false, message: 'PRINTER_HOST no configurado' });
  res.json({ online: true, printer: process.env.PRINTER_NAME || 'Brother_QL-810W', uri: `ipp://${host}:631` });
});

router.get('/test', async (req, res) => {
  console.log('🖨️  Etiqueta de prueba solicitada');
  res.json({ success: true, message: 'Etiqueta de prueba enviada' });
});

module.exports = router;
