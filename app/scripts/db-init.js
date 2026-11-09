// Creates the tables and loads the catalog into the database named in .env.
// On EC2:  cd app && npm run db:init     (RDS is only reachable from inside the VPC)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', file), 'utf8');
    await conn.query(sql);
    console.log(`✓ ran db/${file} on ${config.db.host}/${config.db.database}`);
  }
  const [[{ clubs }]] = await conn.query('SELECT COUNT(*) AS clubs FROM clubs');
  const [[{ artists }]] = await conn.query('SELECT COUNT(*) AS artists FROM artists');
  console.log(`✓ catalog: ${clubs} clubs, ${artists} artists`);
  await conn.end();
})().catch((err) => {
  console.error('✗ db:init failed:', err.message);
  process.exit(1);
});
