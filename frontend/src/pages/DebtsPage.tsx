import * as React from 'react'
import {
  HandCoins, PlusCircle, Edit2, Trash2, CreditCard,
} from 'lucide-react'
import { useDebts, useAccounts, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, todayISO } from '@/lib/format'
import { Card, Badge, Progress, Skeleton, Segmented } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea, AmountInput } from '@/components/ui/input'
import type { Debt, DebtType } from '@/types'

export function DebtsPage() {
  const [activeTab, setActiveTab] = React.useState<DebtType>('receivable')
  const { data, isLoading } = useDebts({ type: activeTab })
  const { data: accountsData } = useAccounts()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editDebt, setEditDebt] = React.useState<Debt | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  // Payment modal
  const [payTarget, setPayTarget] = React.useState<Debt | null>(null)
  const [payAmount, setPayAmount] = React.useState('')
  const [payDate, setPayDate] = React.useState(todayISO())
  const [payAccountId, setPayAccountId] = React.useState('')
  const [payNote, setPayNote] = React.useState('')
  const createTx = true

  // Form states
  const [partyName, setPartyName] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState(todayISO())
  const [dueDate, setDueDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [accountId, setAccountId] = React.useState('')

  const accounts = accountsData?.data ?? []

  React.useEffect(() => {
    if (editDebt) {
      setActiveTab(editDebt.type)
      setPartyName(editDebt.party_name)
      setAmount(editDebt.amount)
      setDate(editDebt.date)
      setDueDate(editDebt.due_date || '')
      setNotes(editDebt.notes || '')
      setAccountId(editDebt.account_id ? String(editDebt.account_id) : '')
    } else {
      setPartyName('')
      setAmount('')
      setDate(todayISO())
      setDueDate('')
      setNotes('')
      setAccountId('')
    }
  }, [editDebt, modalOpen])

  React.useEffect(() => {
    if (payTarget) {
      setPayAmount(payTarget.remaining)
      setPayDate(todayISO())
      setPayNote('')
      setPayAccountId(accounts.length > 0 ? String(accounts[0].id) : '')
    }
  }, [payTarget, accounts])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        type: activeTab,
        party_name: partyName,
        amount: Number(amount),
        date,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        account_id: accountId ? Number(accountId) : undefined,
      }
      if (editDebt) {
        return api.put(`/debts/${editDebt.id}`, payload)
      }
      return api.post('/debts', payload)
    },
    {
      success: editDebt ? 'Catatan berhasil diperbarui' : 'Catatan hutang/piutang berhasil dibuat',
      onSuccess: () => setModalOpen(false),
    },
  )

  const payMutation = useFinanceMutation(
    async () => {
      if (!payTarget) return
      return api.post(`/debts/${payTarget.id}/pay`, {
        amount: Number(payAmount),
        date: payDate,
        account_id: payAccountId ? Number(payAccountId) : undefined,
        note: payNote || undefined,
        create_transaction: createTx,
      })
    },
    {
      success: 'Pembayaran berhasil dicatat',
      onSuccess: () => setPayTarget(null),
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/debts/${id}`),
    {
      success: 'Catatan berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const debts = data?.data ?? []
  const summary = data?.summary

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Hutang & Piutang</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Pantau uang yang Anda pinjamkan (piutang) maupun kewajiban pinjaman Anda (hutang).
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditDebt(null)
            setModalOpen(true)
          }}
          className="gap-1.5"
        >
          <PlusCircle className="size-4" /> Catat {activeTab === 'receivable' ? 'Piutang' : 'Hutang'} Baru
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-bold text-fg-subtle uppercase">Total Piutang (Hak Anda)</span>
          <p className="mt-1 text-2xl font-black tabular text-income">
            {formatRupiah(summary?.receivable_remaining ?? '0')}
          </p>
          <span className="text-xs text-fg-muted mt-0.5 block">{summary?.receivable_count ?? 0} orang berhutang</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-fg-subtle uppercase">Total Hutang (Kewajiban Anda)</span>
          <p className="mt-1 text-2xl font-black tabular text-expense">
            {formatRupiah(summary?.debt_remaining ?? '0')}
          </p>
          <span className="text-xs text-fg-muted mt-0.5 block">{summary?.debt_count ?? 0} kewajiban aktif</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-fg-subtle uppercase">Jatuh Tempo / Terlambat</span>
          <p className="mt-1 text-2xl font-black tabular text-warning">
            {summary?.overdue_count ?? 0}
          </p>
          <span className="text-xs text-fg-muted mt-0.5 block">Perlu segera diselesaikan</span>
        </Card>
      </div>

      {/* Segmented Switcher */}
      <div className="flex justify-center">
        <Segmented
          value={activeTab}
          onChange={(t) => setActiveTab(t)}
          options={[
            { value: 'receivable', label: 'Piutang (Uang Saya di Orang Lain)' },
            { value: 'debt', label: 'Hutang (Kewajiban Saya)' },
          ]}
        />
      </div>

      {/* Debts List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : debts.length === 0 ? (
        <Card className="p-12 text-center">
          <HandCoins className="mx-auto size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Tidak ada catatan {activeTab === 'receivable' ? 'piutang' : 'hutang'}</p>
          <p className="text-xs text-fg-muted mt-1">
            Klik tombol di atas untuk mencatat transaksi pinjaman baru.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {debts.map((d) => {
            const isPaid = d.status === 'paid'
            const percentPaid = Number(d.amount) > 0 ? Math.round((Number(d.paid_amount) / Number(d.amount)) * 100) : 0
            return (
              <Card key={d.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-fg">{d.party_name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle mt-0.5">
                        <span>Tanggal: {d.date}</span>
                        {d.due_date && (
                          <>
                            <span>•</span>
                            <span className={d.is_overdue ? 'text-expense font-bold' : ''}>
                              Jatuh tempo: {d.due_date} {d.is_overdue && '(Terlambat!)'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditDebt(d)
                          setModalOpen(true)
                        }}
                        title="Edit"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="danger-ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(d.id)}
                        title="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Amounts & Progress */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-fg-muted">
                        Total Pokok: <strong className="text-fg tabular">{formatRupiah(d.amount)}</strong>
                      </span>
                      <span className="text-fg-muted">
                        Telah Dibayar: <strong className="text-income tabular">{formatRupiah(d.paid_amount)}</strong>
                      </span>
                    </div>

                    <Progress
                      value={percentPaid}
                      tone={isPaid ? 'primary' : 'warning'}
                      className="h-2"
                    />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg-subtle">Sisa yang harus dilunasi:</span>
                      <span className="font-extrabold tabular text-fg">{formatRupiah(d.remaining)}</span>
                    </div>
                  </div>

                  {d.notes && (
                    <p className="mt-3 text-xs text-fg-muted italic bg-surface-2 p-2 rounded-lg">
                      "{d.notes}"
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Badge
                    tone={
                      isPaid
                        ? 'income'
                        : d.status === 'partial'
                        ? 'warning'
                        : d.is_overdue
                        ? 'expense'
                        : 'neutral'
                    }
                  >
                    {isPaid ? 'Lunas' : d.status === 'partial' ? 'Cicilan' : d.is_overdue ? 'Jatuh Tempo' : 'Belum Lunas'}
                  </Badge>

                  {!isPaid && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-8 text-xs gap-1"
                      onClick={() => setPayTarget(d)}
                    >
                      <CreditCard className="size-3.5" /> Catat Bayar / Cicil
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Add/Edit Debt */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editDebt ? 'Edit Catatan' : `Catat ${activeTab === 'receivable' ? 'Piutang' : 'Hutang'} Baru`}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!partyName.trim() || Number(amount) <= 0}
                onClick={() => saveMutation.mutate(undefined)}
              >
                Simpan
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field
              label={activeTab === 'receivable' ? 'Nama Peminjam (Pihak yang Berhutang)' : 'Nama Pemberi Pinjaman'}
              required
            >
              <Input
                placeholder="mis. Budi Santoso, Toko Makmur, Bank BCA"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Nominal Pinjaman" required>
              <AmountInput
                large
                value={amount}
                onValueChange={setAmount}
                placeholder="0"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Transaksi Pinjam" required>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>

              <Field label="Batas Tanggal Pelunasan (Opsional)">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Keterangan / Perjanjian (Opsional)">
              <Textarea
                placeholder="Catatan mengenai bunga, tujuan pinjaman, dll..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Payment */}
      <Dialog open={payTarget !== null} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent
          title={`Catat Pembayaran: ${payTarget?.party_name}`}
          size="sm"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayTarget(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={payMutation.isPending}
                disabled={Number(payAmount) <= 0}
                onClick={() => payMutation.mutate(undefined)}
              >
                Simpan Pembayaran
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Nominal Pembayaran" required>
              <AmountInput
                large
                value={payAmount}
                onValueChange={setPayAmount}
                placeholder="0"
                autoFocus
              />
            </Field>

            <Field label="Tanggal Pembayaran" required>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>

            <Field label="Rekening Kas Terkait">
              <Select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
                <option value="">Tanpa perubahan saldo rekening</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Catatan (Opsional)">
              <Input
                placeholder="mis. Cicilan 1 via Transfer BCA"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Catatan Pinjaman?"
        description="Data pinjaman ini beserta seluruh riwayat pembayarannya akan dihapus."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
