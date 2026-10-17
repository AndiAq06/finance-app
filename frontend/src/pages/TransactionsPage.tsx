import * as React from 'react'
import {
  PlusCircle, Filter, Search, Edit2, Trash2, ChevronLeft, ChevronRight,
  Download, Upload, Paperclip, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useTransactions, useAccounts, useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card, Badge, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { IconBadge } from '@/components/ui/icons'
import { ConfirmDialog } from '@/components/ui/dialog'
import { TransactionModal } from '@/components/modals/TransactionModal'
import { ImportCsvModal } from '@/components/modals/ImportCsvModal'
import type { Transaction } from '@/types'

export function TransactionsPage() {
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState('')
  const [type, setType] = React.useState<string>('')
  const [accountId, setAccountId] = React.useState<string>('')
  const [categoryId, setCategoryId] = React.useState<string>('')
  const [startDate, setStartDate] = React.useState<string>('')
  const [endDate, setEndDate] = React.useState<string>('')
  const [showFilters, setShowFilters] = React.useState(false)

  const [modalOpen, setModalOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [editItem, setEditItem] = React.useState<Transaction | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  const { data: accountsData } = useAccounts()
  const { data: categories = [] } = useCategories()

  const queryParams = React.useMemo(
    () => ({
      page,
      q: q || undefined,
      type: type || undefined,
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    [page, q, type, accountId, categoryId, startDate, endDate],
  )

  const { data, isLoading } = useTransactions(queryParams)

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/transactions/${id}`),
    {
      success: 'Transaksi berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const accounts = accountsData?.data ?? []
  const transactions = data?.data ?? []
  const meta = data?.meta
  const summary = data?.summary

  const handleExportCsv = async () => {
    try {
      setIsExporting(true)
      const blob = await api.download('/transactions/export/csv', {
        type: type || undefined,
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finora_transaksi_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Gagal mengunduh file CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Riwayat Transaksi</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Daftar seluruh aktivitas pemasukan, pengeluaran, dan mutasi saldo Anda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="primary"
            onClick={() => {
              setEditItem(null)
              setModalOpen(true)
            }}
            className="gap-1.5 justify-center h-10 w-full sm:w-auto shadow-sm"
          >
            <PlusCircle className="size-4" /> Catat Transaksi
          </Button>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              loading={isExporting}
              className="gap-1.5 justify-center h-9 text-xs"
              title="Ekspor CSV"
            >
              <Download className="size-3.5" /> Ekspor
            </Button>
            <Button
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="gap-1.5 justify-center h-9 text-xs"
              title="Impor CSV"
            >
              <Upload className="size-3.5" /> Impor
            </Button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards (Clean 3-col grid on mobile) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-2.5 sm:p-4">
          <span className="text-[10px] sm:text-xs font-bold text-fg-subtle uppercase truncate block">Pemasukan</span>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-xl font-bold tabular text-income truncate">
            +{formatRupiah(summary?.income ?? '0')}
          </p>
        </Card>
        <Card className="p-2.5 sm:p-4">
          <span className="text-[10px] sm:text-xs font-bold text-fg-subtle uppercase truncate block">Pengeluaran</span>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-xl font-bold tabular text-expense truncate">
            -{formatRupiah(summary?.expense ?? '0')}
          </p>
        </Card>
        <Card className="p-2.5 sm:p-4">
          <span className="text-[10px] sm:text-xs font-bold text-fg-subtle uppercase truncate block">Selisih (Net)</span>
          <p className={`mt-0.5 sm:mt-1 text-xs sm:text-xl font-bold tabular truncate ${Number(summary?.net ?? 0) >= 0 ? 'text-fg' : 'text-expense'}`}>
            {formatRupiah(summary?.net ?? '0', { sign: true })}
          </p>
        </Card>
      </div>

      {/* Filters Bar with Mobile Collapsible Panel */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="Cari transaksi / toko..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Button
            variant={[type, accountId, categoryId, startDate, endDate].filter(Boolean).length > 0 ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
            className="sm:hidden gap-1.5 h-9 shrink-0 text-xs px-2.5"
          >
            <Filter className="size-3.5" />
            <span>Filter {[type, accountId, categoryId, startDate, endDate].filter(Boolean).length > 0 ? `(${[type, accountId, categoryId, startDate, endDate].filter(Boolean).length})` : ''}</span>
            {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
        </div>

        <div className={cn('grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 pt-1 sm:pt-0', !showFilters && 'hidden sm:grid')}>
          {/* Type Filter */}
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            className="h-9 text-xs"
          >
            <option value="">Semua Tipe</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </Select>

          {/* Account Filter */}
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setPage(1)
            }}
            className="h-9 text-xs"
          >
            <option value="">Semua Rekening</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          {/* Category Filter */}
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(1)
            }}
            className="h-9 text-xs"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </Select>

          {/* Reset Filters */}
          {(q || type || accountId || categoryId || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setType('')
                setAccountId('')
                setCategoryId('')
                setStartDate('')
                setEndDate('')
                setPage(1)
              }}
              className="h-9 text-xs"
            >
              Reset Filter
            </Button>
          )}
        </div>
      </Card>

      {/* Transactions List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-fg-muted">
              <Filter className="size-6" />
            </div>
            <p className="font-bold text-fg">Tidak ada transaksi yang cocok</p>
            <p className="mt-1 text-xs text-fg-muted">
              Coba ganti filter pencarian atau tambahkan transaksi baru.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <IconBadge
                    icon={t.category?.icon || t.account?.icon || 'circle-dot'}
                    color={t.category?.color || t.account?.color}
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fg truncate">
                      {t.description || t.category?.name || 'Transaksi'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle mt-0.5">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span className="font-medium text-fg-muted">{t.account?.name ?? 'Akun'}</span>
                      {t.category && (
                        <>
                          <span>•</span>
                          <span>{t.category.name}</span>
                        </>
                      )}
                      {t.counterparty && (
                        <>
                          <span>•</span>
                          <span className="italic">{t.counterparty}</span>
                        </>
                      )}
                      {t.type === 'transfer' && (
                        <Badge tone="transfer" className="ml-1 text-[10px]">
                          {t.transfer ? `${t.transfer.from_account} → ${t.transfer.to_account}` : 'Transfer'}
                        </Badge>
                      )}
                      {t.has_attachment && t.attachment_url && (
                        <a
                          href={t.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline ml-1"
                          title={t.attachment_name || 'Lihat Struk'}
                        >
                          <Paperclip className="size-3" />
                          <span>Struk</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Amount & Actions */}
                <div className="flex items-center gap-4 shrink-0 pl-3">
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold tabular ${
                        t.flow === 'in' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {t.flow === 'in' ? '+' : '-'}
                      {formatRupiah(t.amount)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditItem(t)
                        setModalOpen(true)
                      }}
                      title="Edit"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      onClick={() => setDeleteId(t.id)}
                      title="Hapus"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-fg-muted">
            <span>
              Menampilkan Halaman {meta.current_page} dari {meta.last_page} ({meta.total} transaksi)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5" /> Sebelumnya
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Selanjutnya <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editItem={editItem}
      />

      <ImportCsvModal
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Transaksi?"
        description="Transaksi yang dihapus tidak dapat dipulihkan dan saldo rekening akan disesuaikan kembali."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
