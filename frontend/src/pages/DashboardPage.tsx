import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  PlusCircle, ArrowRightLeft, Target, CalendarClock, ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useDashboard, useFinanceMutation } from '@/lib/queries'
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

  const { total_balance, month, accounts, expense_by_category, budget, goals, upcoming_bills, recent_transactions } = data

  const isNetPositive = Number(month.net) >= 0

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-fg">{greeting()} 👋</span>
            <Badge tone="primary" className="gap-1">
              <Sparkles className="size-3" /> Ringkasan Keuangan
            </Badge>
          </div>
          <p className="text-sm text-fg-muted mt-0.5">
            Berikut ringkasan kondisi finansial dan arus kas Anda bulan ini.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTxType('transfer')
              setTxModalOpen(true)
            }}
            className="gap-1.5"
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
            className="gap-1.5 shadow-sm"
          >
            <PlusCircle className="size-4" /> Catat Transaksi
          </Button>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Saldo */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-surface to-surface-2 border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Total Kekayaan Bersih</span>
            <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <Wallet className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-black tabular tracking-tight text-fg">
            {formatRupiah(total_balance)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
            <span>Dari {accounts.length} rekening aktif</span>
          </div>
        </Card>

        {/* Pemasukan Bulan Ini */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Pemasukan Bulan Ini</span>
            <span className="grid size-9 place-items-center rounded-xl bg-income-soft text-income">
              <ArrowDownRight className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular tracking-tight text-income">
            +{formatRupiah(month.income)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {month.income_change_pct !== null && (
              <span className={`font-semibold ${month.income_change_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                {month.income_change_pct >= 0 ? '+' : ''}
                {formatPercent(month.income_change_pct)}
              </span>
            )}
            <span className="text-fg-subtle">vs bulan lalu</span>
          </div>
        </Card>

        {/* Pengeluaran Bulan Ini */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Pengeluaran Bulan Ini</span>
            <span className="grid size-9 place-items-center rounded-xl bg-expense-soft text-expense">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular tracking-tight text-expense">
            -{formatRupiah(month.expense)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {month.expense_change_pct !== null && (
              <span className={`font-semibold ${month.expense_change_pct <= 0 ? 'text-income' : 'text-expense'}`}>
                {month.expense_change_pct >= 0 ? '+' : ''}
                {formatPercent(month.expense_change_pct)}
              </span>
            )}
            <span className="text-fg-subtle">vs bulan lalu</span>
          </div>
        </Card>

        {/* Selisih Bersih (Cashflow) */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Surplus Arus Kas</span>
            <span
              className={`grid size-9 place-items-center rounded-xl ${
                isNetPositive ? 'bg-primary-soft text-primary' : 'bg-expense-soft text-expense'
              }`}
            >
              {isNetPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            </span>
          </div>
          <p className={`mt-3 text-2xl font-bold tabular tracking-tight ${isNetPositive ? 'text-fg' : 'text-expense'}`}>
            {formatRupiah(month.net, { sign: true })}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
            <span>Rasio Simpanan:</span>
            <span className="font-bold text-fg">{formatPercent(month.savings_rate)}</span>
          </div>
        </Card>
      </div>

      {/* Middle Grid: Expense Breakdown + Budget Status VS Upcoming Bills & Goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Expense Breakdown & Budget */}
        <div className="space-y-6 lg:col-span-2">
          {/* Budget Quick Widget */}
          {budget.has_budget && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-fg">Status Anggaran Bulanan</h3>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Terpakai {formatRupiah(budget.spent)} dari total anggaran {formatRupiah(budget.budgeted)}
                  </p>
                </div>
                <Badge
                  tone={
                    budget.percent > 100 ? 'expense' : budget.percent >= 80 ? 'warning' : 'primary'
                  }
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

              <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
                <span>Sisa Anggaran: <strong className="text-fg">{formatRupiah(budget.remaining)}</strong></span>
                <Link to="/budgets" className="text-primary hover:underline font-semibold flex items-center gap-1">
                  Atur Anggaran <ChevronRight className="size-3" />
                </Link>
              </div>
            </Card>
          )}

          {/* Expense by category */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-fg">Pengeluaran Terbesar per Kategori</h3>
              <Link to="/reports" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Laporan Lengkap <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="mt-4 space-y-3.5">
              {expense_by_category.length === 0 ? (
                <div className="py-8 text-center text-sm text-fg-muted">
                  Belum ada pengeluaran tercatat bulan ini.
                </div>
              ) : (
                expense_by_category.slice(0, 5).map((cat) => (
                  <div key={cat.category_id ?? cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <IconBadge icon={cat.icon} color={cat.color} size="sm" />
                        <span className="font-semibold text-fg">{cat.name}</span>
                        <span className="text-fg-subtle">({cat.count} transaksi)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold tabular text-fg">{formatRupiah(cat.total)}</span>
                        <span className="ml-1.5 text-fg-subtle">{cat.percent}%</span>
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
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-fg">Transaksi Terbaru</h3>
              <Link to="/transactions" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Lihat Semua <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {recent_transactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-fg-muted">
                  Belum ada transaksi. Klik "Catat Transaksi" untuk memulai.
                </div>
              ) : (
                recent_transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <IconBadge
                        icon={tx.category?.icon || tx.account?.icon || 'circle-dot'}
                        color={tx.category?.color || tx.account?.color}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-fg truncate">
                          {tx.description || tx.category?.name || 'Transaksi'}
                        </p>
                        <p className="text-xs text-fg-subtle">
                          {tx.date} • {tx.account?.name ?? 'Akun'} {tx.counterparty ? `• ${tx.counterparty}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <p
                        className={`font-bold tabular text-sm ${
                          tx.flow === 'in' ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {tx.flow === 'in' ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </p>
                      {tx.type === 'transfer' && (
                        <Badge tone="transfer" className="mt-0.5">
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
        <div className="space-y-6">
          {/* Upcoming Bills */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="size-4 text-warning" />
                <h3 className="text-sm font-bold text-fg">Tagihan Mendatang</h3>
              </div>
              <Link to="/bills" className="text-xs font-semibold text-primary hover:underline">
                Kelola
              </Link>
            </div>

            <div className="mt-3 space-y-3">
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
                      className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-fg truncate">{bill.name}</p>
                        <p className="text-[11px] text-fg-subtle mt-0.5">
                          Jatuh tempo: {bill.next_due_date || '—'}
                        </p>
                        <p className="text-xs font-extrabold text-fg tabular mt-1">
                          {formatRupiah(bill.amount)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isOverdue ? 'danger' : 'secondary'}
                        className="h-8 text-xs shrink-0"
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
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Target className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-fg">Target Tabungan</h3>
              </div>
              <Link to="/goals" className="text-xs font-semibold text-primary hover:underline">
                Lihat Semua
              </Link>
            </div>

            <div className="mt-3 space-y-3.5">
              {goals.length === 0 ? (
                <div className="py-6 text-center text-xs text-fg-muted">
                  Belum ada target tabungan. Pasang impian finansial Anda sekarang.
                </div>
              ) : (
                goals.map((g) => (
                  <div key={g.id} className="space-y-1.5 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconBadge icon={g.icon} color={g.color} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-fg">{g.name}</p>
                          <p className="text-[11px] text-fg-subtle">
                            {formatRupiah(g.saved_amount)} / {formatRupiah(g.target_amount)}
                          </p>
                        </div>
                      </div>
                      <Badge tone="primary">{g.percent}%</Badge>
                    </div>
                    <Progress value={g.percent} tone="primary" />
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick Accounts list */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-fg">Rekening & Dompet</h3>
              <Link to="/accounts" className="text-xs font-semibold text-primary hover:underline">
                Detail
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <IconBadge icon={acc.icon} color={acc.color} size="sm" />
                    <span className="font-semibold text-fg">{acc.name}</span>
                  </div>
                  <span className="font-bold tabular text-fg">{formatRupiah(acc.balance)}</span>
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
