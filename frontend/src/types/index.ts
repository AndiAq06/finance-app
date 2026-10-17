// Tipe data yang mencerminkan kontrak API (lihat docs/API.md).
// Nominal uang selalu string desimal, contoh "1250000.00".

export type Money = string

export interface User {
  id: number
  name: string
  email: string
  is_demo: boolean
  created_at: string
}

export interface Preferences {
  currency: string
  locale: string
  timezone: string
  date_format: string
  theme: 'light' | 'dark' | 'system'
  week_starts_on: number
  notify_transaction: boolean
  notify_budget: boolean
  notify_bill: boolean
  notify_goal: boolean
  notify_debt: boolean
  bill_reminder_days: number
  hide_sensitive_in_notifications: boolean
}

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'savings' | 'other'

export interface Account {
  id: number
  name: string
  type: AccountType
  opening_balance: Money
  start_date: string
  color: string
  icon: string
  is_active: boolean
  notes: string | null
  balance: Money
  transactions_count?: number
}

export type CategoryType = 'income' | 'expense'
export interface Category {
  id: number
  name: string
  type: CategoryType
  icon: string
  color: string
  is_default: boolean
  transactions_count?: number
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'debt' | 'adjustment'
export type Flow = 'in' | 'out'

export interface Transaction {
  id: number
  type: TransactionType
  flow: Flow
  date: string
  amount: Money
  description: string | null
  notes: string | null
  counterparty: string | null
  account_id: number
  category_id: number | null
  account: Pick<Account, 'id' | 'name' | 'color' | 'icon' | 'type'> | null
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon' | 'type'> | null
  transfer: { id: number; from_account_id: number; to_account_id: number; from_account?: string; to_account?: string } | null
  has_attachment: boolean
  attachment_name: string | null
  attachment_url?: string | null
  recurring_id: number | null
  debt_id: number | null
  bill_id: number | null
  locked_reason: string | null
  created_at: string
}

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export interface TransactionList extends Paginated<Transaction> {
  summary: { income: Money; expense: Money; net: Money; count: number }
}

export type BudgetLevel = 'safe' | 'half' | 'warning' | 'danger' | 'over'
export interface BudgetRow {
  id: number
  category_id: number | null
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  amount: Money
  spent: Money
  remaining: Money
  percent: number
  level: BudgetLevel
  is_recurring: boolean
}
export interface BudgetMonth {
  month: string
  overall: BudgetRow | null
  categories: BudgetRow[]
  totals: { budgeted: Money; spent: Money; remaining: Money; percent: number; month_expense: Money; unbudgeted_spent: Money }
}

export interface SavingsGoal {
  id: number
  name: string
  target_amount: Money
  saved_amount: Money
  remaining: Money
  percent: number
  deadline: string | null
  icon: string
  color: string
  priority: number
  account_id: number | null
  account: Pick<Account, 'id' | 'name' | 'balance'> | null
  notes: string | null
  status: 'active' | 'achieved'
  required_per_month: Money | null
  required_per_week: Money | null
  months_left: number | null
  contributions?: SavingsContribution[]
}
export interface SavingsContribution {
  id: number
  type: 'deposit' | 'withdrawal'
  amount: Money
  date: string
  note: string | null
  created_at: string
}

export type DebtType = 'debt' | 'receivable'
export type DebtStatus = 'unpaid' | 'partial' | 'paid'
export interface Debt {
  id: number
  type: DebtType
  party_name: string
  amount: Money
  paid_amount: Money
  remaining: Money
  date: string
  due_date: string | null
  notes: string | null
  status: DebtStatus
  account_id: number | null
  is_overdue: boolean
  payments?: DebtPayment[]
}
export interface DebtPayment {
  id: number
  amount: Money
  date: string
  account_id: number | null
  account?: string | null
  note: string | null
  transaction_id: number | null
}

export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface Bill {
  id: number
  name: string
  amount: Money
  category_id: number | null
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  account_id: number | null
  account: Pick<Account, 'id' | 'name'> | null
  next_due_date: string | null
  frequency: Exclude<Frequency, 'daily'>
  reminder_days: number
  notes: string | null
  is_active: boolean
  status: 'unpaid' | 'paid' | 'overdue'
  days_until_due: number | null
  last_paid_date: string | null
  payments?: { id: number; period_due_date: string; paid_date: string; amount: Money; transaction_id: number | null }[]
}

export interface Recurring {
  id: number
  type: 'income' | 'expense'
  amount: Money
  account_id: number
  category_id: number
  account: Pick<Account, 'id' | 'name'> | null
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  description: string
  frequency: Exclude<Frequency, 'once'>
  interval: number
  start_date: string
  end_date: string | null
  next_run_date: string | null
  last_run_date: string | null
  is_active: boolean
  generated_count: number
}

export interface AppNotification {
  id: number
  type: string
  title: string
  body: string
  link: string | null
  severity: 'info' | 'success' | 'warning' | 'danger'
  read_at: string | null
  created_at: string
}

export interface CashflowPoint {
  period: string
  label: string
  income: Money
  expense: Money
  net: Money
}

export interface CategoryBreakdown {
  category_id: number | null
  name: string
  color: string
  icon: string
  total: Money
  count: number
  percent: number
}

export interface Dashboard {
  period: { month: string; date_from: string; date_to: string; prev_from: string; prev_to: string }
  total_balance: Money
  accounts: Account[]
  month: {
    income: Money
    expense: Money
    net: Money
    prev_income: Money
    prev_expense: Money
    prev_net: Money
    income_change_pct: number | null
    expense_change_pct: number | null
    net_change_pct: number | null
    savings_rate: number | null
    transaction_count: number
  }
  expense_by_category: CategoryBreakdown[]
  budget: { budgeted: Money; spent: Money; remaining: Money; percent: number; has_budget: boolean; over_count: number; warning_count: number }
  goals: SavingsGoal[]
  recent_transactions: Transaction[]
  upcoming_bills: Bill[]
  debts: { debt_remaining: Money; receivable_remaining: Money; debt_count: number; receivable_count: number; overdue_count: number }
}

export interface ReportSummary {
  range: { date_from: string; date_to: string; days: number; months: number }
  income: Money
  expense: Money
  net: Money
  savings_rate: number | null
  avg_daily_expense: Money
  avg_monthly_expense: Money
  transaction_count: number
  expense_by_category: CategoryBreakdown[]
  income_by_category: CategoryBreakdown[]
  by_account: { account_id: number; name: string; color: string; income: Money; expense: Money; net: Money }[]
}

export interface SearchResults {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  goals: SavingsGoal[]
  bills: Bill[]
  debts: Debt[]
}
