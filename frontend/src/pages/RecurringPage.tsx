import * as React from 'react'
import {
  Repeat, PlusCircle, Play, Edit2, Trash2,
} from 'lucide-react'
import { useRecurring, useAccounts, useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, todayISO } from '@/lib/format'
import { Card, Badge, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, AmountInput } from '@/components/ui/input'
import { IconBadge } from '@/components/ui/icons'
import type { Recurring } from '@/types'

export function RecurringPage() {
  const { data: recurrings = [], isLoading } = useRecurring()
  const { data: accountsData } = useAccounts()
  const { data: categories = [] } = useCategories()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editItem, setEditItem] = React.useState<Recurring | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  // Form states
  const [type, setType] = React.useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = React.useState('')
  const [accountId, setAccountId] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [frequency, setFrequency] = React.useState('monthly')
  const [interval, setInterval] = React.useState('1')
  const [startDate, setStartDate] = React.useState(todayISO())
  const [endDate, setEndDate] = React.useState('')

  const accounts = accountsData?.data ?? []

  React.useEffect(() => {
    if (editItem) {
      setType(editItem.type)
      setAmount(editItem.amount)
      setAccountId(String(editItem.account_id))
      setCategoryId(String(editItem.category_id))
      setDescription(editItem.description)
      setFrequency(editItem.frequency)
      setInterval(String(editItem.interval || 1))
      setStartDate(editItem.start_date)
      setEndDate(editItem.end_date || '')
    } else {
      setType('expense')
      setAmount('')
      setAccountId(accounts[0] ? String(accounts[0].id) : '')
      const firstCat = categories.find((c) => c.type === 'expense')
      setCategoryId(firstCat ? String(firstCat.id) : '')
      setDescription('')
      setFrequency('monthly')
      setInterval('1')
      setStartDate(todayISO())
      setEndDate('')
    }
  }, [editItem, modalOpen, accounts, categories])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        type,
        amount: Number(amount),
        account_id: Number(accountId),
        category_id: Number(categoryId),
        description,
        frequency,
        interval: Number(interval),
        start_date: startDate,
        end_date: endDate || undefined,
      }
      if (editItem) {
        return api.put(`/recurring/${editItem.id}`, payload)
      }
      return api.post('/recurring', payload)
    },
    {
      success: editItem ? 'Jadwal transaksi rutin diperbarui' : 'Jadwal transaksi rutin berhasil dibuat',
      onSuccess: () => setModalOpen(false),
    },
  )

  const runPendingMutation = useFinanceMutation(
    () => api.post('/recurring/run-pending'),
    {
      success: 'Pengecekan transaksi rutin selesai diproses',
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/recurring/${id}`),
    {
      success: 'Jadwal transaksi rutin berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const filteredCategories = categories.filter((c) => c.type === type)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Transaksi Terjadwal & Rutin</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Otomatisasi pencatatan gaji berkala, uang sewa bulanan, dan pengeluaran tetap.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => runPendingMutation.mutate(undefined)}
            loading={runPendingMutation.isPending}
            className="gap-1.5"
          >
            <Play className="size-3.5" /> Jalankan Sekarang
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setEditItem(null)
              setModalOpen(true)
            }}
            className="gap-1.5"
          >
            <PlusCircle className="size-4" /> Tambah Jadwal Rutin
          </Button>
        </div>
      </div>

      {/* Recurrings List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : recurrings.length === 0 ? (
        <Card className="p-12 text-center">
          <Repeat className="mx-auto size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Belum ada transaksi terjadwal</p>
          <p className="text-xs text-fg-muted mt-1">
            Buat jadwal untuk gaji bulanan atau sewa kamar agar otomatis tercatat tanpa perlu input manual.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recurrings.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <IconBadge
                      icon={r.category?.icon || 'repeat'}
                      color={r.category?.color || (r.type === 'income' ? '#16A34A' : '#E11D48')}
                      size="md"
                    />
                    <div>
                      <h3 className="font-bold text-base text-fg leading-tight">{r.description}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge tone={r.type === 'income' ? 'income' : 'expense'}>
                          {r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </Badge>
                        <Badge tone="neutral" className="uppercase text-[10px]">
                          Setiap {r.interval > 1 ? `${r.interval} ` : ''}{r.frequency}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditItem(r)
                        setModalOpen(true)
                      }}
                      title="Edit"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      onClick={() => setDeleteId(r.id)}
                      title="Hapus"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-semibold text-fg-subtle">Nominal Terjadwal</span>
                  <p
                    className={`text-2xl font-black tabular tracking-tight mt-0.5 ${
                      r.type === 'income' ? 'text-income' : 'text-expense'
                    }`}
                  >
                    {r.type === 'income' ? '+' : '-'}
                    {formatRupiah(r.amount)}
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-fg-muted">
                  <p>
                    Rekening tujuan: <strong className="text-fg">{r.account?.name ?? 'Akun'}</strong>
                  </p>
                  <p>
                    Jadwal berikutnya: <strong className="text-fg tabular">{r.next_run_date || 'Selesai'}</strong>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-fg-subtle">
                <span>Telah berjalan {r.generated_count} kali</span>
                <span className={r.is_active ? 'text-primary font-bold' : 'text-fg-subtle'}>
                  {r.is_active ? 'Status Aktif' : 'Nonaktif'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Recurring */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editItem ? 'Edit Transaksi Rutin' : 'Tambah Transaksi Rutin'}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!description.trim() || Number(amount) <= 0}
                onClick={() => saveMutation.mutate(undefined)}
              >
                Simpan
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis Arus Kas" required>
                <Select value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
                  <option value="expense">Pengeluaran Rutin</option>
                  <option value="income">Pemasukan Rutin</option>
                </Select>
              </Field>

              <Field label="Nominal Uang" required>
                <AmountInput value={amount} onValueChange={setAmount} placeholder="0" />
              </Field>
            </div>

            <Field label="Deskripsi Transaksi" required>
              <Input
                placeholder="mis. Gaji Bulanan Kantor, Sewa Kost Bulanan"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rekening Terkait" required>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Kategori" required>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Frekuensi">
                <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </Select>
              </Field>

              <Field label="Setiap Interval">
                <Input type="number" min="1" value={interval} onChange={(e) => setInterval(e.target.value)} />
              </Field>

              <Field label="Mulai Tanggal" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Jadwal Transaksi Rutin?"
        description="Jadwal transaksi rutin ini akan dihentikan."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
