import mysql from 'mysql2/promise';

// Create a connection pool to the database
export const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Assuming default XAMPP no password
  database: 'grc_clinic_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
