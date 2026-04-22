import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

// Load the backend .env
dotenv.config({ path: '../backend/.env' });

const connectionString = process.env.DATABASE_URL;
console.log("Testing connection to:", connectionString? (connectionString.substring(0, 30) + "...") : "undefined");

const pool = new Pool({ 
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client:', err.message);
    if (err.message.includes('not available')) {
        console.log('--- THIS MATCHES THE USER ERROR ---');
    }
    process.exit(1);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      console.error('Error executing query:', err.message);
      process.exit(1);
    }
    console.log('Successfully connected! Current time:', result.rows[0]);
    process.exit(0);
  });
});
