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
        const accounts = await query(
          `SELECT a.*,
            COALESCE((SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id), 0) as transactions_count,
            (a.opening_balance + 
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'in'), 0) -
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.account_id = a.id AND t.flow = 'out'), 0)
            ) as balance
           FROM accounts a
           WHERE a.user_id = $1 AND a.is_active = true
           ORDER BY a.id ASC`,
          [userId]
        );
        const data = accounts.rows.map(a => ({
          ...a,
          id: Number(a.id),
          opening_balance: Number(a.opening_balance).toFixed(2),
          balance: Number(a.balance).toFixed(2),
          transactions_count: Number(a.transactions_count),
        }));
        return res.status(200).json(data);
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
           ORDER BY c.id ASC`,
          [userId]
        );
        return res.status(200).json(cats.rows.map(c => ({
          ...c,
          id: Number(c.id),
          transactions_count: Number(c.transactions_count),
        })));
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
         ORDER BY a.id ASC`,
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
          start_date: a.start_date,
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

      // Recent Transactions
      const recentTx = await query(
        `SELECT t.*,
          json_build_object('id', a.id, 'name', a.name, 'color', a.color, 'icon', a.icon, 'type', a.type) as account,
          CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon, 'type', c.type) ELSE NULL END as category
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = $1
         ORDER BY t.date DESC, t.id DESC
         LIMIT 6`,
        [userId]
      );

      // Budgets
      const budgetsRes = await query(
        `SELECT b.*,
          CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category,
          COALESCE((
            SELECT SUM(amount) FROM transactions t 
            WHERE t.user_id = b.user_id AND t.flow = 'out' AND t.type != 'transfer' 
              AND (b.category_id IS NULL OR t.category_id = b.category_id)
              AND to_char(t.date, 'YYYY-MM') = b.month
          ), 0) as spent
         FROM budgets b
         LEFT JOIN categories c ON b.category_id = c.id
         WHERE b.user_id = $1 AND b.month = $2`,
        [userId, monthStr]
      );
      let totalBudgetLimit = 0;
      let totalBudgetSpent = 0;
      const budgetItems = budgetsRes.rows.map(b => {
        const amt = Number(b.amount);
        const spent = Number(b.spent);
        const rem = amt - spent;
        const pct = amt > 0 ? (spent / amt) * 100 : 0;
        if (b.category_id === null) {
          totalBudgetLimit = amt;
          totalBudgetSpent = spent;
        }
        return {
          id: Number(b.id),
          category_id: b.category_id ? Number(b.category_id) : null,
          category: b.category,
          amount: amt.toFixed(2),
          spent: spent.toFixed(2),
          remaining: rem.toFixed(2),
          percent: Number(pct.toFixed(1)),
          level: pct >= 100 ? 'over' : pct >= 80 ? 'danger' : pct >= 50 ? 'warning' : 'safe'
        };
      });

      // Savings Goals
      const goalsRes = await query(
        `SELECT g.*,
          COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as current_amount
         FROM savings_goals g
         WHERE g.user_id = $1 AND g.status = 'active'
         ORDER BY g.priority ASC`,
        [userId]
      );
      let totalSavingsTarget = 0;
      let totalSavingsCurrent = 0;
      const goals = goalsRes.rows.map(g => {
        const cur = Number(g.current_amount);
        const tgt = Number(g.target_amount);
        totalSavingsCurrent += cur;
        totalSavingsTarget += tgt;
        return {
          id: Number(g.id),
          name: g.name,
          target_amount: tgt.toFixed(2),
          current_amount: cur.toFixed(2),
          color: g.color,
          icon: g.icon,
          percent: tgt > 0 ? Number(((cur / tgt) * 100).toFixed(1)) : 0,
        };
      });

      // Bills upcoming
      const billsRes = await query(
        `SELECT b.*,
          c.name as category_name
         FROM bills b
         LEFT JOIN categories c ON b.category_id = c.id
         WHERE b.user_id = $1 AND b.is_active = true
         ORDER BY b.next_due_date ASC
         LIMIT 5`,
        [userId]
      );
      const bills = billsRes.rows.map(b => ({
        id: Number(b.id),
        name: b.name,
        amount: Number(b.amount).toFixed(2),
        next_due_date: b.next_due_date,
        frequency: b.frequency,
        is_paid: false,
      }));

      // Debts summary
      const debtsRes = await query(
        `SELECT d.*,
          COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
         FROM debts d
         WHERE d.user_id = $1 AND d.status != 'paid'`,
        [userId]
      );
      let totalReceivable = 0;
      let totalPayable = 0;
      debtsRes.rows.forEach(d => {
        const rem = Number(d.amount) - Number(d.paid_amount);
        if (d.type === 'receivable') totalReceivable += rem;
        else totalPayable += rem;
      });

      // Cash flow 6 months trend
      const cashFlowTrend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mStart = `${mStr}-01`;
        const mEnd = `${mStr}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

        const mRes = await query(
          `SELECT flow, SUM(amount) as total 
           FROM transactions 
           WHERE user_id = $1 AND type != 'transfer' AND date >= $2 AND date <= $3 
           GROUP BY flow`,
          [userId, mStart, mEnd]
        );
        let inc = 0;
        let exp = 0;
        mRes.rows.forEach(r => {
          if (r.flow === 'in') inc = Number(r.total);
          if (r.flow === 'out') exp = Number(r.total);
        });
        cashFlowTrend.push({
          month: mStr,
          label: d.toLocaleDateString('id-ID', { month: 'short' }),
          income: inc,
          expense: exp,
          net: inc - exp
        });
      }

      return res.status(200).json({
        period: { month: monthStr, start: startOfMonth, end: endOfMonth },
        net_worth: (totalBalance + totalReceivable - totalPayable).toFixed(2),
        total_balance: totalBalance.toFixed(2),
        kpi: {
          income: income.toFixed(2),
          expense: expense.toFixed(2),
          net: net.toFixed(2),
          transactions_count: txCount,
          savings_rate: income > 0 ? Number(((net / income) * 100).toFixed(1)) : 0,
        },
        accounts,
        recent_transactions: recentTx.rows.map(t => ({
          ...t,
          id: Number(t.id),
          amount: Number(t.amount).toFixed(2),
        })),
        cash_flow_trend: cashFlowTrend,
        expense_by_category,
        budget: {
          total_limit: totalBudgetLimit.toFixed(2),
          total_spent: totalBudgetSpent.toFixed(2),
          percent: totalBudgetLimit > 0 ? Number(((totalBudgetSpent / totalBudgetLimit) * 100).toFixed(1)) : 0,
          items: budgetItems,
        },
        savings_goals: {
          total_target: totalSavingsTarget.toFixed(2),
          total_current: totalSavingsCurrent.toFixed(2),
          items: goals,
        },
        upcoming_bills: bills,
        debts: {
          receivable: totalReceivable.toFixed(2),
          debt: totalPayable.toFixed(2),
        }
      });
    }

    // 10. Transactions API
    if (pathname === '/api/transactions') {
      if (req.method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') || 20)));
        const offset = (page - 1) * perPage;

        const accountId = url.searchParams.get('account_id');
        const categoryId = url.searchParams.get('category_id');
        const flow = url.searchParams.get('flow');
        const type = url.searchParams.get('type');
        const search = url.searchParams.get('search');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        let whereClauses = ['t.user_id = $1'];
        let params: any[] = [userId];

        if (accountId) {
          params.push(accountId);
          whereClauses.push(`t.account_id = $${params.length}`);
        }
        if (categoryId) {
          params.push(categoryId);
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
          whereClauses.push(`(LOWER(t.description) LIKE $${params.length} OR LOWER(COALESCE(t.counterparty, '')) LIKE $${params.length})`);
        }

        const whereSql = whereClauses.join(' AND ');

        // Total count & summary
        const countRes = await query(
          `SELECT COUNT(*) as total,
            COALESCE(SUM(CASE WHEN t.flow = 'in' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN t.flow = 'out' AND t.type != 'transfer' THEN t.amount ELSE 0 END), 0) as expense
           FROM transactions t WHERE ${whereSql}`,
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
            CASE WHEN tr.id IS NOT NULL THEN json_build_object('id', tr.id, 'from_account_id', tr.from_account_id, 'to_account_id', tr.to_account_id) ELSE NULL END as transfer
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
        const { type, account_id, to_account_id, category_id, date, amount, description, counterparty, notes } = b;

        if (type === 'transfer') {
          // Double entry transfer
          const fromTx = await query(
            `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, notes, created_at, updated_at)
             VALUES ($1, $2, NULL, 'transfer', 'out', $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
            [userId, account_id, date, amount, description || 'Transfer Keluar', notes || null]
          );
          const toTx = await query(
            `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, notes, created_at, updated_at)
             VALUES ($1, $2, NULL, 'transfer', 'in', $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
            [userId, to_account_id, date, amount, description || 'Transfer Masuk', notes || null]
          );
          await query(
            `INSERT INTO transfers (user_id, from_account_id, to_account_id, from_transaction_id, to_transaction_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, account_id, to_account_id, fromTx.rows[0].id, toTx.rows[0].id]
          );
          return res.status(201).json(fromTx.rows[0]);
        }

        const flow = type === 'income' ? 'in' : 'out';
        const ins = await query(
          `INSERT INTO transactions (user_id, account_id, category_id, type, flow, date, amount, description, counterparty, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
          [userId, account_id, category_id || null, type, flow, date, amount, description || null, counterparty || null, notes || null]
        );
        return res.status(201).json(ins.rows[0]);
      }
    }

    const txMatch = pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (txMatch) {
      const txId = Number(txMatch[1]);
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
        const budgets = await query(
          `SELECT b.*,
            CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'icon', c.icon) ELSE NULL END as category,
            COALESCE((
              SELECT SUM(amount) FROM transactions t 
              WHERE t.user_id = b.user_id AND t.flow = 'out' AND t.type != 'transfer' 
                AND (b.category_id IS NULL OR t.category_id = b.category_id)
                AND to_char(t.date, 'YYYY-MM') = b.month
            ), 0) as spent
           FROM budgets b
           LEFT JOIN categories c ON b.category_id = c.id
           WHERE b.user_id = $1 AND b.month = $2`,
          [userId, month]
        );
        return res.status(200).json(budgets.rows.map(b => {
          const amt = Number(b.amount);
          const sp = Number(b.spent);
          const rem = amt - sp;
          const pct = amt > 0 ? (sp / amt) * 100 : 0;
          return {
            id: Number(b.id),
            category_id: b.category_id ? Number(b.category_id) : null,
            category: b.category,
            amount: amt.toFixed(2),
            spent: sp.toFixed(2),
            remaining: rem.toFixed(2),
            percent: Number(pct.toFixed(1)),
            level: pct >= 100 ? 'over' : pct >= 80 ? 'danger' : pct >= 50 ? 'warning' : 'safe'
          };
        }));
      }
      if (req.method === 'POST') {
        const { category_id, month, amount, is_recurring } = req.body || {};
        const ins = await query(
          `INSERT INTO budgets (user_id, category_id, month, amount, is_recurring, created_at, updated_at)
           VALUES ($1, $2, $3, $4, COALESCE($5, true), NOW(), NOW())
           ON CONFLICT (user_id, category_id, month) 
           DO UPDATE SET amount = EXCLUDED.amount, is_recurring = EXCLUDED.is_recurring, updated_at = NOW()
           RETURNING *`,
          [userId, category_id || null, month, amount, is_recurring]
        );
        return res.status(200).json(ins.rows[0]);
      }
    }

    const budgetDel = pathname.match(/^\/api\/budgets\/(\d+)$/);
    if (budgetDel && req.method === 'DELETE') {
      await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [Number(budgetDel[1]), userId]);
      return res.status(200).json({ message: 'Anggaran dihapus.' });
    }

    // 12. Goals API
    if (pathname === '/api/goals') {
      if (req.method === 'GET') {
        const goals = await query(
          `SELECT g.*,
            COALESCE((SELECT SUM(amount) FROM savings_contributions sc WHERE sc.savings_goal_id = g.id), 0) as current_amount
           FROM savings_goals g
           WHERE g.user_id = $1
           ORDER BY g.priority ASC`,
          [userId]
        );
        return res.status(200).json(goals.rows.map(g => {
          const tgt = Number(g.target_amount);
          const cur = Number(g.current_amount);
          return {
            ...g,
            id: Number(g.id),
            target_amount: tgt.toFixed(2),
            current_amount: cur.toFixed(2),
            percent: tgt > 0 ? Number(((cur / tgt) * 100).toFixed(1)) : 0,
          };
        }));
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO savings_goals (user_id, account_id, name, target_amount, deadline, icon, color, priority, notes, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), NOW()) RETURNING *`,
          [userId, b.account_id || null, b.name, b.target_amount, b.deadline || null, b.icon || 'target', b.color || '#16A34A', b.priority || 1, b.notes || null]
        );
        return res.status(201).json({ ...ins.rows[0], id: Number(ins.rows[0].id), current_amount: '0.00', percent: 0 });
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

    // 13. Debts API
    if (pathname === '/api/debts') {
      if (req.method === 'GET') {
        const debts = await query(
          `SELECT d.*,
            COALESCE((SELECT SUM(amount) FROM debt_payments dp WHERE dp.debt_id = d.id), 0) as paid_amount
           FROM debts d
           WHERE d.user_id = $1
           ORDER BY d.date DESC`,
          [userId]
        );
        return res.status(200).json(debts.rows.map(d => {
          const amt = Number(d.amount);
          const pd = Number(d.paid_amount);
          const rem = amt - pd;
          return {
            ...d,
            id: Number(d.id),
            amount: amt.toFixed(2),
            paid_amount: pd.toFixed(2),
            remaining_amount: rem.toFixed(2),
            percent: amt > 0 ? Number(((pd / amt) * 100).toFixed(1)) : 0,
          };
        }));
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO debts (user_id, account_id, type, party_name, amount, date, due_date, notes, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', NOW(), NOW()) RETURNING *`,
          [userId, b.account_id || null, b.type, b.party_name, b.amount, b.date, b.due_date || null, b.notes || null]
        );
        return res.status(201).json({ ...ins.rows[0], id: Number(ins.rows[0].id), paid_amount: '0.00', remaining_amount: Number(b.amount).toFixed(2) });
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

    // 14. Bills API
    if (pathname === '/api/bills') {
      if (req.method === 'GET') {
        const bills = await query(
          `SELECT b.*,
            c.name as category_name
           FROM bills b
           LEFT JOIN categories c ON b.category_id = c.id
           WHERE b.user_id = $1 AND b.is_active = true
           ORDER BY b.next_due_date ASC`,
          [userId]
        );
        return res.status(200).json(bills.rows.map(b => ({
          ...b,
          id: Number(b.id),
          amount: Number(b.amount).toFixed(2),
        })));
      }
      if (req.method === 'POST') {
        const b = req.body || {};
        const ins = await query(
          `INSERT INTO bills (user_id, category_id, account_id, name, amount, next_due_date, frequency, reminder_days, notes, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()) RETURNING *`,
          [userId, b.category_id || null, b.account_id || null, b.name, b.amount, b.next_due_date || null, b.frequency || 'monthly', b.reminder_days || 3, b.notes || null]
        );
        return res.status(201).json({ ...ins.rows[0], id: Number(ins.rows[0].id) });
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

    // 15. Reports API
    if (pathname.startsWith('/api/reports/')) {
      const year = url.searchParams.get('year') || String(new Date().getFullYear());
      if (pathname === '/api/reports/summary' || pathname === '/api/reports/cashflow') {
        const summary = await query(
          `SELECT to_char(date, 'YYYY-MM') as month, flow, SUM(amount) as total 
           FROM transactions 
           WHERE user_id = $1 AND type != 'transfer' AND to_char(date, 'YYYY') = $2
           GROUP BY month, flow ORDER BY month ASC`,
          [userId, year]
        );
        return res.status(200).json(summary.rows);
      }
      return res.status(200).json([]);
    }

    // 16. Notifications API
    if (pathname === '/api/notifications') {
      const notifs = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]);
      return res.status(200).json(notifs.rows.map(n => ({ ...n, id: Number(n.id) })));
    }

    // Default 404 for unknown API routes
    return res.status(404).json({ message: `Route ${pathname} not found.` });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan di server.', error: err.message });
  }
}
