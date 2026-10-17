import * as React from 'react'
import {
  CalendarClock, PlusCircle, Edit2, Trash2, CreditCard,
} from 'lucide-react'
import { useBills, useAccounts, useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, todayISO } from '@/lib/format'
import { Card, Badge, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea, AmountInput } from '@/components/ui/input'
import { IconBadge } from '@/components/ui/icons'
import type { Bill, Frequency } from '@/types'

export function BillsPage() {
  const { data: bills = [], isLoading } = useBills()
  const { data: accountsData } = useAccounts()
  const { data: categories = [] } = useCategories()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editBill, setEditBill] = React.useState<Bill | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  // Pay modal
  const [payBill, setPayBill] = React.useState<Bill | null>(null)
  const [payAccountId, setPayAccountId] = React.useState('')
  const [payDate, setPayDate] = React.useState(todayISO())

  // Form states
  const [name, setName] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [accountId, setAccountId] = React.useState('')
  const [nextDueDate, setNextDueDate] = React.useState('')
  const [frequency, setFrequency] = React.useState<Exclude<Frequency, 'daily'>>('monthly')
  const [reminderDays, setReminderDays] = React.useState('3')
  const [notes, setNotes] = React.useState('')

  const accounts = accountsData?.data ?? []
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  React.useEffect(() => {
    if (editBill) {
      setName(editBill.name)
      setAmount(editBill.amount)
      setCategoryId(editBill.category_id ? String(editBill.category_id) : '')
      setAccountId(editBill.account_id ? String(editBill.account_id) : '')
      setNextDueDate(editBill.next_due_date || '')
      setFrequency(editBill.frequency)
      setReminderDays(String(editBill.reminder_days || 3))
      setNotes(editBill.notes || '')
    } else {
      setName('')
      setAmount('')
      setCategoryId('')
      setAccountId('')
      setNextDueDate('')
      setFrequency('monthly')
      setReminderDays('3')
      setNotes('')
    }
  }, [editBill, modalOpen])

  React.useEffect(() => {
    if (payBill) {
      setPayAccountId(payBill.account_id ? String(payBill.account_id) : (accounts[0] ? String(accounts[0].id) : ''))
      setPayDate(todayISO())
    }
  }, [payBill, accounts])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        name,
        amount: Number(amount),
        category_id: categoryId ? Number(categoryId) : undefined,
        account_id: accountId ? Number(accountId) : undefined,
        next_due_date: nextDueDate || undefined,
        frequency,
        reminder_days: Number(reminderDays),
        notes: notes || undefined,
      }
      if (editBill) {
        return api.put(`/bills/${editBill.id}`, payload)
      }
      return api.post('/bills', payload)
    },
    {
      success: editBill ? 'Tagihan berhasil diperbarui' : 'Tagihan baru berhasil dibuat',
      onSuccess: () => setModalOpen(false),
    },
  )

  const payMutation = useFinanceMutation(
    async () => {
      if (!payBill) return
      return api.post(`/bills/${payBill.id}/pay`, {
        paid_date: payDate,
        account_id: payAccountId ? Number(payAccountId) : undefined,
        create_transaction: true,
      })
    },
    {
      success: 'Tagihan berhasil dibayar & tercatat di transaksi',
      onSuccess: () => setPayBill(null),
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/bills/${id}`),
    {
      success: 'Tagihan berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const totalMonthlyBills = bills.reduce((acc, b) => acc + Number(b.amount), 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Tagihan Rutin (Bills)</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Daftar kewajiban berkala seperti listrik, internet, sewa kost, asuransi, dan langganan.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditBill(null)
            setModalOpen(true)
          }}
          className="gap-1.5"
        >
          <PlusCircle className="size-4" /> Tambah Tagihan
        </Button>
      </div>

      {/* Overview Card */}
      <Card className="p-6 bg-gradient-to-br from-surface to-surface-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
              Total Kewajiban Tagihan Rutin
            </span>
            <p className="mt-1 text-3xl font-black tabular tracking-tight text-fg">
              {formatRupiah(totalMonthlyBills)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {bills.length} tagihan terdaftar dalam jadwal
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="warning" className="text-xs px-3 py-1">
              {bills.filter((b) => b.status === 'overdue').length} Perlu Segera Dibayar
            </Badge>
          </div>
        </div>
      </Card>

      {/* Bills Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : bills.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarClock className="mx-auto size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Belum ada tagihan rutin</p>
          <p className="text-xs text-fg-muted mt-1">
            Tambahkan tagihan listrik, internet, atau langganan agar Anda selalu diingatkan tepat waktu.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditBill(null)
              setModalOpen(true)
            }}
            className="mt-4"
          >
            Tambah Tagihan Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bills.map((b) => {
            const isOverdue = b.status === 'overdue'
            return (
              <Card key={b.id} className="p-5 flex flex-col justify-between transition-all hover:border-border-strong">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <IconBadge icon={b.category?.icon || 'receipt'} color={b.category?.color || '#F59E0B'} size="md" />
                      <div>
                        <h3 className="font-bold text-base text-fg leading-tight">{b.name}</h3>
                        <Badge tone="neutral" className="mt-1 text-[10px] uppercase">
                          {b.frequency}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditBill(b)
                          setModalOpen(true)
                        }}
                        title="Edit"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="danger-ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(b.id)}
                        title="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-fg-subtle">Nominal Tagihan</span>
                    <p className="text-2xl font-black tabular tracking-tight text-fg mt-0.5">
                      {formatRupiah(b.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-fg-muted">Jatuh Tempo:</span>
                    <span className={`font-bold tabular ${isOverdue ? 'text-expense' : 'text-fg'}`}>
                      {b.next_due_date || '—'} {isOverdue && '(Terlambat)'}
                    </span>
                  </div>

                  {b.notes && (
                    <p className="mt-2 text-xs text-fg-muted italic bg-surface-2 p-2 rounded-lg truncate">
                      {b.notes}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <Badge tone={isOverdue ? 'expense' : 'warning'}>
                    {isOverdue ? 'Jatuh Tempo' : b.days_until_due !== null ? `${b.days_until_due} hari lagi` : 'Aktif'}
                  </Badge>

                  <Button
                    size="sm"
                    variant={isOverdue ? 'danger' : 'primary'}
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setPayBill(b)}
                  >
                    <CreditCard className="size-3.5" /> Bayar Sekarang
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Add / Edit Bill */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editBill ? 'Edit Tagihan' : 'Tambah Tagihan Baru'}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!name.trim() || Number(amount) <= 0}
                onClick={() => saveMutation.mutate(undefined)}
              >
                Simpan Tagihan
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Nama Tagihan / Layanan" required>
              <Input
                placeholder="mis. Listrik PLN, WiFi Indihome, BPJS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nominal Tagihan" required>
                <AmountInput
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="0"
                />
              </Field>

              <Field label="Siklus Berulang">
                <Select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Exclude<Frequency, 'daily'>)}
                >
                  <option value="monthly">Bulanan</option>
                  <option value="weekly">Mingguan</option>
                  <option value="yearly">Tahunan</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Jatuh Tempo Berikutnya">
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </Field>

              <Field label="Kategori Pengeluaran">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Pilih Kategori</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default Rekening Pembayaran">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Pilih Rekening</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Ingatkan Berapa Hari Sebelumnya">
                <Select value={reminderDays} onChange={(e) => setReminderDays(e.target.value)}>
                  <option value="1">1 Hari Sebelumnya</option>
                  <option value="3">3 Hari Sebelumnya</option>
                  <option value="5">5 Hari Sebelumnya</option>
                  <option value="7">7 Hari Sebelumnya</option>
                </Select>
              </Field>
            </div>

            <Field label="Catatan / Nomor Pelanggan (Opsional)">
              <Textarea
                placeholder="mis. No. Pelanggan PLN / Akun Biznet..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Pay Bill */}
      <Dialog open={payBill !== null} onOpenChange={(o) => !o && setPayBill(null)}>
        <DialogContent
          title={`Bayar Tagihan: ${payBill?.name}`}
          size="sm"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayBill(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={payMutation.isPending}
                onClick={() => payMutation.mutate(undefined)}
              >
                Konfirmasi Pembayaran
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <div className="rounded-xl bg-surface-2 p-3 text-center">
              <span className="text-xs text-fg-subtle">Total yang akan dibayar</span>
              <p className="text-2xl font-black text-fg tabular mt-0.5">
                {formatRupiah(payBill?.amount)}
              </p>
            </div>

            <Field label="Tanggal Pembayaran" required>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>

            <Field label="Bayar Menggunakan Rekening" required>
              <Select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Tagihan Rutin?"
        description="Jadwal tagihan ini akan dihentikan."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
