import * as React from 'react'
import {
  PieChart, PlusCircle, ChevronLeft, ChevronRight, Edit2, Trash2,
} from 'lucide-react'
import { useBudgets, useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, formatMonth, monthKey } from '@/lib/format'
import { Card, Badge, Progress, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Select, AmountInput } from '@/components/ui/input'
import { IconBadge } from '@/components/ui/icons'
import type { BudgetRow } from '@/types'

export function BudgetsPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const month = React.useMemo(() => monthKey(currentDate), [currentDate])

  const { data, isLoading } = useBudgets(month)
  const { data: categories = [] } = useCategories()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editItem, setEditItem] = React.useState<BudgetRow | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  // Form states
  const [categoryId, setCategoryId] = React.useState<string>('')
  const [amount, setAmount] = React.useState('')

  React.useEffect(() => {
    if (editItem) {
      setCategoryId(editItem.category_id ? String(editItem.category_id) : '')
      setAmount(editItem.amount)
    } else {
      setCategoryId('')
      setAmount('')
    }
  }, [editItem, modalOpen])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        month,
        category_id: categoryId ? Number(categoryId) : null,
        amount: Number(amount),
        is_recurring: true,
      }
      return api.post('/budgets', payload)
    },
    {
      success: 'Anggaran berhasil disimpan',
      onSuccess: () => setModalOpen(false),
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/budgets/${id}`),
    {
      success: 'Anggaran berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const prevMonth = () => {
    setCurrentDate((d) => {
      const copy = new Date(d)
      copy.setMonth(copy.getMonth() - 1)
      return copy
    })
  }

  const nextMonth = () => {
    setCurrentDate((d) => {
      const copy = new Date(d)
      copy.setMonth(copy.getMonth() + 1)
      return copy
    })
  }

  const totals = data?.totals
  const categoryBudgets = data?.categories ?? []
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return (
    <div className="space-y-6">
      {/* Top Header & Month Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Anggaran Bulanan</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Kendalikan pengeluaran Anda dengan menetapkan batas belanja per kategori.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Controls */}
          <div className="flex items-center rounded-xl border border-border bg-surface p-1">
            <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Bulan sebelumnya">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-3 text-xs font-bold text-fg tabular min-w-[110px] text-center">
              {formatMonth(month)}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Bulan berikutnya">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setEditItem(null)
              setModalOpen(true)
            }}
            className="gap-1.5"
          >
            <PlusCircle className="size-4" /> Pasang Anggaran
          </Button>
        </div>
      </div>

      {/* Overall Budget Overview Card */}
      {isLoading ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <Card className="p-6 bg-gradient-to-br from-surface to-surface-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                Total Anggaran {formatMonth(month)}
              </span>
              <p className="mt-1 text-3xl font-black tabular tracking-tight text-fg">
                {formatRupiah(totals?.budgeted ?? '0')}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                Pengeluaran aktual bulan ini: <strong className="text-fg">{formatRupiah(totals?.month_expense ?? '0')}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-fg-subtle">Sisa Anggaran</span>
              <p
                className={`text-2xl font-black tabular mt-0.5 ${
                  Number(totals?.remaining ?? 0) < 0 ? 'text-expense' : 'text-income'
                }`}
              >
                {formatRupiah(totals?.remaining ?? '0')}
              </p>
              <Badge
                tone={
                  (totals?.percent ?? 0) > 100
                    ? 'expense'
                    : (totals?.percent ?? 0) >= 80
                    ? 'warning'
                    : 'primary'
                }
                className="mt-1"
              >
                {totals?.percent ?? 0}% Terpakai
              </Badge>
            </div>
          </div>

          <div className="mt-5">
            <Progress
              value={totals?.percent ?? 0}
              tone={
                (totals?.percent ?? 0) > 100
                  ? 'expense'
                  : (totals?.percent ?? 0) >= 80
                  ? 'warning'
                  : 'primary'
              }
              className="h-2.5"
            />
          </div>
        </Card>
      )}

      {/* Categories Budget List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-fg">Anggaran per Kategori</h2>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : categoryBudgets.length === 0 ? (
          <Card className="p-12 text-center">
            <PieChart className="mx-auto size-12 text-fg-muted mb-3" />
            <p className="font-bold text-fg">Belum ada anggaran kategori untuk bulan ini</p>
            <p className="text-xs text-fg-muted mt-1">
              Pasang limit belanja untuk makanan, transportasi, hiburan, dan pos pengeluaran lainnya.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditItem(null)
                setModalOpen(true)
              }}
              className="mt-4"
            >
              Pasang Anggaran Pertama
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryBudgets.map((row) => {
              const isOver = row.level === 'over'
              const isDanger = row.level === 'danger'
              const isWarning = row.level === 'warning'
              const tone = isOver ? 'expense' : isDanger ? 'expense' : isWarning ? 'warning' : 'primary'

              return (
                <Card key={row.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <IconBadge
                          icon={row.category?.icon || 'tag'}
                          color={row.category?.color || '#16A34A'}
                          size="md"
                        />
                        <div>
                          <h3 className="font-bold text-sm text-fg leading-tight">
                            {row.category?.name || 'Kategori'}
                          </h3>
                          <Badge tone={tone} className="mt-1 text-[10px]">
                            {isOver ? 'Melebihi Limit!' : `${row.percent}% terpakai`}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditItem(row)
                            setModalOpen(true)
                          }}
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="icon-sm"
                          onClick={() => setDeleteId(row.id)}
                          title="Hapus"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-fg-muted">
                        Terpakai: <strong className="text-fg tabular">{formatRupiah(row.spent)}</strong>
                      </span>
                      <span className="text-fg-muted">
                        Batas: <strong className="text-fg tabular">{formatRupiah(row.amount)}</strong>
                      </span>
                    </div>

                    <div className="mt-2">
                      <Progress value={row.percent} tone={tone} className="h-2" />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-fg-subtle">
                      {isOver ? 'Kelebihan pengeluaran:' : 'Sisa kuota belanja:'}
                    </span>
                    <span className={`font-bold tabular ${isOver ? 'text-expense' : 'text-fg'}`}>
                      {formatRupiah(Math.abs(Number(row.remaining)))}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Add / Edit Budget */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editItem ? 'Edit Anggaran Kategori' : 'Pasang Anggaran Kategori'}
          size="sm"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={Number(amount) <= 0}
                onClick={() => saveMutation.mutate(undefined)}
              >
                Simpan
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Pilih Kategori Pengeluaran">
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={!!editItem}
              >
                <option value="">Semua Kategori (Batas Keseluruhan)</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Batas Anggaran Bulanan" required>
              <AmountInput
                value={amount}
                onValueChange={setAmount}
                placeholder="0"
                autoFocus
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Budget */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Anggaran?"
        description="Batas anggaran ini akan dihapus dari bulan yang sedang dipilih."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
