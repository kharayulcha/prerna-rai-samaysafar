import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/index.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ 
  connectionString,
  ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma