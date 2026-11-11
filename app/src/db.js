// MySQL connection pool (Amazon RDS in production, local MySQL/MariaDB in development).
// Every query uses ? placeholders (prepared statements), never string concatenation.
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: false,
});

// Every connection works in UTC, so CURRENT_TIMESTAMP and UTC_TIMESTAMP() always agree
// (RDS defaults to UTC; a local MySQL on a Cairo PC would otherwise use local time).
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { pool, query, one };
