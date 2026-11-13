import * as React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Search, PlusCircle, Download, Calendar,
  ChevronLeft, ChevronRight, Edit2, Trash2, ArrowUpRight,
  TrendingDown, Layers, HelpCircle,
} from 'lucide-react'
import { useCategories, useTransactions, useAccounts, useDashboard, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, monthKey, formatDate } from '@/lib/format'
import { Card, Badge, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { IconBadge } from '@/components/ui/icons'
import { ConfirmDialog } from '@/components/ui/dialog'
import { TransactionModal } from '@/components/modals/TransactionModal'
import type { Transaction } from '@/types'

export function CategoryExpensesPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const currentMonth = React.useMemo(() => monthKey(new Date()), [])
  const initialMonth = searchParams.get('month') || currentMonth

  // Local state for period filters
  const [period, setPeriod] = React.useState<'month' | 'year' | 'all' | 'custom'>(
    (searchParams.get('period') as any) || 'month'
  )
  const [selectedMonth, setSelectedMonth] = React.useState(initialMonth)
  const [startDate, setStartDate] = React.useState(searchParams.get('start_date') || '')
  const [endDate, setEndDate] = React.useState(searchParams.get('end_date') || '')
  const [accountId, setAccountId] = React.useState(searchParams.get('account_id') || '')
  const [q, setQ] = React.useState(searchParams.get('q') || '')
  const [debouncedQ, setDebouncedQ] = React.useState(q)
  const [page, setPage] = React.useState(1)

  // Modals state
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editItem, setEditItem] = React.useState<Transaction | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)
  const [isExporting, setIsExporting] = React.useState(false)

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q)
    }, 250)
    return () => clearTimeout(handler)
  }, [q])

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1)
  }, [id, period, selectedMonth, startDate, endDate, accountId, debouncedQ])

  // Queries
  const { data: categories = [] } = useCategories()
  const { data: accountsData } = useAccounts()
  const { data: dashboardData } = useDashboard({ month: selectedMonth })

  const accounts = accountsData?.data ?? []
  const expenseCategories = React.useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  )

  // Categories with stats from dashboard
  const dashboardCategories = dashboardData?.expense_by_category ?? []

  // Determine active category id
  const activeCategoryId = React.useMemo(() => {
    if (id) return id
    if (dashboardCategories.length > 0) {
      return dashboardCategories[0].category_id ? String(dashboardCategories[0].category_id) : 'uncategorized'
    }
    if (expenseCategories.length > 0) {
      return String(expenseCategories[0].id)
    }
    return 'uncategorized'
  }, [id, dashboardCategories, expenseCategories])

  // Find info about the active category
  const activeCategoryInfo = React.useMemo(() => {
    if (activeCategoryId === 'uncategorized' || activeCategoryId === 'null') {
      const dbCat = dashboardCategories.find((c) => c.category_id === null)
      return {
        id: 'uncategorized',
        name: dbCat?.name || 'Lainnya (Tanpa Kategori)',
        icon: dbCat?.icon || 'tag',
        color: dbCat?.color || '#94A3B8',
        isUncategorized: true,
      }
    }

    const found = categories.find((c) => String(c.id) === String(activeCategoryId))
    if (found) {
      return {
        id: String(found.id),
        name: found.name,
        icon: found.icon,
        color: found.color,
        isUncategorized: false,
      }
    }

    const dbCat = dashboardCategories.find((c) => String(c.category_id) === String(activeCategoryId))
    if (dbCat) {
      return {
        id: String(dbCat.category_id),
        name: dbCat.name,
        icon: dbCat.icon,
        color: dbCat.color,
        isUncategorized: false,
      }
    }

    return {
      id: activeCategoryId,
      name: 'Kategori Pengeluaran',
      icon: 'tag',
      color: '#64748B',
      isUncategorized: false,
    }
  }, [activeCategoryId, categories, dashboardCategories])

  // Compute date range based on selected period
  const queryDates = React.useMemo(() => {
    if (period === 'month') {
      return { month: selectedMonth }
    }
    if (period === 'year') {
      const year = selectedMonth.slice(0, 4)
      return { start_date: `${year}-01-01`, end_date: `${year}-12-31` }
    }
    if (period === 'custom') {
      return {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }
    }
    return {}
  }, [period, selectedMonth, startDate, endDate])

  // Fetch transactions for this specific category and period
  const queryParams = React.useMemo(
    () => ({
      page,
      type: 'expense',
      category_id: activeCategoryId,
      account_id: accountId || undefined,
      q: debouncedQ || undefined,
      ...queryDates,
    }),
    [page, activeCategoryId, accountId, debouncedQ, queryDates]
  )

  const { data: txData, isLoading: txLoading } = useTransactions(queryParams)

  const transactions = txData?.data ?? []
  const meta = txData?.meta
  const summary = txData?.summary

  // Delete transaction mutation
  const deleteMutation = useFinanceMutation(
    (txId: number) => api.del(`/transactions/${txId}`),
    {
      success: 'Transaksi berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    }
  )

  const handleExportCsv = async () => {
    try {
      setIsExporting(true)
      const blob = await api.download('/transactions/export/csv', {
        type: 'expense',
        category_id: activeCategoryId,
        account_id: accountId || undefined,
        ...queryDates,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finora_pengeluaran_${activeCategoryInfo.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Gagal mengekspor file CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  // Calculate average per transaction
  const totalExpenseNum = Number(summary?.expense ?? 0)
  const txCount = meta?.total ?? transactions.length
  const avgExpense = txCount > 0 ? totalExpenseNum / txCount : 0

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-primary transition mb-1 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Kembali ke Dashboard</span>
          </button>
          <div className="flex items-center gap-2.5">
            <IconBadge icon={activeCategoryInfo.icon} color={activeCategoryInfo.color} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-fg">
                  {activeCategoryInfo.name}
                </h1>
                <Badge tone="expense" className="text-[10px] font-semibold">
                  Pengeluaran
                </Badge>
              </div>
              <p className="text-xs text-fg-muted">
                Rincian transaksi pengeluaran pada kategori ini
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            loading={isExporting}
            className="gap-1.5 text-xs h-9"
          >
            <Download className="size-3.5" />
            <span>Ekspor</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditItem(null)
              setModalOpen(true)
            }}
            className="gap-1.5 text-xs h-9 shadow-sm"
          >
            <PlusCircle className="size-4" />
            <span>Catat Pengeluaran</span>
          </Button>
        </div>
      </div>

      {/* Category Tabs: List all categories for easy 1-click switching */}
      <Card className="p-3 overflow-hidden">
        <div className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle mb-2.5 px-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" />
            Pilih Kategori Pengeluaran
          </span>
          <span className="text-[11px] font-normal lowercase text-fg-subtle">
            (klik untuk melihat rincian kategori lain)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {/* Dashboard categories first if available, otherwise regular categories */}
          {dashboardCategories.map((c) => {
            const catKey = c.category_id ? String(c.category_id) : 'uncategorized'
            const isSelected = activeCategoryId === catKey
            return (
              <button
                key={catKey}
                onClick={() => {
                  navigate(`/categories/${catKey}`)
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'border-primary bg-primary-soft text-primary shadow-xs'
                    : 'border-border bg-surface hover:bg-surface-2 text-fg'
                }`}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.name}</span>
                <span className="text-[11px] font-bold opacity-75 tabular">
                  {formatRupiah(c.total)}
                </span>
                <span className="text-[10px] text-fg-subtle">({c.count})</span>
              </button>
            )
          })}

          {/* Any other user expense categories not in dashboard */}
          {expenseCategories
            .filter((ec) => !dashboardCategories.some((dc) => String(dc.category_id) === String(ec.id)))
            .map((ec) => {
              const catKey = String(ec.id)
              const isSelected = activeCategoryId === catKey
              return (
                <button
                  key={catKey}
                  onClick={() => {
                    navigate(`/categories/${catKey}`)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'border-primary bg-primary-soft text-primary shadow-xs'
                      : 'border-border bg-surface hover:bg-surface-2 text-fg'
                  }`}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: ec.color }}
                  />
                  <span>{ec.name}</span>
                </button>
              )
            })}
        </div>
      </Card>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Expense */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="font-bold uppercase tracking-wider text-[11px]">Total Pengeluaran</span>
            <span className="grid size-6 place-items-center rounded-lg bg-expense-soft text-expense">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg sm:text-2xl font-bold tabular tracking-tight text-expense truncate">
            -{formatRupiah(summary?.expense ?? '0')}
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            {period === 'month' ? `Periode ${selectedMonth}` : 'Sesuai filter tanggal'}
          </p>
        </Card>

        {/* Transaction Count */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="font-bold uppercase tracking-wider text-[11px]">Jumlah Transaksi</span>
            <span className="grid size-6 place-items-center rounded-lg bg-surface-2 text-fg-muted">
              <Calendar className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg sm:text-2xl font-bold tabular tracking-tight text-fg truncate">
            {meta?.total ?? transactions.length} <span className="text-xs font-medium text-fg-muted">kali</span>
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            Pengeluaran tercatat
          </p>
        </Card>

        {/* Average per Transaction */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="font-bold uppercase tracking-wider text-[11px]">Rata-rata Transaksi</span>
            <span className="grid size-6 place-items-center rounded-lg bg-primary-soft text-primary">
              <TrendingDown className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-lg sm:text-2xl font-bold tabular tracking-tight text-fg truncate">
            {formatRupiah(avgExpense)}
          </p>
          <p className="mt-1 text-[11px] text-fg-muted truncate">
            Per satu kali transaksi
          </p>
        </Card>

        {/* Category Share from Dashboard if available */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="font-bold uppercase tracking-wider text-[11px]">Porsi Pengeluaran</span>
            <span
              className="grid size-6 place-items-center rounded-lg text-white"
              style={{ backgroundColor: activeCategoryInfo.color }}
            >
              <span className="text-[10px] font-bold">%</span>
            </span>
          </div>
          {(() => {
            const dbMatch = dashboardCategories.find((c) =>
              activeCategoryInfo.isUncategorized
                ? c.category_id === null
                : String(c.category_id) === String(activeCategoryId)
            )
            const pct = dbMatch?.percent ?? (dashboardData?.month?.expense && Number(dashboardData.month.expense) > 0
              ? Math.round((totalExpenseNum / Number(dashboardData.month.expense)) * 1000) / 10
              : 0)
            return (
              <>
                <p className="mt-2 text-lg sm:text-2xl font-bold tabular tracking-tight text-fg truncate">
                  {pct}%
                </p>
                <p className="mt-1 text-[11px] text-fg-muted truncate">
                  Dari total pengeluaran bulan ini
                </p>
              </>
            )
          })()}
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder={`Cari pengeluaran di ${activeCategoryInfo.name}...`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Account Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">Semua Rekening</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Period Selector */}
          <div className="w-full sm:w-40">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="h-9 text-xs"
            >
              <option value="month">Bulan ({selectedMonth})</option>
              <option value="year">Tahun ({selectedMonth.slice(0, 4)})</option>
              <option value="all">Semua Waktu</option>
              <option value="custom">Pilih Rentang Tanggal</option>
            </Select>
          </div>

          {/* Month Picker if period is month */}
          {period === 'month' && (
            <div className="w-full sm:w-36">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 text-xs"
                title="Pilih Bulan"
              />
            </div>
          )}
        </div>

        {/* Custom Date Range Row if custom selected */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-fg-subtle uppercase">Mulai</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-fg-subtle uppercase">Sampai</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Transaction List */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-2/40">
          <div>
            <h2 className="text-sm font-bold text-fg">Daftar Pengeluaran</h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Menampilkan {transactions.length} dari {meta?.total ?? transactions.length} transaksi
            </p>
          </div>
          {txLoading && <Skeleton className="h-4 w-20" />}
        </div>

        {txLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-fg-muted mx-auto">
              <HelpCircle className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-fg">Tidak Ada Pengeluaran Ditemukan</h3>
            <p className="text-xs text-fg-muted max-w-sm mx-auto">
              {q || accountId || period !== 'all'
                ? 'Tidak ada transaksi pengeluaran yang cocok dengan filter yang dipilih. Coba sesuaikan kata kunci atau rentang tanggal.'
                : `Belum ada pengeluaran yang tercatat pada kategori ${activeCategoryInfo.name}.`}
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditItem(null)
                  setModalOpen(true)
                }}
                className="gap-1.5 text-xs"
              >
                <PlusCircle className="size-3.5" />
                Catat Pengeluaran Baru
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 hover:bg-surface-2/50 transition group"
              >
                {/* Left: Date + Description + Notes */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="grid size-9 place-items-center rounded-xl bg-expense-soft text-expense shrink-0">
                    <ArrowUpRight className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-fg truncate">
                        {tx.description || 'Pengeluaran'}
                      </span>
                      {tx.counterparty && (
                        <span className="text-[11px] text-fg-subtle bg-surface-2 px-1.5 py-0.5 rounded-md truncate">
                          @{tx.counterparty}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-fg-muted flex-wrap">
                      <span className="tabular">{formatDate(tx.date)}</span>
                      <span>•</span>
                      <span className="font-medium text-fg-subtle">
                        {tx.account?.name || 'Rekening'}
                      </span>
                      {tx.notes && (
                        <>
                          <span>•</span>
                          <span className="italic truncate max-w-xs">{tx.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount + Action Buttons */}
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <span className="font-bold tabular text-xs sm:text-base text-expense">
                      -{formatRupiah(tx.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => {
                        setEditItem(tx)
                        setModalOpen(true)
                      }}
                      className="grid size-7 place-items-center rounded-lg hover:bg-surface-2 text-fg-muted hover:text-fg transition cursor-pointer"
                      title="Edit Transaksi"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(tx.id)}
                      className="grid size-7 place-items-center rounded-lg hover:bg-expense-soft text-fg-muted hover:text-expense transition cursor-pointer"
                      title="Hapus Transaksi"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination footer */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-2/30 text-xs">
            <span className="text-fg-muted">
              Halaman <strong>{meta.current_page}</strong> dari <strong>{meta.last_page}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.current_page <= 1}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                <span>Sebelumnya</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page >= meta.last_page}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <span>Berikutnya</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Modal (for create or edit) */}
      {modalOpen && (
        <TransactionModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setEditItem(null)
          }}
          initialType="expense"
          editItem={editItem}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Hapus Transaksi Ini?"
        description="Apakah Anda yakin ingin menghapus transaksi pengeluaran ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Transaksi"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId)
        }}
      />
    </div>
  )
}
