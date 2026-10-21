import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'finora_production_jwt_secret_key_2026_xyz';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres.ppvsjummgciubdlydclk:lo6CqnAoySyAQLGA@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const map: Record<string, string> = {};
  header.split(';').forEach(c => {
    const parts = c.trim().split('=');
    if (parts[0]) map[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
  });
  return map;
}

function getUserFromReq(req: VercelRequest): { id: number; email: string } | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.finora_token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string };
  } catch {
    return null;
  }
}

function setAuthCookie(res: VercelResponse, user: { id: number; email: string }, remember: boolean) {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: maxAge });
  
  const tokenCookie = `finora_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const xsrfCookie = `XSRF-TOKEN=token_${Math.random().toString(36).substring(2)}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`;

  res.setHeader('Set-Cookie', [tokenCookie, xsrfCookie]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Preflight
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-XSRF-TOKEN');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  // Normalize path
  if (pathname.startsWith('/api/index')) {
    pathname = pathname.replace('/api/index', '') || '/';
  }

  try {
    // 1. Sanctum CSRF Cookie compatibility
    if (pathname === '/sanctum/csrf-cookie' || pathname === '/api/sanctum/csrf-cookie') {
      res.setHeader('Set-Cookie', `XSRF-TOKEN=token_${Math.random().toString(36).substring(2)}; Path=/; Secure; SameSite=Lax; Max-Age=7200`);
      return res.status(204).end();
    }

    // 2. Auth: Login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password, remember } = req.body || {};
      if (!email || !password) {
        return res.status(422).json({ message: 'Email dan kata sandi wajib diisi.' });
      }

      const userRes = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (userRes.rows.length === 0) {
        return res.status(422).json({ message: 'Email atau kata sandi yang Anda masukkan salah.' });
      }

      const user = userRes.rows[0];
      const fixedHash = (user.password || '').replace(/^\$2y\$/, '$2a$');
      const valid = bcrypt.compareSync(password, fixedHash);

      if (!valid) {
        return res.status(422).json({ message: 'Email atau kata sandi yang Anda masukkan salah.' });
      }

      setAuthCookie(res, { id: Number(user.id), email: user.email }, Boolean(remember));

      const prefRes = await query('SELECT * FROM preferences WHERE user_id = $1', [user.id]);
      const preferences = prefRes.rows[0] || null;

      return res.status(200).json({
        user: {
          id: Number(user.id),
          name: user.name,
          email: user.email,
          is_demo: Boolean(user.is_demo),
          created_at: user.created_at,
        },
        preferences,
      });
    }

    // 3. Auth: Register
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { name, email, password } = req.body || {};
      if (!name || !email || !password) {
        return res.status(422).json({ message: 'Data pendaftaran tidak lengkap.' });
      }

      const existing = await query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(422).json({ message: 'Email sudah terdaftar.' });
      }

      const salt = bcrypt.genSaltSync(12);
      const hash = bcrypt.hashSync(password, salt);

      const insertUser = await query(
        `INSERT INTO users (name, email, password, is_demo, created_at, updated_at) 
         VALUES ($1, $2, $3, false, NOW(), NOW()) RETURNING id, name, email, is_demo, created_at`,
        [name.trim(), email.trim().toLowerCase(), hash]
      );
      const newUser = insertUser.rows[0];

      // Insert default preferences
      const insertPref = await query(
        `INSERT INTO preferences (user_id, currency, locale, timezone, date_format, theme, week_starts_on, notify_transaction, notify_budget, notify_bill, notify_goal, notify_debt, bill_reminder_days, hide_sensitive_in_notifications, created_at, updated_at)
         VALUES ($1, 'IDR', 'id', 'Asia/Jakarta', 'd MMM yyyy', 'light', 1, true, true, true, true, true, 3, false, NOW(), NOW()) RETURNING *`,
        [newUser.id]
      );

      // Insert default categories
      const defaultCats = [
        ['Gaji & Upah', 'income', 'banknote', '#16A34A'],
        ['Bisnis & Freelance', 'income', 'briefcase', '#0EA5E9'],
        ['Investasi & Bunga', 'income', 'trending-up', '#8B5CF6'],
        ['Makanan & Minuman', 'expense', 'utensils', '#F97316'],
        ['Transportasi', 'expense', 'car', '#0EA5E9'],
        ['Belanja Kebutuhan', 'expense', 'shopping-bag', '#E11D48'],
        ['Tagihan & Utilitas', 'expense', 'receipt', '#F59E0B'],
        ['Tempat Tinggal', 'expense', 'home', '#6366F1'],
        ['Hiburan & Liburan', 'expense', 'clapperboard', '#8B5CF6'],
        ['Kesehatan & Obat', 'expense', 'heart-pulse', '#EC4899']
      ];
      for (const [cname, ctype, cicon, ccolor] of defaultCats) {
        await query(
          `INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
          [newUser.id, cname, ctype, cicon, ccolor]
        );
      }

      setAuthCookie(res, { id: Number(newUser.id), email: newUser.email }, true);

      return res.status(200).json({
        user: {
          id: Number(newUser.id),
          name: newUser.name,
          email: newUser.email,
          is_demo: false,
          created_at: newUser.created_at,
        },
        preferences: insertPref.rows[0],
      });
    }

    // 4. Auth: Logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'finora_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return res.status(200).json({ message: 'Berhasil keluar.' });
    }

    // From here, user MUST be authenticated
    const authUser = getUserFromReq(req);
    if (!authUser) {
      if (pathname === '/api/auth/me') {
        return res.status(401).json({ message: 'Unauthenticated.' });
      }
      return res.status(401).json({ message: 'Sesi Anda telah berakhir. Silakan masuk kembali.' });
    }

    const userId = authUser.id;

    // 5. Auth: Me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const userRes = await query('SELECT id, name, email, is_demo, created_at FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ message: 'User not found.' });
      }
      const prefRes = await query('SELECT * FROM preferences WHERE user_id = $1', [userId]);
      return res.status(200).json({
        user: {
          id: Number(userRes.rows[0].id),
          name: userRes.rows[0].name,
          email: userRes.rows[0].email,
          is_demo: Boolean(userRes.rows[0].is_demo),
          created_at: userRes.rows[0].created_at,
        },
        preferences: prefRes.rows[0] || null,
      });
    }

    // 6. Update Preferences
    if (pathname === '/api/auth/preferences' && req.method === 'PUT') {
      const b = req.body || {};
      const update = await query(
        `UPDATE preferences SET 
          currency = COALESCE($1, currency),
          locale = COALESCE($2, locale),
          timezone = COALESCE($3, timezone),
          date_format = COALESCE($4, date_format),
          theme = COALESCE($5, theme),
          week_starts_on = COALESCE($6, week_starts_on),
          notify_transaction = COALESCE($7, notify_transaction),
          notify_budget = COALESCE($8, notify_budget),
          notify_bill = COALESCE($9, notify_bill),
          notify_goal = COALESCE($10, notify_goal),
          notify_debt = COALESCE($11, notify_debt),
          bill_reminder_days = COALESCE($12, bill_reminder_days),
          hide_sensitive_in_notifications = COALESCE($13, hide_sensitive_in_notifications),
          updated_at = NOW()
        WHERE user_id = $14 RETURNING *`,
        [
          b.currency, b.locale, b.timezone, b.date_format, b.theme, b.week_starts_on,
          b.notify_transaction, b.notify_budget, b.notify_bill, b.notify_goal, b.notify_debt,
          b.bill_reminder_days, b.hide_sensitive_in_notifications, userId
        ]
      );
      return res.status(200).json(update.rows[0]);
    }

    // 7. Accounts API
    if (pathname === '/api/accounts') {
      if (req.method === 'GET') {
        const includeInactive = url.searchParams.get('include_inactive') === '1';
        const accounts = await query(
          `SELECT a.*,
            COALESCE((SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id), 0) as transactions_count,
            (a.opening_balance + 
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'in'), 0) -
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'out'), 0)
            ) as balance
           FROM accounts a
           WHERE a.user_id = $1 ${includeInactive ? '' : 'AND a.is_active = true'}
           ORDER BY a.name ASC`,
          [userId]
        );
        let totalBalance = 0;
        const data = accounts.rows.map(a => {
          const bal = Number(a.balance);
          if (a.is_active) totalBalance += bal;
          return {
            id: Number(a.id),
            name: a.name,
            type: a.type,
            opening_balance: Number(a.opening_balance).toFixed(2),
            start_date: a.start_date ? new Date(a.start_date).toISOString().slice(0, 10) : null,
            color: a.color,
            icon: a.icon,
            is_active: Boolean(a.is_active),
            notes: a.notes,
            balance: bal.toFixed(2),
            transactions_count: Number(a.transactions_count),
          };
        });
        return res.status(200).json({
          data,
          total_balance: totalBalance.toFixed(2),
        });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO accounts (user_id, name, type, opening_balance, start_date, color, icon, is_active, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), NOW()) RETURNING *`,
          [userId, b.name, b.type || 'cash', b.opening_balance || 0, b.start_date || new Date().toISOString().slice(0, 10), b.color || '#16A34A', b.icon || 'wallet', b.notes || null]
        );
        const a = ins.rows[0];
        return res.status(201).json({
          ...a,
          id: Number(a.id),
          opening_balance: Number(a.opening_balance).toFixed(2),
          balance: Number(a.opening_balance).toFixed(2),
          transactions_count: 0
        });
      }
    }

    const accountMatch = pathname.match(/^\/api\/accounts\/(\d+)$/);
    if (accountMatch) {
      const accId = Number(accountMatch[1]);
      if (req.method === 'PUT') {
        const b = req.body || {};
        const upd = await query(
          `UPDATE accounts SET 
            name = COALESCE($1, name),
            type = COALESCE($2, type),
            color = COALESCE($3, color),
            icon = COALESCE($4, icon),
            notes = $5,
            updated_at = NOW()
           WHERE id = $6 AND user_id = $7 RETURNING *`,
          [b.name, b.type, b.color, b.icon, b.notes !== undefined ? b.notes : null, accId, userId]
        );
        return res.status(200).json(upd.rows[0]);
      }
      if (req.method === 'DELETE') {
        await query('UPDATE accounts SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2', [accId, userId]);
        return res.status(200).json({ message: 'Rekening dinonaktifkan.' });
      }
    }

    // 8. Categories API
    if (pathname === '/api/categories') {
      if (req.method === 'GET') {
        const cats = await query(
          `SELECT c.*,
            COALESCE((SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id), 0) as transactions_count
           FROM categories c
           WHERE c.user_id = $1 OR c.user_id IS NULL
           ORDER BY c.type, c.name ASC`,
          [userId]
        );
        return res.status(200).json({
          data: cats.rows.map(c => ({
            id: Number(c.id),
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            is_default: Boolean(c.is_default),
            transactions_count: Number(c.transactions_count),
          }))
        });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW()) RETURNING *`,
          [userId, b.name, b.type, b.icon || 'tag', b.color || '#16A34A']
        );
        return res.status(201).json({ ...ins.rows[0], id: Number(ins.rows[0].id) });
      }
    }

    const catMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (catMatch && req.method === 'DELETE') {
      const catId = Number(catMatch[1]);
      await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [catId, userId]);
      return res.status(200).json({ message: 'Kategori dihapus.' });
    }

    // 9. Dashboard API
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const now = new Date();
      const monthStr = url.searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [year, month] = monthStr.split('-').map(Number);
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Previous month
      const prevDate = new Date(year, month - 2, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

      // Accounts
      const accountsRes = await query(
        `SELECT a.*,
          (a.opening_balance + 
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'in'), 0) -
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'out'), 0)
          ) as balance,
          COALESCE((SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id), 0) as transactions_count
         FROM accounts a
         WHERE a.user_id = $1 AND a.is_active = true
         ORDER BY a.name ASC`,
        [userId]
      );

      let totalBalance = 0;
      const accounts = accountsRes.rows.map(a => {
        const bal = Number(a.balance);
        totalBalance += bal;
        return {
          id: Number(a.id),
          name: a.name,
          type: a.type,
          opening_balance: Number(a.opening_balance).toFixed(2),
          start_date: a.start_date ? new Date(a.start_date).toISOString().slice(0, 10) : null,
          color: a.color,
          icon: a.icon,
          is_active: Boolean(a.is_active),
          notes: a.notes,
          balance: bal.toFixed(2),
          transactions_count: Number(a.transactions_count),
        };
      });

      // Income & Expense this month
      const txMonth = await query(
        `SELECT flow, SUM(amount) as total, COUNT(*) as count 
         FROM transactions 
         WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3 
         GROUP BY flow`,
        [userId, startOfMonth, endOfMonth]
      );
      let income = 0;
      let expense = 0;
      let txCount = 0;
      txMonth.rows.forEach(r => {
        if (r.flow === 'in') income += Number(r.total);
        if (r.flow === 'out') expense += Number(r.total);
        txCount += Number(r.count);
      });
      const net = income - expense;

      // Previous month
      const prevTxRes = await query(
        `SELECT flow, SUM(amount) as total 
         FROM transactions 
         WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3 
         GROUP BY flow`,
        [userId, prevStart, prevEnd]
      );
      let prevIncome = 0;
      let prevExpense = 0;
      prevTxRes.rows.forEach(r => {
        if (r.flow === 'in') prevIncome += Number(r.total);
        if (r.flow === 'out') prevExpense += Number(r.total);
      });
      const prevNet = prevIncome - prevExpense;

      const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : null;
      const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;
      const netChange = prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null;
      const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : null;

      // Category expenses breakdown
      const catExpRes = await query(
        `SELECT t.category_id, c.name, c.color, c.icon, SUM(t.amount) as total, COUNT(*) as count
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = $1 AND t.flow = 'out' AND t.type != 'transfer' AND t.date >= $2 AND t.date <= $3
         GROUP BY t.category_id, c.name, c.color, c.icon
         ORDER BY total DESC`,
        [userId, startOfMonth, endOfMonth]
      );
      const expense_by_category = catExpRes.rows.map(r => {
        const tot = Number(r.total);
        return {
          category_id: r.category_id ? Number(r.category_id) : null,
          name: r.name || 'Lainnya',
          color: r.color || '#94A3B8',
          icon: r.icon || 'tag',
          total: tot.toFixed(2),
          count: Number(r.count),
          percent: expense > 0 ? Number(((tot / expense) * 100).toFixed(1)) : 0,
        };
      });

      // Budgets
      const budgetsRes = await query(
        `SELECT b.*,
          COALESCE((
            SELECT SUM(amount) FROM transactions t 
            WHERE t.user_id = b.user_id AND t.flow = 'out' AND t.type != 'transfer' 
              AND (b.category_id IS NULL OR t.category_id = b.category_id)
              AND to_char(t.date, 'YYYY-MM') = b.month
          ), 0) as spent
         FROM budgets b
         WHERE b.user_id = $1 AND b.month = $2`,
        [userId, monthStr]
      );
      let totalBudgeted = 0;
      let budgetSpent = 0;
      let overCount = 0;
      let warningCount = 0;
      const catBudgets = budgetsRes.rows.filter(b => b.category_id !== null);
      catBudgets.forEach(b => {
        const bAmt = Number(b.amount);
        const bSp = Number(b.spent);
        totalBudgeted += bAmt;
        budgetSpent += bSp;
        if (bAmt > 0) {
          const pct = (bSp / bAmt) * 100;
          if (pct > 100) overCount++;
          else if (pct >= 75) warningCount++;
        }
      });
      const overallBudget = budgetsRes.rows.find(b => b.category_id === null);
      if (overallBudget && totalBudgeted === 0) {
        totalBudgeted = Number(overallBudget.amount);
        budgetSpent = Number(overallBudget.spent);
      }
      const budgetRemaining = Math.max(0, totalBudgeted - budgetSpent);
      const budgetPercent = totalBudgeted > 0 ? Number(((budgetSpent / totalBudgeted) * 100).toFixed(1)) : 0;

      // Savings Goals
      const goalsRes = await query(
        `SELECT g.*,
          COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as saved_amount,
          json_build_object('id', a.id, 'name', a.name, 'balance', a.opening_balance::text) as account
         FROM savings_goals g
         LEFT JOIN accounts a ON g.account_id = a.id
         WHERE g.user_id = $1 AND g.status = 'active'
         ORDER BY g.priority ASC
         LIMIT 4`,
        [userId]
      );
      const goals = goalsRes.rows.map(g => {
        const cur = Number(g.saved_amount);
        const tgt = Number(g.target_amount);
        return {
          id: Number(g.id),
          name: g.name,
          target_amount: tgt.toFixed(2),
          saved_amount: cur.toFixed(2),
          remaining: Math.max(0, tgt - cur).toFixed(2),
          percent: tgt > 0 ? Number(Math.min(100, (cur / tgt) * 100).toFixed(1)) : 0,
          deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
          icon: g.icon,
          color: g.color,
          priority: Number(g.priority),
          account_id: g.account_id ? Number(g.account_id) : null,
          account: g.account?.id ? g.account : null,
          notes: g.notes,
          status: g.status,
          required_per_month: null,
          required_per_week: null,
          months_left: null,
        };
      });

      // Bills upcoming
      const billsRes = await query(
        `SELECT b.*,
          CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category,
          CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name) ELSE NULL END as account
         FROM bills b
         LEFT JOIN categories c ON b.category_id = c.id
         LEFT JOIN accounts a ON b.account_id = a.id
         WHERE b.user_id = $1 AND b.is_active = true
         ORDER BY b.next_due_date ASC
         LIMIT 5`,
        [userId]
      );
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcoming_bills = billsRes.rows.map(b => {
        const dueDate = b.next_due_date ? new Date(b.next_due_date).toISOString().slice(0, 10) : null;
        const isOverdue = Boolean(dueDate && dueDate < todayStr);
        return {
          id: Number(b.id),
          name: b.name,
          amount: Number(b.amount).toFixed(2),
          category_id: b.category_id ? Number(b.category_id) : null,
          category: b.category,
          account_id: b.account_id ? Number(b.account_id) : null,
          account: b.account,
          next_due_date: dueDate,
          frequency: b.frequency,
          reminder_days: Number(b.reminder_days || 3),
          notes: b.notes,
          is_active: Boolean(b.is_active),
          status: isOverdue ? 'overdue' : 'unpaid',
          days_until_due: null,
          last_paid_date: null,
        };
      });

      // Debts summary
      const debtsRes = await query(
        `SELECT d.*,
          COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
         FROM debts d
         WHERE d.user_id = $1`,
        [userId]
      );
      let debtRemaining = 0;
      let recRemaining = 0;
      let debtCount = 0;
      let recCount = 0;
      let overdueCount = 0;
      debtsRes.rows.forEach(d => {
        const rem = Math.max(0, Number(d.amount) - Number(d.paid_amount));
        const isOverdue = Boolean(d.due_date && new Date(d.due_date).toISOString().slice(0, 10) < todayStr && d.status !== 'paid');
        if (d.type === 'debt') {
          debtRemaining += rem;
          if (d.status !== 'paid') debtCount++;
        } else {
          recRemaining += rem;
          if (d.status !== 'paid') recCount++;
        }
        if (isOverdue) overdueCount++;
      });

      // Recent Transactions
      const recentTx = await query(
        `SELECT t.*,
          json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
          CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category,
          CASE WHEN tr.id IS NOT NULL THEN json_build_object('id', tr.id, 'from_account_id', tr.from_account_id, 'to_account_id', tr.to_account_id) ELSE NULL END as transfer
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         LEFT JOIN transfers tr ON (t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id)
         WHERE t.user_id = $1
         ORDER BY t.date DESC, t.id DESC
         LIMIT 10`,
        [userId]
      );

      return res.status(200).json({
        period: {
          month: monthStr,
          date_from: startOfMonth,
          date_to: endOfMonth,
          prev_from: prevStart,
          prev_to: prevEnd
        },
        total_balance: totalBalance.toFixed(2),
        accounts,
        month: {
          income: income.toFixed(2),
          expense: expense.toFixed(2),
          net: net.toFixed(2),
          prev_income: prevIncome.toFixed(2),
          prev_expense: prevExpense.toFixed(2),
          prev_net: prevNet.toFixed(2),
          income_change_pct: incomeChange !== null ? Number(incomeChange.toFixed(1)) : null,
          expense_change_pct: expenseChange !== null ? Number(expenseChange.toFixed(1)) : null,
          net_change_pct: netChange !== null ? Number(netChange.toFixed(1)) : null,
          savings_rate: savingsRate !== null ? Number(savingsRate.toFixed(1)) : null,
          transaction_count: txCount,
        },
        expense_by_category,
        budget: {
          budgeted: totalBudgeted.toFixed(2),
          spent: budgetSpent.toFixed(2),
          remaining: budgetRemaining.toFixed(2),
          percent: budgetPercent,
          has_budget: totalBudgeted > 0,
          over_count: overCount,
          warning_count: warningCount,
        },
        goals,
        recent_transactions: recentTx.rows.map(t => ({
          ...t,
          id: Number(t.id),
          date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
          amount: Number(t.amount).toFixed(2),
        })),
        upcoming_bills,
        debts: {
          debt_remaining: debtRemaining.toFixed(2),
          receivable_remaining: recRemaining.toFixed(2),
          debt_count: debtCount,
          receivable_count: recCount,
          overdue_count: overdueCount,
        },
      });
    }

    // 10. Transactions API
    if (pathname === '/api/transactions/export/csv') {
      if (req.method === 'GET') {
        const accountId = url.searchParams.get('account_id');
        const categoryId = url.searchParams.get('category_id');
        const flow = url.searchParams.get('flow');
        const type = url.searchParams.get('type');
        const search = url.searchParams.get('q') || url.searchParams.get('search');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        let whereClauses = ['t.user_id = $1'];
        let params: any[] = [userId];

        if (accountId) {
          params.push(Number(accountId));
          whereClauses.push(`t.account_id = $${params.length}`);
        }
        if (categoryId) {
          params.push(Number(categoryId));
          whereClauses.push(`t.category_id = $${params.length}`);
        }
        if (flow) {
          params.push(flow);
          whereClauses.push(`t.flow = $${params.length}`);
        }
        if (type) {
          params.push(type);
          whereClauses.push(`t.type = $${params.length}`);
        }
        if (startDate) {
          params.push(startDate);
          whereClauses.push(`t.date >= $${params.length}`);
        }
        if (endDate) {
          params.push(endDate);
          whereClauses.push(`t.date <= $${params.length}`);
        }
        if (search) {
          params.push(`%${search.trim().toLowerCase()}%`);
          whereClauses.push(`(
            LOWER(COALESCE(t.description, '')) LIKE $${params.length} OR 
            LOWER(COALESCE(t.counterparty, '')) LIKE $${params.length} OR 
            LOWER(COALESCE(t.notes, '')) LIKE $${params.length} OR 
            LOWER(a.name) LIKE $${params.length} OR 
            LOWER(COALESCE(c.name, '')) LIKE $${params.length}
          )`);
        }

        const whereSql = whereClauses.join(' AND ');
        const txRes = await query(
          `SELECT t.*, a.name as account_name, c.name as category_name
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE ${whereSql}
           ORDER BY t.date DESC, t.id DESC`,
          params
        );

        let csv = '\uFEFFID,Tanggal,Tipe,Arus,Akun,Kategori,Nominal,Deskripsi,Pihak Lain,Catatan\r\n';
        for (const t of txRes.rows) {
          const d = t.date ? new Date(t.date).toISOString().slice(0, 10) : '';
          const flowLabel = t.flow === 'in' ? 'Masuk' : 'Keluar';
          const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
          csv += [
            t.id,
            d,
            t.type,
            flowLabel,
            escapeCsv(t.account_name),
            escapeCsv(t.category_name),
            Number(t.amount).toFixed(2),
            escapeCsv(t.description),
            escapeCsv(t.counterparty),
            escapeCsv(t.notes),
          ].join(',') + '\r\n';
        }

        res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
        res.setHeader('Content-Disposition', `attachment; filename="finora_transaksi_${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.status(200).send(csv);
      }
    }

    if (pathname === '/api/transactions') {
      if (req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') || 20)));
        const offset = (page - 1) * perPage;

        const accountId = url.searchParams.get('account_id');
        const categoryId = url.searchParams.get('category_id');
        const flow = url.searchParams.get('flow');
        const type = url.searchParams.get('type');
        const search = url.searchParams.get('q') || url.searchParams.get('search');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        let whereClauses = ['t.user_id = $1'];
        let params: any[] = [userId];

        if (accountId) {
          params.push(Number(accountId));
          whereClauses.push(`t.account_id = $${params.length}`);
        }
        if (categoryId) {
          params.push(Number(categoryId));
          whereClauses.push(`t.category_id = $${params.length}`);
        }
        if (flow) {
          params.push(flow);
          whereClauses.push(`t.flow = $${params.length}`);
        }
        if (type) {
          params.push(type);
          whereClauses.push(`t.type = $${params.length}`);
        }
        if (startDate) {
          params.push(startDate);
          whereClauses.push(`t.date >= $${params.length}`);
        }
        if (endDate) {
          params.push(endDate);
          whereClauses.push(`t.date <= $${params.length}`);
        }
        if (search) {
          params.push(`%${search.trim().toLowerCase()}%`);
          whereClauses.push(`(
            LOWER(COALESCE(t.description, '')) LIKE $${params.length} OR 
            LOWER(COALESCE(t.counterparty, '')) LIKE $${params.length} OR 
            LOWER(COALESCE(t.notes, '')) LIKE $${params.length} OR 
            LOWER(a.name) LIKE $${params.length} OR 
            LOWER(COALESCE(c.name, '')) LIKE $${params.length}
          )`);
        }

        const whereSql = whereClauses.join(' AND ');

        // Total count & summary
        const countRes = await query(
          `SELECT COUNT(*) as total,
            COALESCE(SUM(CASE WHEN t.flow = 'in' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN t.flow = 'out' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as expense
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE ${whereSql}`,
          params
        );
        const total = Number(countRes.rows[0].total);
        const inc = Number(countRes.rows[0].income);
        const exp = Number(countRes.rows[0].expense);

        // Fetch rows
        const txRes = await query(
          `SELECT t.*,
            json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category,
            CASE WHEN tr.id IS NOT NULL THEN json_build_object(
              'id', tr.id,
              'from_account_id', tr.from_account_id,
              'to_account_id', tr.to_account_id,
              'from_account', (SELECT name FROM accounts WHERE id = tr.from_account_id),
              'to_account', (SELECT name FROM accounts WHERE id = tr.to_account_id)
            ) ELSE NULL END as transfer
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN transfers tr ON (t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id)
           WHERE ${whereSql}
           ORDER BY t.date DESC, t.id DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, perPage, offset]
        );

        return res.status(200).json({
          data: txRes.rows.map(t => ({
            ...t,
            id: Number(t.id),
            date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
            amount: Number(t.amount).toFixed(2),
            account_id: Number(t.account_id),
            category_id: t.category_id ? Number(t.category_id) : null,
          })),
          meta: {
            current_page: page,
            last_page: Math.ceil(total / perPage) || 1,
            per_page: perPage,
            total,
          },
          summary: {
            income: inc.toFixed(2),
            expense: exp.toFixed(2),
            net: (inc - exp).toFixed(2),
            count: total,
          }
        });
      }

      if (req.method === 'POST') {
        const b = req.body || {};
        const { type, account_id, from_account_id, to_account_id, category_id, date, amount, description, counterparty, notes } = b;

        if (type === 'transfer') {
          const fromAccId = from_account_id || account_id;
          const toAccId = to_account_id;

          if (!fromAccId || !toAccId) {
            return res.status(422).json({ message: 'Rekening asal dan tujuan harus dipilih.' });
          }
          if (Number(fromAccId) === Number(toAccId)) {
            return res.status(422).json({ message: 'Rekening asal dan tujuan tidak boleh sama.' });
          }

          const fromAcc = await query('SELECT name FROM accounts WHERE id = $1 AND user_id = $2', [fromAccId, userId]);
          const toAcc = await query('SELECT name FROM accounts WHERE id = $1 AND user_id = $2', [toAccId, userId]);
          const fromName = fromAcc.rows[0]?.name || 'Rekening';
          const toName = toAcc.rows[0]?.name || 'Rekening';

          // Double entry transfer
          const fromTx = await query(
            `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, notes, created_at, updated_at)
             VALUES ($1, $2, NULL, 'transfer', 'out', $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
            [userId, fromAccId, date, amount, description || `Transfer ke ${toName}`, notes || null]
          );
          const toTx = await query(
            `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, notes, created_at, updated_at)
             VALUES ($1, $2, NULL, 'transfer', 'in', $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
            [userId, toAccId, date, amount, description || `Transfer dari ${fromName}`, notes || null]
          );
          await query(
            `INSERT INTO transfers (user_id, from_account_id, to_account_id, from_transaction_id, to_transaction_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, fromAccId, toAccId, fromTx.rows[0].id, toTx.rows[0].id]
          );

          return res.status(201).json({
            data: {
              ...fromTx.rows[0],
              id: Number(fromTx.rows[0].id),
              date: fromTx.rows[0].date ? new Date(fromTx.rows[0].date).toISOString().slice(0, 10) : null,
              amount: Number(fromTx.rows[0].amount).toFixed(2),
              account_id: Number(fromTx.rows[0].account_id),
              category_id: null,
            }
          });
        }

        const flow = type === 'income' ? 'in' : 'out';
        const ins = await query(
          `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, counterparty, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
          [userId, account_id, category_id || null, type, flow, date, amount, description || null, counterparty || null, notes || null]
        );
        return res.status(201).json({
          data: {
            ...ins.rows[0],
            id: Number(ins.rows[0].id),
            date: ins.rows[0].date ? new Date(ins.rows[0].date).toISOString().slice(0, 10) : null,
            amount: Number(ins.rows[0].amount).toFixed(2),
            account_id: Number(ins.rows[0].account_id),
            category_id: ins.rows[0].category_id ? Number(ins.rows[0].category_id) : null,
          }
        });
      }
    }

    const txMatch = pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (txMatch) {
      const txId = Number(txMatch[1]);
      if (req.method === 'GET') {
        const txRes = await query(
          `SELECT t.*,
            json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category,
            CASE WHEN tr.id IS NOT NULL THEN json_build_object('id', tr.id, 'from_account_id', tr.from_account_id, 'to_account_id', tr.to_account_id) ELSE NULL END as transfer
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN transfers tr ON (t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id)
           WHERE t.id = $1 AND t.user_id = $2`,
          [txId, userId]
        );
        if (txRes.rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
        const t = txRes.rows[0];
        return res.status(200).json({
          data: {
            ...t,
            id: Number(t.id),
            date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
            amount: Number(t.amount).toFixed(2),
            account_id: Number(t.account_id),
            category_id: t.category_id ? Number(t.category_id) : null,
          }
        });
      }

      if (req.method === 'PUT') {
        const b = req.body || {};
        const { account_id, from_account_id, to_account_id, category_id, date, amount, description, notes, counterparty } = b;

        // Check if transaction exists
        const txCheck = await query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId]);
        if (txCheck.rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
        const curTx = txCheck.rows[0];

        if (curTx.type === 'transfer') {
          const fromAccId = from_account_id || account_id;
          const toAccId = to_account_id;

          // If transfer, update date, amount, notes, and accounts on both
          const trRes = await query('SELECT * FROM transfers WHERE from_transaction_id = $1 OR to_transaction_id = $1', [txId]);
          if (trRes.rows.length > 0) {
            const tr = trRes.rows[0];
            const newFromAccId = fromAccId || tr.from_account_id;
            const newToAccId = toAccId || tr.to_account_id;

            const fromAcc = await query('SELECT name FROM accounts WHERE id = $1 AND user_id = $2', [newFromAccId, userId]);
            const toAcc = await query('SELECT name FROM accounts WHERE id = $1 AND user_id = $2', [newToAccId, userId]);
            const fromName = fromAcc.rows[0]?.name || 'Rekening';
            const toName = toAcc.rows[0]?.name || 'Rekening';

            // Update out transaction
            await query(
              `UPDATE transactions SET 
                account_id = $1,
                date = COALESCE($2, date),
                amount = COALESCE($3, amount),
                description = $4,
                notes = $5,
                updated_at = NOW()
               WHERE id = $6`,
              [newFromAccId, date, amount, description || `Transfer ke ${toName}`, notes !== undefined ? notes : null, tr.from_transaction_id]
            );

            // Update in transaction
            await query(
              `UPDATE transactions SET 
                account_id = $1,
                date = COALESCE($2, date),
                amount = COALESCE($3, amount),
                description = $4,
                notes = $5,
                updated_at = NOW()
               WHERE id = $6`,
              [newToAccId, date, amount, description || `Transfer dari ${fromName}`, notes !== undefined ? notes : null, tr.to_transaction_id]
            );

            // Update transfer record
            await query(
              `UPDATE transfers SET 
                from_account_id = $1,
                to_account_id = $2,
                updated_at = NOW()
               WHERE id = $3`,
              [newFromAccId, newToAccId, tr.id]
            );
          }
        } else {
          await query(
            `UPDATE transactions SET 
              account_id = COALESCE($1, account_id),
              category_id = $2,
              date = COALESCE($3, date),
              amount = COALESCE($4, amount),
              description = $5,
              notes = $6,
              counterparty = $7,
              updated_at = NOW()
             WHERE id = $8 AND user_id = $9`,
            [
              account_id || curTx.account_id,
              category_id !== undefined ? (category_id || null) : curTx.category_id,
              date || curTx.date,
              amount !== undefined ? amount : curTx.amount,
              description !== undefined ? description : curTx.description,
              notes !== undefined ? notes : curTx.notes,
              counterparty !== undefined ? counterparty : curTx.counterparty,
              txId,
              userId
            ]
          );
        }

        // Fetch updated
        const updatedRes = await query(
          `SELECT t.*,
            json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category,
            CASE WHEN tr.id IS NOT NULL THEN json_build_object('id', tr.id, 'from_account_id', tr.from_account_id, 'to_account_id', tr.to_account_id) ELSE NULL END as transfer
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN transfers tr ON (t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id)
           WHERE t.id = $1 AND t.user_id = $2`,
          [txId, userId]
        );
        const t = updatedRes.rows[0];
        return res.status(200).json({
          data: {
            ...t,
            id: Number(t.id),
            date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
            amount: Number(t.amount).toFixed(2),
            account_id: Number(t.account_id),
            category_id: t.category_id ? Number(t.category_id) : null,
          }
        });
      }

      if (req.method === 'DELETE') {
        // If transfer, delete both
        const tr = await query('SELECT * FROM transfers WHERE from_transaction_id = $1 OR to_transaction_id = $1', [txId]);
        if (tr.rows.length > 0) {
          const t = tr.rows[0];
          await query('DELETE FROM transfers WHERE id = $1', [t.id]);
          await query('DELETE FROM transactions WHERE id IN ($1, $2)', [t.from_transaction_id, t.to_transaction_id]);
        } else {
          await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId]);
        }
        return res.status(200).json({ message: 'Transaksi berhasil dihapus.' });
      }
    }

    // 11. Budgets API
    if (pathname === '/api/budgets') {
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      if (req.method === 'GET') {
        const [year, mNum] = month.split('-').map(Number);
        const lastDay = new Date(year, mNum, 0).getDate();
        const startOfMonth = `${month}-01`;
        const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

        // Get total spent per category this month
        const catSpentRes = await query(
          `SELECT category_id, SUM(amount) as total_spent
           FROM transactions
           WHERE user_id = $1 AND flow = 'out' AND type != 'transfer' AND date >= $2 AND date <= $3
           GROUP BY category_id`,
          [userId, startOfMonth, endOfMonth]
        );
        const spentMap = new Map<number | null, number>();
        let totalMonthExpense = 0;
        catSpentRes.rows.forEach(r => {
          const sp = Number(r.total_spent);
          totalMonthExpense += sp;
          spentMap.set(r.category_id ? Number(r.category_id) : null, sp);
        });

        const budgetsRes = await query(
          `SELECT b.*,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category
           FROM budgets b
           LEFT JOIN categories c ON b.category_id = c.id
           WHERE b.user_id = $1 AND b.month = $2`,
          [userId, month]
        );

        const overallBudget = budgetsRes.rows.find(b => b.category_id === null);
        let overallRow = null;
        if (overallBudget) {
          const bAmt = Number(overallBudget.amount);
          const sp = totalMonthExpense;
          const rem = bAmt - sp;
          const pct = bAmt > 0 ? (sp / bAmt) * 100 : 0;
          overallRow = {
            id: Number(overallBudget.id),
            category_id: null,
            category: null,
            amount: bAmt.toFixed(2),
            spent: sp.toFixed(2),
            remaining: rem.toFixed(2),
            percent: Number(pct.toFixed(1)),
            level: pct >= 100 ? 'over' : pct >= 80 ? 'danger' : pct >= 50 ? 'warning' : 'safe',
            is_recurring: Boolean(overallBudget.is_recurring),
          };
        }

        let totalBudgeted = 0;
        let budgetedSpentTotal = 0;
        const categoryRows = budgetsRes.rows.filter(b => b.category_id !== null).map(b => {
          const catId = Number(b.category_id);
          const bAmt = Number(b.amount);
          const sp = spentMap.get(catId) || 0;
          totalBudgeted += bAmt;
          budgetedSpentTotal += sp;
          const rem = bAmt - sp;
          const pct = bAmt > 0 ? (sp / bAmt) * 100 : 0;
          return {
            id: Number(b.id),
            category_id: catId,
            category: b.category,
            amount: bAmt.toFixed(2),
            spent: sp.toFixed(2),
            remaining: rem.toFixed(2),
            percent: Number(pct.toFixed(1)),
            level: pct >= 100 ? 'over' : pct >= 80 ? 'danger' : pct >= 50 ? 'warning' : 'safe',
            is_recurring: Boolean(b.is_recurring),
          };
        });

        const unbudgetedSpent = Math.max(0, totalMonthExpense - budgetedSpentTotal);
        const totalRemaining = totalBudgeted - budgetedSpentTotal;
        const totalPercent = totalBudgeted > 0 ? (budgetedSpentTotal / totalBudgeted) * 100 : 0;

        return res.status(200).json({
          month,
          overall: overallRow,
          categories: categoryRows,
          totals: {
            budgeted: totalBudgeted.toFixed(2),
            spent: budgetedSpentTotal.toFixed(2),
            remaining: totalRemaining.toFixed(2),
            percent: Number(totalPercent.toFixed(1)),
            month_expense: totalMonthExpense.toFixed(2),
            unbudgeted_spent: unbudgetedSpent.toFixed(2),
          }
        });
      }
      if (req.method === 'POST') {
        const { category_id, month: bMonth, amount, is_recurring } = req.body || {};
        const ins = await query(
          `INSERT INTO budgets (user_id, category_id, month, amount, is_recurring, created_at, updated_at)
           VALUES ($1, $2, $3, $4, COALESCE($5, true), NOW(), NOW())
           ON CONFLICT (user_id, category_id, month) 
           DO UPDATE SET amount = EXCLUDED.amount, is_recurring = EXCLUDED.is_recurring, updated_at = NOW()
           RETURNING *`,
          [userId, category_id || null, bMonth || month, amount, is_recurring]
        );
        return res.status(200).json(ins.rows[0]);
      }
    }

    const budgetDel = pathname.match(/^\/api\/budgets\/(\d+)$/);
    if (budgetDel && req.method === 'DELETE') {
      await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [Number(budgetDel[1]), userId]);
      return res.status(200).json({ message: 'Anggaran dihapus.' });
    }

    // Helper to calculate goal periodic targets
    function calculateGoalMetrics(g: any, includeContributions: boolean = false, contributions: any[] = []) {
      const tgt = Number(g.target_amount);
      const cur = Number(g.saved_amount || 0);
      const rem = Math.max(0, tgt - cur);
      const pct = tgt > 0 ? Number(Math.min(100, (cur / tgt) * 100).toFixed(1)) : 0;

      let monthsLeft: number | null = null;
      let reqPerMonth: string | null = null;
      let reqPerWeek: string | null = null;

      if (g.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(g.deadline);
        deadline.setHours(0, 0, 0, 0);

        if (deadline > today) {
          let months = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
          const anchor = new Date(today);
          anchor.setMonth(anchor.getMonth() + months);
          if (anchor > deadline) {
            months--;
            anchor.setMonth(anchor.getMonth() - 1);
          }
          const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
          const remDays = (deadline.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24);
          const floatMonths = Math.max(0.1, months + (remDays / daysInMonth));
          const floatWeeks = Math.max(0.1, (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7));

          monthsLeft = Math.max(1, Math.round(floatMonths));
          if (rem > 0) {
            reqPerMonth = (rem / floatMonths).toFixed(2);
            reqPerWeek = (rem / floatWeeks).toFixed(2);
          }
        }
      }

      const res: any = {
        id: Number(g.id),
        name: g.name,
        target_amount: tgt.toFixed(2),
        saved_amount: cur.toFixed(2),
        remaining: rem.toFixed(2),
        percent: pct,
        deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
        icon: g.icon,
        color: g.color,
        priority: Number(g.priority),
        account_id: g.account_id ? Number(g.account_id) : null,
        account: g.account,
        notes: g.notes,
        status: g.status,
        required_per_month: reqPerMonth,
        required_per_week: reqPerWeek,
        months_left: monthsLeft,
      };

      if (includeContributions) {
        res.contributions = contributions.map(c => ({
          id: Number(c.id),
          type: c.type,
          amount: Number(c.amount).toFixed(2),
          date: c.date ? new Date(c.date).toISOString().slice(0, 10) : null,
          note: c.note,
          created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
        }));
      }

      return res;
    }

    // 12. Goals API
    if (pathname === '/api/goals') {
      if (req.method === 'GET') {
        const goals = await query(
          `SELECT g.*,
            COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as saved_amount,
            CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name, 'balance', a.opening_balance::text) ELSE NULL END as account
           FROM savings_goals g
           LEFT JOIN accounts a ON g.account_id = a.id
           WHERE g.user_id = $1
           ORDER BY g.priority ASC`,
          [userId]
        );
        const data = goals.rows.map(g => calculateGoalMetrics(g));
        return res.status(200).json({ data });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO savings_goals (user_id, account_id, name, target_amount, deadline, icon, color, priority, notes, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), NOW()) RETURNING *`,
          [userId, b.account_id || null, b.name, b.target_amount, b.deadline || null, b.icon || 'target', b.color || '#16A34A', b.priority || 1, b.notes || null]
        );
        const g = ins.rows[0];
        return res.status(201).json({
          data: calculateGoalMetrics(g)
        });
      }
    }

    const goalContributeMatch = pathname.match(/^\/api\/goals\/(\d+)\/contribute$/);
    if (goalContributeMatch && req.method === 'POST') {
      const gId = Number(goalContributeMatch[1]);
      const { amount, date, note, account_id } = req.body || {};
      await query(
        `INSERT INTO savings_contributions (savings_goal_id, user_id, type, amount, date, note, created_at, updated_at)
         VALUES ($1, $2, 'deposit', $3, $4, $5, NOW(), NOW())`,
        [gId, userId, amount, date || new Date().toISOString().slice(0, 10), note || null]
      );
      if (account_id) {
        await query(
          `INSERT INTO transactions (user_id, account_id, type, flow, date, amount, description, created_at, updated_at)
           VALUES ($1, $2, 'expense', 'out', $3, $4, 'Setoran Tabungan', NOW(), NOW())`,
          [userId, account_id, date || new Date().toISOString().slice(0, 10), amount]
        );
      }
      return res.status(200).json({ message: 'Setoran berhasil dicatat.' });
    }

    const goalMatch = pathname.match(/^\/api\/goals\/(\d+)$/);
    if (goalMatch) {
      const gId = Number(goalMatch[1]);
      if (req.method === 'GET') {
        const goal = await query(
          `SELECT g.*,
            COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as saved_amount,
            CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name, 'balance', a.opening_balance::text) ELSE NULL END as account
           FROM savings_goals g
           LEFT JOIN accounts a ON g.account_id = a.id
           WHERE g.id = $1 AND g.user_id = $2`,
          [gId, userId]
        );
        if (goal.rows.length === 0) return res.status(404).json({ message: 'Target tabungan tidak ditemukan.' });
        const g = goal.rows[0];
        const contribs = await query(
          `SELECT * FROM savings_contributions WHERE savings_goal_id = $1 AND user_id = $2 ORDER BY date DESC, id DESC`,
          [gId, userId]
        );
        return res.status(200).json({
          data: calculateGoalMetrics(g, true, contribs.rows)
        });
      }
      if (req.method === 'PUT') {
        const b = req.body || {};
        const upd = await query(
          `UPDATE savings_goals SET
            name = COALESCE($1, name),
            target_amount = COALESCE($2, target_amount),
            deadline = $3,
            icon = COALESCE($4, icon),
            color = COALESCE($5, color),
            priority = COALESCE($6, priority),
            account_id = $7,
            notes = $8,
            status = COALESCE($9, status),
            updated_at = NOW()
           WHERE id = $10 AND user_id = $11 RETURNING *`,
          [b.name, b.target_amount, b.deadline || null, b.icon, b.color, b.priority, b.account_id || null, b.notes || null, b.status, gId, userId]
        );
        if (upd.rows.length === 0) return res.status(404).json({ message: 'Target tabungan tidak ditemukan.' });
        return res.status(200).json({ data: { ...upd.rows[0], id: Number(upd.rows[0].id) } });
      }
      if (req.method === 'DELETE') {
        await query('DELETE FROM savings_goals WHERE id = $1 AND user_id = $2', [gId, userId]);
        return res.status(200).json({ message: 'Target tabungan berhasil dihapus.' });
      }
    }

    // 13. Debts API
    if (pathname === '/api/debts') {
      const typeFilter = url.searchParams.get('type');
      const statusFilter = url.searchParams.get('status');
      const todayStr = new Date().toISOString().slice(0, 10);

      const allDebtsRes = await query(
        `SELECT d.*,
          COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
         FROM debts d
         WHERE d.user_id = $1`,
        [userId]
      );

      let debtRemaining = 0;
      let recRemaining = 0;
      let debtCount = 0;
      let recCount = 0;
      let overdueCount = 0;

      allDebtsRes.rows.forEach(d => {
        const rem = Math.max(0, Number(d.amount) - Number(d.paid_amount));
        const isOverdue = Boolean(d.due_date && new Date(d.due_date).toISOString().slice(0, 10) < todayStr && d.status !== 'paid');
        if (d.type === 'debt') {
          debtRemaining += rem;
          if (d.status !== 'paid') debtCount++;
        } else {
          recRemaining += rem;
          if (d.status !== 'paid') recCount++;
        }
        if (isOverdue) overdueCount++;
      });

      if (req.method === 'GET') {
        let whereSql = 'd.user_id = $1';
        let params: any[] = [userId];
        if (typeFilter) {
          params.push(typeFilter);
          whereSql += ` AND d.type = $${params.length}`;
        }
        if (statusFilter) {
          params.push(statusFilter);
          whereSql += ` AND d.status = $${params.length}`;
        }

        const debts = await query(
          `SELECT d.*,
            COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
           FROM debts d
           WHERE ${whereSql}
           ORDER BY d.due_date ASC NULLS LAST, d.date DESC`,
          params
        );

        const data = debts.rows.map(d => {
          const amt = Number(d.amount);
          const pd = Number(d.paid_amount);
          const rem = Math.max(0, amt - pd);
          const isOverdue = Boolean(d.due_date && new Date(d.due_date).toISOString().slice(0, 10) < todayStr && d.status !== 'paid');
          return {
            id: Number(d.id),
            type: d.type,
            party_name: d.party_name,
            amount: amt.toFixed(2),
            paid_amount: pd.toFixed(2),
            remaining: rem.toFixed(2),
            date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null,
            due_date: d.due_date ? new Date(d.due_date).toISOString().slice(0, 10) : null,
            notes: d.notes,
            status: d.status,
            account_id: d.account_id ? Number(d.account_id) : null,
            is_overdue: isOverdue,
          };
        });

        return res.status(200).json({
          data,
          summary: {
            debt_remaining: debtRemaining.toFixed(2),
            receivable_remaining: recRemaining.toFixed(2),
            debt_count: debtCount,
            receivable_count: recCount,
            overdue_count: overdueCount,
          }
        });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO debts (user_id, account_id, type, party_name, amount, date, due_date, notes, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', NOW(), NOW()) RETURNING *`,
          [userId, b.account_id || null, b.type, b.party_name, b.amount, b.date, b.due_date || null, b.notes || null]
        );
        const d = ins.rows[0];
        return res.status(201).json({
          data: {
            ...d,
            id: Number(d.id),
            paid_amount: '0.00',
            remaining: Number(b.amount).toFixed(2),
            is_overdue: false,
          }
        });
      }
    }

    const debtPayMatch = pathname.match(/^\/api\/debts\/(\d+)\/pay$/);
    if (debtPayMatch && req.method === 'POST') {
      const dId = Number(debtPayMatch[1]);
      const { amount, date, note, account_id } = req.body || {};
      await query(
        `INSERT INTO debt_payments (debt_id, user_id, account_id, amount, date, note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [dId, userId, account_id || null, amount, date || new Date().toISOString().slice(0, 10), note || null]
      );
      return res.status(200).json({ message: 'Pembayaran dicatat.' });
    }

    const debtMatch = pathname.match(/^\/api\/debts\/(\d+)$/);
    if (debtMatch) {
      const dId = Number(debtMatch[1]);
      if (req.method === 'GET') {
        const debt = await query('SELECT * FROM debts WHERE id = $1 AND user_id = $2', [dId, userId]);
        if (debt.rows.length === 0) return res.status(404).json({ message: 'Hutang/piutang tidak ditemukan.' });
        return res.status(200).json({ data: { ...debt.rows[0], id: Number(debt.rows[0].id) } });
      }
      if (req.method === 'PUT') {
        const b = req.body || {};
        const upd = await query(
          `UPDATE debts SET
            type = COALESCE($1, type),
            party_name = COALESCE($2, party_name),
            amount = COALESCE($3, amount),
            date = COALESCE($4, date),
            due_date = $5,
            notes = $6,
            account_id = $7,
            status = COALESCE($8, status),
            updated_at = NOW()
           WHERE id = $9 AND user_id = $10 RETURNING *`,
          [b.type, b.party_name, b.amount, b.date, b.due_date || null, b.notes || null, b.account_id || null, b.status, dId, userId]
        );
        if (upd.rows.length === 0) return res.status(404).json({ message: 'Hutang/piutang tidak ditemukan.' });
        return res.status(200).json({ data: { ...upd.rows[0], id: Number(upd.rows[0].id) } });
      }
      if (req.method === 'DELETE') {
        await query('DELETE FROM debts WHERE id = $1 AND user_id = $2', [dId, userId]);
        return res.status(200).json({ message: 'Catatan hutang/piutang berhasil dihapus.' });
      }
    }

    // 14. Bills API
    if (pathname === '/api/bills') {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (req.method === 'GET') {
        const bills = await query(
          `SELECT b.*,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category,
            CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name) ELSE NULL END as account
           FROM bills b
           LEFT JOIN categories c ON b.category_id = c.id
           LEFT JOIN accounts a ON b.account_id = a.id
           WHERE b.user_id = $1
           ORDER BY b.next_due_date ASC NULLS LAST`,
          [userId]
        );
        const data = bills.rows.map(b => {
          const dueDate = b.next_due_date ? new Date(b.next_due_date).toISOString().slice(0, 10) : null;
          const isOverdue = Boolean(dueDate && dueDate < todayStr);
          return {
            id: Number(b.id),
            name: b.name,
            amount: Number(b.amount).toFixed(2),
            category_id: b.category_id ? Number(b.category_id) : null,
            category: b.category,
            account_id: b.account_id ? Number(b.account_id) : null,
            account: b.account,
            next_due_date: dueDate,
            frequency: b.frequency,
            reminder_days: Number(b.reminder_days || 3),
            notes: b.notes,
            is_active: Boolean(b.is_active),
            status: isOverdue ? 'overdue' : 'unpaid',
            days_until_due: null,
            last_paid_date: null,
          };
        });
        return res.status(200).json({ data });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO bills (user_id, category_id, account_id, name, amount, next_due_date, frequency, reminder_days, notes, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()) RETURNING *`,
          [userId, b.category_id || null, b.account_id || null, b.name, b.amount, b.next_due_date || null, b.frequency || 'monthly', b.reminder_days || 3, b.notes || null]
        );
        return res.status(201).json({ data: { ...ins.rows[0], id: Number(ins.rows[0].id) } });
      }
    }

    const billPayMatch = pathname.match(/^\/api\/bills\/(\d+)\/pay$/);
    if (billPayMatch && req.method === 'POST') {
      const bId = Number(billPayMatch[1]);
      const { account_id, date, amount } = req.body || {};
      const billRes = await query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [bId, userId]);
      if (billRes.rows.length === 0) return res.status(404).json({ message: 'Tagihan tidak ditemukan.' });
      const b = billRes.rows[0];

      await query(
        `INSERT INTO bill_payments (bill_id, user_id, period_due_date, paid_date, amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [bId, userId, b.next_due_date || date, date || new Date().toISOString().slice(0, 10), amount || b.amount]
      );
      return res.status(200).json({ message: 'Tagihan berhasil dibayar.' });
    }

    const billMatch = pathname.match(/^\/api\/bills\/(\d+)$/);
    if (billMatch) {
      const bId = Number(billMatch[1]);
      if (req.method === 'GET') {
        const bill = await query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [bId, userId]);
        if (bill.rows.length === 0) return res.status(404).json({ message: 'Tagihan tidak ditemukan.' });
        return res.status(200).json({ data: { ...bill.rows[0], id: Number(bill.rows[0].id) } });
      }
      if (req.method === 'PUT') {
        const b = req.body || {};
        const upd = await query(
          `UPDATE bills SET
            name = COALESCE($1, name),
            amount = COALESCE($2, amount),
            category_id = $3,
            account_id = $4,
            next_due_date = $5,
            frequency = COALESCE($6, frequency),
            reminder_days = COALESCE($7, reminder_days),
            notes = $8,
            is_active = COALESCE($9, is_active),
            updated_at = NOW()
           WHERE id = $10 AND user_id = $11 RETURNING *`,
          [b.name, b.amount, b.category_id || null, b.account_id || null, b.next_due_date || null, b.frequency, b.reminder_days, b.notes || null, b.is_active, bId, userId]
        );
        if (upd.rows.length === 0) return res.status(404).json({ message: 'Tagihan tidak ditemukan.' });
        return res.status(200).json({ data: { ...upd.rows[0], id: Number(upd.rows[0].id) } });
      }
      if (req.method === 'DELETE') {
        await query('DELETE FROM bills WHERE id = $1 AND user_id = $2', [bId, userId]);
        return res.status(200).json({ message: 'Tagihan berhasil dihapus.' });
      }
    }

    // Recurring API
    if (pathname === '/api/recurring') {
      if (req.method === 'GET') {
        const recs = await query(
          `SELECT r.*,
            CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name) ELSE NULL END as account,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category
           FROM recurrings r
           LEFT JOIN accounts a ON r.account_id = a.id
           LEFT JOIN categories c ON r.category_id = c.id
           WHERE r.user_id = $1
           ORDER BY r.created_at DESC`,
          [userId]
        );
        const data = recs.rows.map(r => ({
          ...r,
          id: Number(r.id),
          account_id: Number(r.account_id),
          category_id: Number(r.category_id),
          amount: Number(r.amount).toFixed(2),
          interval: Number(r.interval || 1),
          start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : null,
          end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : null,
          next_run_date: r.next_run_date ? new Date(r.next_run_date).toISOString().slice(0, 10) : null,
          is_active: Boolean(r.is_active),
          generated_count: Number(r.generated_count || 0),
        }));
        return res.status(200).json({ data });
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO recurrings (user_id, account_id, category_id, type, amount, description, frequency, interval, start_date, end_date, next_run_date, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, true, NOW(), NOW()) RETURNING *`,
          [userId, b.account_id, b.category_id, b.type, b.amount, b.description, b.frequency || 'monthly', b.interval || 1, b.start_date, b.end_date || null]
        );
        return res.status(201).json({ data: { ...ins.rows[0], id: Number(ins.rows[0].id) } });
      }
    }

    const recMatch = pathname.match(/^\/api\/recurring\/(\d+)$/);
    if (recMatch) {
      const rId = Number(recMatch[1]);
      if (req.method === 'PUT') {
        const b = req.body || {};
        const upd = await query(
          `UPDATE recurrings SET
            type = COALESCE($1, type),
            amount = COALESCE($2, amount),
            account_id = COALESCE($3, account_id),
            category_id = COALESCE($4, category_id),
            description = COALESCE($5, description),
            frequency = COALESCE($6, frequency),
            interval = COALESCE($7, interval),
            start_date = COALESCE($8, start_date),
            end_date = $9,
            is_active = COALESCE($10, is_active),
            updated_at = NOW()
           WHERE id = $11 AND user_id = $12 RETURNING *`,
          [b.type, b.amount, b.account_id, b.category_id, b.description, b.frequency, b.interval, b.start_date, b.end_date || null, b.is_active, rId, userId]
        );
        if (upd.rows.length === 0) return res.status(404).json({ message: 'Transaksi rutin tidak ditemukan.' });
        return res.status(200).json({ data: { ...upd.rows[0], id: Number(upd.rows[0].id) } });
      }
      if (req.method === 'DELETE') {
        await query('DELETE FROM recurrings WHERE id = $1 AND user_id = $2', [rId, userId]);
        return res.status(200).json({ message: 'Jadwal transaksi rutin berhasil dihapus.' });
      }
    }

    if (pathname === '/api/recurring/run-pending' && req.method === 'POST') {
      return res.status(200).json({ message: 'Transaksi tertunda telah diproses.', generated: 0 });
    }

    // Calendar API
    if (pathname === '/api/calendar') {
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const [year, mNum] = month.split('-').map(Number);
      const startOfMonth = `${month}-01`;
      const lastDay = new Date(year, mNum, 0).getDate();
      const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;

      const txs = await query(
        `SELECT to_char(date, 'YYYY-MM-DD') as day, flow, SUM(amount) as total, COUNT(*) as count
         FROM transactions
         WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3
         GROUP BY day, flow`,
        [userId, startOfMonth, endOfMonth]
      );

      const days: Record<string, { income: string; expense: string; count: number }> = {};
      txs.rows.forEach(r => {
        if (!days[r.day]) {
          days[r.day] = { income: '0.00', expense: '0.00', count: 0 };
        }
        if (r.flow === 'in') days[r.day].income = Number(r.total).toFixed(2);
        if (r.flow === 'out') days[r.day].expense = Number(r.total).toFixed(2);
        days[r.day].count += Number(r.count);
      });

      const bills = await query(
        `SELECT b.* FROM bills b
         WHERE b.user_id = $1 AND b.is_active = true AND b.next_due_date >= $2 AND b.next_due_date <= $3`,
        [userId, startOfMonth, endOfMonth]
      );

      return res.status(200).json({
        days,
        bills: bills.rows.map(b => ({
          bill_id: Number(b.id),
          name: b.name,
          date: new Date(b.next_due_date).toISOString().slice(0, 10),
          amount: Number(b.amount).toFixed(2),
          status: 'unpaid',
        })),
      });
    }

    // 15. Reports API
    if (pathname === '/api/reports/cashflow') {
      const now = new Date();
      const dateTo = url.searchParams.get('date_to') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
      const dFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const dateFrom = url.searchParams.get('date_from') || `${dFrom.getFullYear()}-${String(dFrom.getMonth() + 1).padStart(2, '0')}-01`;

      const txs = await query(
        `SELECT to_char(date, 'YYYY-MM') as month, flow, SUM(amount) as total
         FROM transactions
         WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3
         GROUP BY month, flow
         ORDER BY month ASC`,
        [userId, dateFrom, dateTo]
      );

      const pointsMap = new Map<string, { income: number; expense: number }>();
      txs.rows.forEach(r => {
        if (!pointsMap.has(r.month)) pointsMap.set(r.month, { income: 0, expense: 0 });
        const p = pointsMap.get(r.month)!;
        if (r.flow === 'in') p.income += Number(r.total);
        if (r.flow === 'out') p.expense += Number(r.total);
      });

      const data = Array.from(pointsMap.entries()).map(([period, v]) => ({
        period,
        label: period,
        income: v.income.toFixed(2),
        expense: v.expense.toFixed(2),
        net: (v.income - v.expense).toFixed(2),
      }));

      return res.status(200).json({ data });
    }

    if (pathname === '/api/reports/summary') {
      const now = new Date();
      const dateFrom = url.searchParams.get('date_from') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dateTo = url.searchParams.get('date_to') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const d1 = new Date(dateFrom);
      const d2 = new Date(dateTo);
      const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const months = Math.max(1, Math.round(days / 30));

      const txs = await query(
        `SELECT flow, SUM(amount) as total, COUNT(*) as count
         FROM transactions
         WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3
         GROUP BY flow`,
        [userId, dateFrom, dateTo]
      );

      let income = 0;
      let expense = 0;
      let txCount = 0;
      txs.rows.forEach(r => {
        if (r.flow === 'in') income += Number(r.total);
        if (r.flow === 'out') expense += Number(r.total);
        txCount += Number(r.count);
      });
      const net = income - expense;

      // Expense by category
      const expCat = await query(
        `SELECT t.category_id, c.name, c.color, c.icon, SUM(t.amount) as total, COUNT(*) as count
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = $1 AND t.flow = 'out' AND t.type != 'transfer' AND t.date >= $2 AND t.date <= $3
         GROUP BY t.category_id, c.name, c.color, c.icon
         ORDER BY total DESC`,
        [userId, dateFrom, dateTo]
      );

      // Income by category
      const incCat = await query(
        `SELECT t.category_id, c.name, c.color, c.icon, SUM(t.amount) as total, COUNT(*) as count
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = $1 AND t.flow = 'in' AND t.type != 'transfer' AND t.date >= $2 AND t.date <= $3
         GROUP BY t.category_id, c.name, c.color, c.icon
         ORDER BY total DESC`,
        [userId, dateFrom, dateTo]
      );

      // By account
      const byAcc = await query(
        `SELECT a.id as account_id, a.name, a.color,
           COALESCE(SUM(CASE WHEN t.flow = 'in' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as income,
           COALESCE(SUM(CASE WHEN t.flow = 'out' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as expense
         FROM accounts a
         LEFT JOIN transactions t ON t.account_id = a.id AND t.date >= $2 AND t.date <= $3
         WHERE a.user_id = $1
         GROUP BY a.id, a.name, a.color`,
        [userId, dateFrom, dateTo]
      );

      return res.status(200).json({
        range: { date_from: dateFrom, date_to: dateTo, days, months },
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        net: net.toFixed(2),
        savings_rate: income > 0 ? Number(((net / income) * 100).toFixed(1)) : null,
        avg_daily_expense: (expense / days).toFixed(2),
        avg_monthly_expense: (expense / months).toFixed(2),
        transaction_count: txCount,
        expense_by_category: expCat.rows.map(r => ({
          category_id: r.category_id ? Number(r.category_id) : null,
          name: r.name || 'Lainnya',
          color: r.color || '#94A3B8',
          icon: r.icon || 'tag',
          total: Number(r.total).toFixed(2),
          count: Number(r.count),
          percent: expense > 0 ? Number(((Number(r.total) / expense) * 100).toFixed(1)) : 0,
        })),
        income_by_category: incCat.rows.map(r => ({
          category_id: r.category_id ? Number(r.category_id) : null,
          name: r.name || 'Lainnya',
          color: r.color || '#94A3B8',
          icon: r.icon || 'tag',
          total: Number(r.total).toFixed(2),
          count: Number(r.count),
          percent: income > 0 ? Number(((Number(r.total) / income) * 100).toFixed(1)) : 0,
        })),
        by_account: byAcc.rows.map(r => {
          const inc = Number(r.income);
          const exp = Number(r.expense);
          return {
            account_id: Number(r.account_id),
            name: r.name,
            color: r.color,
            income: inc.toFixed(2),
            expense: exp.toFixed(2),
            net: (inc - exp).toFixed(2),
          };
        }),
      });
    }

    if (pathname === '/api/reports/balance-trend') {
      return res.status(200).json({ data: [] });
    }
    if (pathname === '/api/reports/comparison') {
      return res.status(200).json({ data: [], year: new Date().getFullYear() });
    }

    // 16. Notifications API
    if (pathname === '/api/notifications') {
      const notifs = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [userId]);
      const unreadCount = notifs.rows.filter(n => !n.read_at).length;
      return res.status(200).json({
        data: notifs.rows.map(n => ({
          ...n,
          id: Number(n.id),
          read_at: n.read_at ? new Date(n.read_at).toISOString() : null,
          created_at: n.created_at ? new Date(n.created_at).toISOString() : null,
        })),
        unread_count: unreadCount,
      });
    }

    if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
      await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [userId]);
      return res.status(200).json({ message: 'Semua notifikasi ditandai sudah dibaca.' });
    }

    const notifReadMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notifReadMatch && req.method === 'POST') {
      const nId = Number(notifReadMatch[1]);
      await query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2', [nId, userId]);
      return res.status(200).json({ message: 'Notifikasi ditandai sudah dibaca.' });
    }

    const txAttachMatch = pathname.match(/^\/api\/transactions\/(\d+)\/attachment$/);
    if (txAttachMatch && req.method === 'POST') {
      return res.status(200).json({ message: 'Lampiran berhasil diunggah.' });
    }

    // 17. Global Search API
    if (pathname === '/api/search') {
      if (req.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2) {
          return res.status(200).json({
            transactions: [],
            accounts: [],
            categories: [],
            goals: [],
            bills: [],
            debts: [],
          });
        }

        const term = `%${q.toLowerCase()}%`;

        // 1. Transactions
        const txRes = await query(
          `SELECT t.*,
            json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE t.user_id = $1 AND (
             LOWER(COALESCE(t.description, '')) LIKE $2 OR
             LOWER(COALESCE(t.notes, '')) LIKE $2 OR
             LOWER(COALESCE(t.counterparty, '')) LIKE $2 OR
             LOWER(a.name) LIKE $2 OR
             LOWER(COALESCE(c.name, '')) LIKE $2
           )
           ORDER BY t.date DESC, t.id DESC
           LIMIT 15`,
          [userId, term]
        );

        // 2. Accounts
        const accRes = await query(
          `SELECT a.*,
            (a.opening_balance + 
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'in'), 0) -
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'out'), 0)
            ) as balance
           FROM accounts a
           WHERE a.user_id = $1 AND LOWER(a.name) LIKE $2
           ORDER BY a.name ASC
           LIMIT 5`,
          [userId, term]
        );

        // 3. Categories
        const catRes = await query(
          `SELECT * FROM categories
           WHERE user_id = $1 AND LOWER(name) LIKE $2
           ORDER BY name ASC
           LIMIT 5`,
          [userId, term]
        );

        // 4. Savings Goals
        const goalsRes = await query(
          `SELECT g.*,
            COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as saved_amount
           FROM savings_goals g
           WHERE g.user_id = $1 AND LOWER(g.name) LIKE $2
           ORDER BY g.deadline ASC NULLS LAST
           LIMIT 5`,
          [userId, term]
        );

        // 5. Bills
        const billsRes = await query(
          `SELECT * FROM bills
           WHERE user_id = $1 AND (
             LOWER(name) LIKE $2 OR
             LOWER(COALESCE(notes, '')) LIKE $2
           )
           ORDER BY next_due_date ASC NULLS LAST
           LIMIT 5`,
          [userId, term]
        );

        // 6. Debts
        const debtsRes = await query(
          `SELECT d.*,
            COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
           FROM debts d
           WHERE d.user_id = $1 AND (
             LOWER(d.party_name) LIKE $2 OR
             LOWER(COALESCE(d.notes, '')) LIKE $2
           )
           ORDER BY d.due_date ASC NULLS LAST
           LIMIT 5`,
          [userId, term]
        );

        return res.status(200).json({
          transactions: txRes.rows.map(t => ({
            id: Number(t.id),
            type: t.type,
            flow: t.flow,
            date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
            amount: Number(t.amount).toFixed(2),
            description: t.description,
            notes: t.notes,
            counterparty: t.counterparty,
            account_id: Number(t.account_id),
            category_id: t.category_id ? Number(t.category_id) : null,
            account: t.account,
            category: t.category,
            transfer: null,
            has_attachment: Boolean(t.has_attachment),
            attachment_name: t.attachment_name,
            recurring_id: t.recurring_id ? Number(t.recurring_id) : null,
            debt_id: t.debt_id ? Number(t.debt_id) : null,
            bill_id: t.bill_id ? Number(t.bill_id) : null,
            locked_reason: t.locked_reason,
            created_at: t.created_at,
          })),
          accounts: accRes.rows.map(a => ({
            id: Number(a.id),
            name: a.name,
            type: a.type,
            opening_balance: Number(a.opening_balance).toFixed(2),
            start_date: a.start_date ? new Date(a.start_date).toISOString().slice(0, 10) : null,
            color: a.color,
            icon: a.icon,
            is_active: Boolean(a.is_active),
            notes: a.notes,
            balance: Number(a.balance).toFixed(2),
          })),
          categories: catRes.rows.map(c => ({
            id: Number(c.id),
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            is_default: Boolean(c.is_default),
          })),
          goals: goalsRes.rows.map(g => {
            const target = Number(g.target_amount);
            const saved = Number(g.saved_amount);
            const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            return {
              id: Number(g.id),
              name: g.name,
              target_amount: target.toFixed(2),
              saved_amount: saved.toFixed(2),
              remaining: Math.max(0, target - saved).toFixed(2),
              percent,
              deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
              icon: g.icon,
              color: g.color,
              priority: Number(g.priority),
              account_id: g.account_id ? Number(g.account_id) : null,
              notes: g.notes,
              status: g.status,
            };
          }),
          bills: billsRes.rows.map(b => ({
            id: Number(b.id),
            name: b.name,
            amount: Number(b.amount).toFixed(2),
            category_id: b.category_id ? Number(b.category_id) : null,
            account_id: b.account_id ? Number(b.account_id) : null,
            next_due_date: b.next_due_date ? new Date(b.next_due_date).toISOString().slice(0, 10) : null,
            frequency: b.frequency,
            reminder_days: Number(b.reminder_days),
            notes: b.notes,
            is_active: Boolean(b.is_active),
            status: b.status,
          })),
          debts: debtsRes.rows.map(d => {
            const amt = Number(d.amount);
            const paid = Number(d.paid_amount || 0);
            return {
              id: Number(d.id),
              type: d.type,
              party_name: d.party_name,
              amount: amt.toFixed(2),
              paid_amount: paid.toFixed(2),
              remaining: Math.max(0, amt - paid).toFixed(2),
              date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null,
              due_date: d.due_date ? new Date(d.due_date).toISOString().slice(0, 10) : null,
              notes: d.notes,
              status: d.status,
              account_id: d.account_id ? Number(d.account_id) : null,
            };
          }),
        });
      }
    }

    // Default 404 for unknown API routes
    return res.status(404).json({ message: `Route ${pathname} not found.` });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan di server.', error: err.message });
  }
}
