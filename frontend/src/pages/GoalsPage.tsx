import * as React from 'react'
import {
  Target, PlusCircle, Edit2, Trash2, CheckCircle2, Clock,
} from 'lucide-react'
import { useGoals, useAccounts, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, todayISO } from '@/lib/format'
import { Card, Badge, Progress, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea, AmountInput } from '@/components/ui/input'
import { IconBadge, IconPicker, ColorPicker } from '@/components/ui/icons'
import type { SavingsGoal } from '@/types'

export function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals()
  const { data: accountsData } = useAccounts()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editGoal, setEditGoal] = React.useState<SavingsGoal | null>(null)
  const [deleteId, setDeleteId] = React.useState<number | null>(null)

  // Contribute modal
  const [contributeGoal, setContributeGoal] = React.useState<SavingsGoal | null>(null)
  const [contribType, setContribType] = React.useState<'deposit' | 'withdrawal'>('deposit')
  const [contribAmount, setContribAmount] = React.useState('')
  const [contribDate, setContribDate] = React.useState(todayISO())
  const [contribNote, setContribNote] = React.useState('')

  // Goal form states
  const [name, setName] = React.useState('')
  const [targetAmount, setTargetAmount] = React.useState('')
  const [deadline, setDeadline] = React.useState('')
  const [icon, setIcon] = React.useState('target')
  const [color, setColor] = React.useState('#16A34A')
  const [priority, setPriority] = React.useState('1')
  const [accountId, setAccountId] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const accounts = accountsData?.data ?? []

  React.useEffect(() => {
    if (editGoal) {
      setName(editGoal.name)
      setTargetAmount(editGoal.target_amount)
      setDeadline(editGoal.deadline || '')
      setIcon(editGoal.icon || 'target')
      setColor(editGoal.color || '#16A34A')
      setPriority(String(editGoal.priority || 1))
      setAccountId(editGoal.account_id ? String(editGoal.account_id) : '')
      setNotes(editGoal.notes || '')
    } else {
      setName('')
      setTargetAmount('')
      setDeadline('')
      setIcon('target')
      setColor('#16A34A')
      setPriority('1')
      setAccountId('')
      setNotes('')
    }
  }, [editGoal, modalOpen])

  const saveGoalMutation = useFinanceMutation(
    async () => {
      const payload = {
        name,
        target_amount: Number(targetAmount),
        deadline: deadline || undefined,
        icon,
        color,
        priority: Number(priority),
        account_id: accountId ? Number(accountId) : undefined,
        notes: notes || undefined,
      }
      if (editGoal) {
        return api.put(`/goals/${editGoal.id}`, payload)
      }
      return api.post('/goals', payload)
    },
    {
      success: editGoal ? 'Target tabungan diperbarui' : 'Target tabungan baru berhasil dibuat',
      onSuccess: () => setModalOpen(false),
    },
  )

  const contributeMutation = useFinanceMutation(
    async () => {
      if (!contributeGoal) return
      return api.post(`/goals/${contributeGoal.id}/contribute`, {
        type: contribType,
        amount: Number(contribAmount),
        date: contribDate,
        note: contribNote || undefined,
      })
    },
    {
      success: contribType === 'deposit' ? 'Setoran tabungan berhasil dicatat' : 'Penarikan tabungan berhasil dicatat',
      onSuccess: () => {
        setContributeGoal(null)
        setContribAmount('')
        setContribNote('')
      },
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/goals/${id}`),
    {
      success: 'Target tabungan berhasil dihapus',
      onSuccess: () => setDeleteId(null),
    },
  )

  const totalTarget = goals.reduce((acc, g) => acc + Number(g.target_amount), 0)
  const totalSaved = goals.reduce((acc, g) => acc + Number(g.saved_amount), 0)
  const totalPercent = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Target Tabungan (Goals)</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Rencanakan dan kumpulkan dana untuk impian, liburan, dan dana darurat Anda.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditGoal(null)
            setModalOpen(true)
          }}
          className="gap-1.5"
        >
          <PlusCircle className="size-4" /> Buat Target Baru
        </Button>
      </div>

      {/* Overview Progress Card */}
      <Card className="p-6 bg-gradient-to-br from-surface to-surface-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
              Total Dana Impian Terkumpul
            </span>
            <p className="mt-1 text-3xl font-black tabular tracking-tight text-fg">
              {formatRupiah(totalSaved)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Dari sasaran total <strong className="text-fg">{formatRupiah(totalTarget)}</strong> across {goals.length} target
            </p>
          </div>

          <div className="text-right">
            <Badge tone="primary" className="text-sm px-3 py-1 font-bold">
              {totalPercent}% Tercapai
            </Badge>
          </div>
        </div>

        <div className="mt-5">
          <Progress value={totalPercent} tone="primary" className="h-2.5" />
        </div>
      </Card>

      {/* Goals Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : goals.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="mx-auto size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Belum ada target tabungan</p>
          <p className="text-xs text-fg-muted mt-1">
            Mulailah dengan menetapkan target dana darurat, liburan, atau pembelian gadget impian.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditGoal(null)
              setModalOpen(true)
            }}
            className="mt-4"
          >
            Buat Target Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const isAchieved = g.status === 'achieved' || g.percent >= 100
            return (
              <Card
                key={g.id}
                className="p-5 flex flex-col justify-between transition-all hover:border-border-strong relative"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <IconBadge icon={g.icon} color={g.color} size="md" />
                      <div>
                        <h3 className="font-bold text-base text-fg leading-tight">{g.name}</h3>
                        {g.deadline && (
                          <div className="flex items-center gap-1 text-[11px] text-fg-subtle mt-0.5">
                            <Clock className="size-3" /> Target: {g.deadline}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditGoal(g)
                          setModalOpen(true)
                        }}
                        title="Edit Target"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="danger-ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(g.id)}
                        title="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="mt-5 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black tabular tracking-tight text-fg">
                        {formatRupiah(g.saved_amount)}
                      </span>
                      <span className="text-xs text-fg-subtle font-medium">
                        dari {formatRupiah(g.target_amount)}
                      </span>
                    </div>

                    <div className="mt-2">
                      <Progress value={g.percent} tone={isAchieved ? 'primary' : 'primary'} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-fg-muted mt-1">
                      <span>{g.percent}% Terkumpul</span>
                      <span>Sisa: {formatRupiah(g.remaining)}</span>
                    </div>
                  </div>

                  {/* Periodic suggestions */}
                  {g.required_per_month && (
                    <div className="mt-3 rounded-lg bg-surface-2 p-2 text-center text-xs text-fg-muted">
                      Menabung <strong className="text-fg">{formatRupiah(g.required_per_month)}</strong> / bulan untuk capai target
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                  {isAchieved ? (
                    <Badge tone="primary" className="gap-1 py-1 px-2.5">
                      <CheckCircle2 className="size-3.5" /> Target Tercapai!
                    </Badge>
                  ) : (
                    <span className="text-xs text-fg-subtle">Prioritas #{g.priority}</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => {
                        setContributeGoal(g)
                        setContribType('withdrawal')
                        setContribAmount('')
                      }}
                    >
                      Tarik
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-8 text-xs"
                      onClick={() => {
                        setContributeGoal(g)
                        setContribType('deposit')
                        setContribAmount('')
                      }}
                    >
                      + Setor
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Add / Edit Goal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editGoal ? 'Edit Target Tabungan' : 'Buat Target Tabungan'}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveGoalMutation.isPending}
                disabled={!name.trim() || Number(targetAmount) <= 0}
                onClick={() => saveGoalMutation.mutate(undefined)}
              >
                Simpan Target
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Nama Target Tabungan" required>
              <Input
                placeholder="mis. Dana Darurat, Liburan Jepang, Mobil Baru"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Target Nominal Uang" required>
                <AmountInput
                  value={targetAmount}
                  onValueChange={setTargetAmount}
                  placeholder="0"
                />
              </Field>

              <Field label="Tenggat Waktu / Deadline (Opsional)">
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hubungkan ke Rekening (Opsional)">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Tidak terikat rekening spesifik</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tingkat Prioritas">
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="1">1 - Sangat Utama (Wajib)</option>
                  <option value="2">2 - Penting</option>
                  <option value="3">3 - Keinginan / Jangka Panjang</option>
                </Select>
              </Field>
            </div>

            <Field label="Pilih Ikon">
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </Field>

            <Field label="Pilih Warna">
              <ColorPicker value={color} onChange={setColor} />
            </Field>

            <Field label="Catatan Tambahan (Opsional)">
              <Textarea
                placeholder="Rencana alokasi atau strategi menabung..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Contribute (Setor / Tarik) */}
      <Dialog open={contributeGoal !== null} onOpenChange={(o) => !o && setContributeGoal(null)}>
        <DialogContent
          title={contribType === 'deposit' ? `Setor ke: ${contributeGoal?.name}` : `Tarik dari: ${contributeGoal?.name}`}
          size="sm"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setContributeGoal(null)}>
                Batal
              </Button>
              <Button
                variant={contribType === 'deposit' ? 'primary' : 'danger'}
                loading={contributeMutation.isPending}
                disabled={Number(contribAmount) <= 0}
                onClick={() => contributeMutation.mutate(undefined)}
              >
                {contribType === 'deposit' ? 'Konfirmasi Setoran' : 'Konfirmasi Penarikan'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Nominal Uang" required>
              <AmountInput
                large
                value={contribAmount}
                onValueChange={setContribAmount}
                placeholder="0"
                autoFocus
              />
            </Field>

            <Field label="Tanggal Transaksi" required>
              <Input
                type="date"
                value={contribDate}
                onChange={(e) => setContribDate(e.target.value)}
              />
            </Field>

            <Field label="Catatan (Opsional)">
              <Input
                placeholder="mis. Setoran bonus akhir bulan"
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Goal */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Hapus Target Tabungan?"
        description="Target ini beserta seluruh riwayat setorannya akan dihapus."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
