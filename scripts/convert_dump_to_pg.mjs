import fs from 'fs';
import path from 'path';

const sqlPath = path.resolve('finora_backup.sql');
const content = fs.readFileSync(sqlPath, 'utf8');

// Schema DDL for PostgreSQL (Supabase)
const schemaDDL = `
-- Finora PostgreSQL Schema for Supabase

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  email_verified_at TIMESTAMPTZ,
  password VARCHAR(255) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  remember_token VARCHAR(100),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  locale VARCHAR(10) NOT NULL DEFAULT 'id',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  date_format VARCHAR(30) NOT NULL DEFAULT 'd MMM yyyy',
  theme VARCHAR(20) NOT NULL DEFAULT 'light',
  week_starts_on SMALLINT NOT NULL DEFAULT 1,
  notify_transaction BOOLEAN NOT NULL DEFAULT TRUE,
  notify_budget BOOLEAN NOT NULL DEFAULT TRUE,
  notify_bill BOOLEAN NOT NULL DEFAULT TRUE,
  notify_goal BOOLEAN NOT NULL DEFAULT TRUE,
  notify_debt BOOLEAN NOT NULL DEFAULT TRUE,
  bill_reminder_days SMALLINT NOT NULL DEFAULT 3,
  hide_sensitive_in_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'cash',
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  start_date DATE NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#16A34A',
  icon VARCHAR(50) NOT NULL DEFAULT 'wallet',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'tag',
  color VARCHAR(20) NOT NULL DEFAULT '#16A34A',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recurrings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE,
  last_run_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  generated_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS debts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  party_name VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  next_due_date DATE,
  frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
  reminder_days SMALLINT NOT NULL DEFAULT 3,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  flow VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  notes TEXT,
  counterparty VARCHAR(255),
  has_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_name VARCHAR(255),
  attachment_path VARCHAR(255),
  recurring_id BIGINT REFERENCES recurrings(id) ON DELETE SET NULL,
  debt_id BIGINT REFERENCES debts(id) ON DELETE SET NULL,
  bill_id BIGINT REFERENCES bills(id) ON DELETE SET NULL,
  locked_reason VARCHAR(255),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  from_transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  to_transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  target_amount NUMERIC(15, 2) NOT NULL,
  deadline DATE,
  icon VARCHAR(50) NOT NULL DEFAULT 'target',
  color VARCHAR(20) NOT NULL DEFAULT '#16A34A',
  priority INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id BIGSERIAL PRIMARY KEY,
  savings_goal_id BIGINT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id BIGSERIAL PRIMARY KEY,
  debt_id BIGINT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  period_due_date DATE NOT NULL,
  paid_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  link VARCHAR(255),
  severity VARCHAR(50) NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
`;

// Extract INSERT INTO lines from mysql dump
const lines = content.split('\n');
const insertLines = [];

for (const line of lines) {
  if (line.startsWith('INSERT INTO `')) {
    // Convert: INSERT INTO `table` VALUES (...) -> INSERT INTO table VALUES (...)
    // and replace any MySQL backtick table names with unquoted
    let pgLine = line.replace(/INSERT INTO `(\w+)`/g, 'INSERT INTO $1');
    insertLines.push(pgLine);
  }
}

// Reset sequence SQL so auto-increment IDs continue correctly
const resetSequences = `
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('preferences', 'id'), COALESCE((SELECT MAX(id) FROM preferences), 1));
SELECT setval(pg_get_serial_sequence('accounts', 'id'), COALESCE((SELECT MAX(id) FROM accounts), 1));
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 1));
SELECT setval(pg_get_serial_sequence('recurrings', 'id'), COALESCE((SELECT MAX(id) FROM recurrings), 1));
SELECT setval(pg_get_serial_sequence('debts', 'id'), COALESCE((SELECT MAX(id) FROM debts), 1));
SELECT setval(pg_get_serial_sequence('bills', 'id'), COALESCE((SELECT MAX(id) FROM bills), 1));
SELECT setval(pg_get_serial_sequence('transactions', 'id'), COALESCE((SELECT MAX(id) FROM transactions), 1));
SELECT setval(pg_get_serial_sequence('transfers', 'id'), COALESCE((SELECT MAX(id) FROM transfers), 1));
SELECT setval(pg_get_serial_sequence('budgets', 'id'), COALESCE((SELECT MAX(id) FROM budgets), 1));
SELECT setval(pg_get_serial_sequence('savings_goals', 'id'), COALESCE((SELECT MAX(id) FROM savings_goals), 1));
SELECT setval(pg_get_serial_sequence('savings_contributions', 'id'), COALESCE((SELECT MAX(id) FROM savings_contributions), 1));
SELECT setval(pg_get_serial_sequence('debt_payments', 'id'), COALESCE((SELECT MAX(id) FROM debt_payments), 1));
SELECT setval(pg_get_serial_sequence('bill_payments', 'id'), COALESCE((SELECT MAX(id) FROM bill_payments), 1));
SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE((SELECT MAX(id) FROM notifications), 1));
`;

const finalSql = `${schemaDDL}\n\n-- Imported Data from MySQL Dump\n\n${insertLines.join('\n')}\n\n${resetSequences}\n`;

fs.writeFileSync(path.resolve('scripts/supabase_import.sql'), finalSql, 'utf8');
console.log('Successfully generated scripts/supabase_import.sql with', insertLines.length, 'insert statements!');
