import fs from 'fs';
import path from 'path';

function splitValues(valuesStr) {
  const rows = [];
  let inString = false;
  let escape = false;
  let currentVal = '';
  let currentRow = [];

  for (let i = 0; i < valuesStr.length; i++) {
    const c = valuesStr[i];

    if (inString) {
      if (escape) {
        currentVal += c;
        escape = false;
      } else if (c === '\\') {
        currentVal += c;
        escape = true;
      } else if (c === "'") {
        currentVal += c;
        inString = false;
      } else {
        currentVal += c;
      }
    } else {
      if (c === '(') {
        currentRow = [];
        currentVal = '';
      } else if (c === ')') {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (c === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (c === "'") {
        currentVal += c;
        inString = true;
      } else if (!/\s/.test(c)) {
        currentVal += c;
      }
    }
  }

  return rows;
}

// Table boolean column indices (0-based)
const booleanCols = {
  users: [6], // is_demo
  preferences: [8, 9, 10, 11, 12, 14], // notify_*, hide_sensitive_in_notifications
  accounts: [8], // is_active
  categories: [6], // is_default
  recurrings: [13], // is_active
  debts: [],
  bills: [10], // is_active
  transactions: [11], // has_attachment
  transfers: [],
  budgets: [5], // is_recurring
  savings_goals: [],
  savings_contributions: [],
  debt_payments: [],
  bill_payments: [],
  notifications: []
};

const sqlPath = path.resolve('finora_backup.sql');
const content = fs.readFileSync(sqlPath, 'utf8');

const tableInserts = {};
for (const line of content.split('\n')) {
  const match = line.match(/^INSERT INTO `(\w+)` VALUES (.*);$/);
  if (match) {
    const table = match[1];
    const valsStr = match[2];
    if (booleanCols[table] !== undefined) {
      const rows = splitValues(valsStr);
      const convertedRows = rows.map(row => {
        const boolIndices = booleanCols[table] || [];
        return row.map((val, idx) => {
          if (boolIndices.includes(idx)) {
            if (val === '1' || val === "'1'") return 'TRUE';
            if (val === '0' || val === "'0'") return 'FALSE';
          }
          return val;
        });
      });
      tableInserts[table] = `INSERT INTO ${table} VALUES \n` + convertedRows.map(r => `  (${r.join(', ')})`).join(',\n') + ';';
    }
  }
}

// Read schema template from convert_dump_to_pg.mjs
const template = fs.readFileSync(path.resolve('scripts/convert_dump_to_pg.mjs'), 'utf8');
const schemaMatch = template.match(/const schemaDDL = `([\s\S]*?)`;/);
const schemaDDL = schemaMatch[1];

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

// Insert order to respect foreign keys:
const order = [
  'users',
  'preferences',
  'accounts',
  'categories',
  'recurrings',
  'debts',
  'bills',
  'transactions',
  'transfers',
  'budgets',
  'savings_goals',
  'savings_contributions',
  'debt_payments',
  'bill_payments',
  'notifications'
];

const insertSql = order.filter(t => tableInserts[t]).map(t => tableInserts[t]).join('\n\n');

// Clean drop table statements to allow fresh import
const dropTables = order.slice().reverse().map(t => `DROP TABLE IF EXISTS ${t} CASCADE;`).join('\n');

const finalSql = `${dropTables}\n\n${schemaDDL}\n\n${insertSql}\n\n${resetSequences}\n`;

fs.writeFileSync(path.resolve('scripts/supabase_import.sql'), finalSql, 'utf8');
console.log('Successfully generated clean PostgreSQL migration SQL with booleans converted!');
