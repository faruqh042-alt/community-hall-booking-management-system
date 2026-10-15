// db.js
// This file creates a connection pool to our MySQL database.
// A "pool" lets many requests use the database at the same time without
// opening/closing a new connection every single time (which is slow).

const mysql = require('mysql2/promise'); // promise-based version so we can use async/await
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'community_hall_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10, // max simultaneous connections
  queueLimit: 0
});

// Quick test function you can call to confirm DB is reachable.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL database connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ Could not connect to MySQL database:', err.message);
  }
}

module.exports = { pool, testConnection };
