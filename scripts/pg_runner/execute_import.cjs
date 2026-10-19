const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.ppvsjummgciubdlydclk:lo6CqnAoySyAQLGA@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function run() {
  console.log('Connecting to Supabase...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL successfully!');

  const sqlFile = path.resolve(__dirname, '../supabase_import.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Executing schema & data import...');
  await client.query(sql);

  console.log('Import completed successfully!');

  // Verify users
  const resUsers = await client.query('SELECT id, name, email FROM users');
  console.log('Users in database:', resUsers.rows);

  const resAccounts = await client.query('SELECT count(*) FROM accounts');
  console.log('Total accounts:', resAccounts.rows[0].count);

  const resTransactions = await client.query('SELECT count(*) FROM transactions');
  console.log('Total transactions:', resTransactions.rows[0].count);

  await client.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
