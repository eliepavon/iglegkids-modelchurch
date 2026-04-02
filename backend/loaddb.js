const { pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function load() {
  try {
    console.log('Cargando schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'src/config/schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Schema creado');

    console.log('Cargando datos de prueba...');
    const seed = fs.readFileSync(path.join(__dirname, 'src/config/seed.sql'), 'utf8');
    await pool.query(seed);
    console.log('✅ Datos cargados');

    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

load();
