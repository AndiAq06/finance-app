import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  PlusCircle, ArrowRightLeft, Target, CalendarClock, ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useDashboard, useFinanceMutation } from '@/lib/queries'
import type { Dashboard } from '@/types'
import { api } from '@/lib/api'
import { formatRupiah, formatPercent, greeting, monthKey } from '@/lib/format'
import { Card, Badge, Progress, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'
import { IconBadge } from '@/components/ui/icons'
import { TransactionModal } from '@/components/modals/TransactionModal'

export function DashboardPage() {
  const currentMonth = React.useMemo(() => monthKey(new Date()), [])
  const { data, isLoading, error, refetch } = useDashboard({ month: currentMonth })

  const [txModalOpen, setTxModalOpen] = React.useState(false)
  const [txType, setTxType] = React.useState<'expense' | 'income' | 'transfer'>('expense')

  const payBillMutation = useFinanceMutation(
    (billId: number) =>
      api.post(`/bills/${billId}/pay`, {
        paid_date: new Date().toISOString().slice(0, 10),
        create_transaction: true,
      }),
    {
      success: 'Tagihan berhasil dibayar & dicatat dalam transaksi',
    },
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message="Gagal memuat data dashboard" onRetry={() => refetch()} />
  }

  const {
    total_balance = '0.00',
    month = {
      income: '0.00',
      expense: '0.00',
      net: '0.00',
      prev_income: '0.00',
      prev_expense: '0.00',
      prev_net: '0.00',
      income_change_pct: null,
      expense_change_pct: null,
      net_change_pct: null,
      savings_rate: null,
      transaction_count: 0,
    },
    accounts = [],
    expense_by_category = [],
    budget = {
      budgeted: '0.00',
      spent: '0.00',
      remaining: '0.00',
      percent: 0,
      has_budget: false,
      over_count: 0,
      warning_count: 0,
    },
    goals = [],
    upcoming_bills = [],
    recent_transactions = [],
  } = (data || {}) as Dashboard

  const isNetPositive = Number(month?.net ?? 0) >= 0

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Top Banner / Welcome greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base sm:text-xl font-bold tracking-tight text-fg">{greeting()} 👋</span>
            <Badge tone="primary" className="gap-1 text-xs shrink-0">
              <Sparkles className="size-3" /> Ringkasan
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-fg-muted mt-0.5">
            Berikut ringkasan kondisi finansial dan arus kas Anda bulan ini.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center w-full sm:w-auto shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTxType('transfer')
              setTxModalOpen(true)
            }}
            className="gap-1.5 justify-center h-9 text-xs"
          >
            <ArrowRightLeft className="size-3.5" /> Transfer
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTxType('expense')
              setTxModalOpen(true)
            }}
            className="gap-1.5 shadow-sm justify-center h-9 text-xs"
          >
            <PlusCircle className="size-4" /> Transaksi
          </Button>
        </div>
      </div>

      {/* Main Metric Cards (2x2 on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 min-w-0">
        {/* Total Saldo */}
        <Card className="p-3 sm:p-5 relative overflow-hidden bg-gradient-to-br from-surface to-surface-2 border-border/80 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate">Kekayaan Bersih</span>
            <span className="grid size-6 sm:size-9 place-items-center rounded-lg sm:rounded-xl bg-primary-soft text-primary shrink-0">
              <Wallet className="size-3 sm:size-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-3 text-sm sm:text-2xl font-black tabular tracking-tight text-fg truncate">
            {formatRupiah(total_balance)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-fg-muted truncate">
            <span>{accounts.length} rekening</span>
          </div>
        </Card>

        {/* Pemasukan Bulan Ini */}
        <Card className="p-3 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate">Pemasukan</span>
            <span className="grid size-6 sm:size-9 place-items-center rounded-lg sm:rounded-xl bg-income-soft text-income shrink-0">
              <ArrowDownRight className="size-3 sm:size-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-3 text-sm sm:text-2xl font-bold tabular tracking-tight text-income truncate">
            +{formatRupiah(month.income)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs truncate">
            {month.income_change_pct !== null && (
              <span className={`font-semibold ${month.income_change_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                {month.income_change_pct >= 0 ? '+' : ''}
                {formatPercent(month.income_change_pct)}
              </span>
            )}
            <span className="text-fg-subtle">vs lalu</span>
          </div>
        </Card>

        {/* Pengeluaran Bulan Ini */}
        <Card className="p-3 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate">Pengeluaran</span>
            <span className="grid size-6 sm:size-9 place-items-center rounded-lg sm:rounded-xl bg-expense-soft text-expense shrink-0">
              <ArrowUpRight className="size-3 sm:size-4" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-3 text-sm sm:text-2xl font-bold tabular tracking-tight text-expense truncate">
            -{formatRupiah(month.expense)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs truncate">
            {month.expense_change_pct !== null && (
              <span className={`font-semibold ${month.expense_change_pct <= 0 ? 'text-income' : 'text-expense'}`}>
                {month.expense_change_pct >= 0 ? '+' : ''}
                {formatPercent(month.expense_change_pct)}
              </span>
            )}
            <span className="text-fg-subtle">vs lalu</span>
          </div>
        </Card>

        {/* Selisih Bersih (Cashflow) */}
        <Card className="p-3 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate">Arus Kas</span>
            <span
              className={`grid size-6 sm:size-9 place-items-center rounded-lg sm:rounded-xl shrink-0 ${
                isNetPositive ? 'bg-primary-soft text-primary' : 'bg-expense-soft text-expense'
              }`}
            >
              {isNetPositive ? <TrendingUp className="size-3 sm:size-4" /> : <TrendingDown className="size-3 sm:size-4" />}
            </span>
          </div>
          <p className={`mt-1.5 sm:mt-3 text-sm sm:text-2xl font-bold tabular tracking-tight truncate ${isNetPositive ? 'text-fg' : 'text-expense'}`}>
            {formatRupiah(month.net, { sign: true })}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-fg-muted truncate">
            <span>Simpanan:</span>
            <span className="font-bold text-fg">{formatPercent(month.savings_rate)}</span>
          </div>
        </Card>
      </div>

      {/* Middle Grid: Expense Breakdown + Budget Status VS Upcoming Bills & Goals */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 min-w-0">
        {/* Left Column (2 cols): Expense Breakdown & Budget */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2 min-w-0">
          {/* Budget Quick Widget */}
          {budget.has_budget && (
            <Card className="p-3.5 sm:p-5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-fg truncate">Status Anggaran Bulanan</h3>
                  <p className="text-xs text-fg-muted mt-0.5 truncate">
                    Terpakai {formatRupiah(budget.spent)} dari total {formatRupiah(budget.budgeted)}
                  </p>
                </div>
                <Badge
                  tone={
                    budget.percent > 100 ? 'expense' : budget.percent >= 80 ? 'warning' : 'primary'
                  }
                  className="shrink-0 text-xs"
                >
                  {budget.percent}% terpakai
                </Badge>
              </div>

              <div className="mt-3">
                <Progress
                  value={budget.percent}
                  tone={
                    budget.percent > 100 ? 'expense' : budget.percent >= 80 ? 'warning' : 'primary'
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-fg-muted gap-2">
                <span className="truncate">Sisa: <strong className="text-fg">{formatRupiah(budget.remaining)}</strong></span>
                <Link to="/budgets" className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0">
                  Atur Anggaran <ChevronRight className="size-3" />
                </Link>
              </div>
            </Card>
          )}

          {/* Expense by category */}
          <Card className="p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border gap-2">
              <h3 className="text-sm font-bold text-fg truncate">Pengeluaran Terbesar per Kategori</h3>
              <Link to="/reports" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0">
                Laporan <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3.5 space-y-3">
              {expense_by_category.length === 0 ? (
                <div className="py-8 text-center text-sm text-fg-muted">
                  Belum ada pengeluaran tercatat bulan ini.
                </div>
              ) : (
                expense_by_category.slice(0, 5).map((cat) => (
                  <div key={cat.category_id ?? cat.name} className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <IconBadge icon={cat.icon} color={cat.color} size="sm" />
                        <span className="font-semibold text-fg truncate">{cat.name}</span>
                        <span className="text-fg-subtle shrink-0">({cat.count})</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold tabular text-fg">{formatRupiah(cat.total)}</span>
                        <span className="ml-1 text-fg-subtle">({cat.percent}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, cat.percent)}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Transactions List */}
          <Card className="p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border gap-2">
              <h3 className="text-sm font-bold text-fg truncate">Transaksi Terbaru</h3>
              <Link to="/transactions" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0">
                Lihat Semua <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="mt-2 divide-y divide-border">
              {recent_transactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-fg-muted">
                  Belum ada transaksi. Klik "Catat Transaksi" untuk memulai.
                </div>
              ) : (
                recent_transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 sm:py-3 gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <IconBadge
                        icon={tx.category?.icon || tx.account?.icon || 'circle-dot'}
                        color={tx.category?.color || tx.account?.color}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs sm:text-sm text-fg truncate">
                          {tx.description || tx.category?.name || 'Transaksi'}
                        </p>
                        <p className="text-[11px] sm:text-xs text-fg-subtle truncate">
                          {tx.date} • {tx.account?.name ?? 'Akun'} {tx.counterparty ? `• ${tx.counterparty}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <p
                        className={`font-bold tabular text-xs sm:text-sm ${
                          tx.flow === 'in' ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {tx.flow === 'in' ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </p>
                      {tx.type === 'transfer' && (
                        <Badge tone="transfer" className="mt-0.5 text-[10px]">
                          Transfer
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (1 col): Upcoming Bills & Savings Goals */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Upcoming Bills */}
          <Card className="p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <CalendarClock className="size-4 text-warning shrink-0" />
                <h3 className="text-sm font-bold text-fg truncate">Tagihan Mendatang</h3>
              </div>
              <Link to="/bills" className="text-xs font-semibold text-primary hover:underline shrink-0">
                Kelola
              </Link>
            </div>

            <div className="mt-3 space-y-2.5">
              {upcoming_bills.length === 0 ? (
                <div className="py-6 text-center text-xs text-fg-muted">
                  Tidak ada tagihan yang harus dibayar saat ini.
                </div>
              ) : (
                upcoming_bills.map((bill) => {
                  const isOverdue = bill.status === 'overdue'
                  return (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-xl border border-border p-2.5 sm:p-3 transition-colors hover:bg-surface-2 gap-2 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-fg truncate">{bill.name}</p>
                        <p className="text-[11px] text-fg-subtle mt-0.5 truncate">
                          Jatuh tempo: {bill.next_due_date || '—'}
                        </p>
                        <p className="text-xs font-extrabold text-fg tabular mt-1 truncate">
                          {formatRupiah(bill.amount)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isOverdue ? 'danger' : 'secondary'}
                        className="h-8 text-xs shrink-0 px-2.5"
                        loading={payBillMutation.isPending}
                        onClick={() => payBillMutation.mutate(bill.id)}
                      >
                        Bayar
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Savings Goals */}
          <Card className="p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Target className="size-4 text-primary shrink-0" />
                <h3 className="text-sm font-bold text-fg truncate">Target Tabungan</h3>
              </div>
              <Link to="/goals" className="text-xs font-semibold text-primary hover:underline shrink-0">
                Lihat Semua
              </Link>
            </div>

            <div className="mt-3 space-y-3">
              {goals.length === 0 ? (
                <div className="py-6 text-center text-xs text-fg-muted">
                  Belum ada target tabungan. Pasang impian finansial Anda sekarang.
                </div>
              ) : (
                goals.map((g) => (
                  <div key={g.id} className="space-y-1.5 rounded-xl border border-border p-2.5 sm:p-3 min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <IconBadge icon={g.icon} color={g.color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-fg truncate">{g.name}</p>
                          <p className="text-[11px] text-fg-subtle truncate">
                            {formatRupiah(g.saved_amount)} / {formatRupiah(g.target_amount)}
                          </p>
                        </div>
                      </div>
                      <Badge tone="primary" className="shrink-0 text-[10px] sm:text-xs px-1.5 py-0.5">{g.percent}%</Badge>
                    </div>
                    <Progress value={g.percent} tone="primary" />
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick Accounts list */}
          <Card className="p-3.5 sm:p-5 min-w-0">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border gap-2">
              <h3 className="text-sm font-bold text-fg truncate">Rekening & Dompet</h3>
              <Link to="/accounts" className="text-xs font-semibold text-primary hover:underline shrink-0">
                Detail
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-1.5 text-xs gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <IconBadge icon={acc.icon} color={acc.color} size="sm" />
                    <span className="font-semibold text-fg truncate">{acc.name}</span>
                  </div>
                  <span className="font-bold tabular text-fg shrink-0 text-right">{formatRupiah(acc.balance)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <TransactionModal
        open={txModalOpen}
        onOpenChange={setTxModalOpen}
        initialType={txType}
      />
    </div>
  )
}
