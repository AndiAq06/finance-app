import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.ppvsjummgciubdlydclk:lo6CqnAoySyAQLGA@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
