import * as React from 'react'
import { PlusCircle, Landmark, Edit2, Trash2 } from 'lucide-react'
import { useAccounts, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRupiah, todayISO } from '@/lib/format'
import { Card, Badge, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea, AmountInput } from '@/components/ui/input'
import { IconBadge, IconPicker, ColorPicker } from '@/components/ui/icons'
import type { Account, AccountType } from '@/types'

export function AccountsPage() {
  const { data, isLoading } = useAccounts(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editAccount, setEditAccount] = React.useState<Account | null>(null)
  const [deleteAccount, setDeleteAccount] = React.useState<Account | null>(null)

  // Form states
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<AccountType>('bank')
  const [openingBalance, setOpeningBalance] = React.useState('')
  const [startDate, setStartDate] = React.useState(todayISO())
  const [color, setColor] = React.useState('#16A34A')
  const [icon, setIcon] = React.useState('wallet')
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (editAccount) {
      setName(editAccount.name)
      setType(editAccount.type)
      setOpeningBalance(editAccount.opening_balance)
      setStartDate(editAccount.start_date || todayISO())
      setColor(editAccount.color || '#16A34A')
      setIcon(editAccount.icon || 'wallet')
      setNotes(editAccount.notes || '')
    } else {
      setName('')
      setType('bank')
      setOpeningBalance('')
      setStartDate(todayISO())
      setColor('#16A34A')
      setIcon('wallet')
      setNotes('')
    }
  }, [editAccount, modalOpen])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        name,
        type,
        opening_balance: Number(openingBalance),
        start_date: startDate,
        color,
        icon,
        notes: notes || undefined,
      }
      if (editAccount) {
        return api.put(`/accounts/${editAccount.id}`, payload)
      }
      return api.post('/accounts', payload)
    },
    {
      success: editAccount ? 'Rekening berhasil diperbarui' : 'Rekening baru berhasil ditambahkan',
      onSuccess: () => setModalOpen(false),
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/accounts/${id}`),
    {
      success: 'Rekening berhasil diproses',
      onSuccess: () => setDeleteAccount(null),
    },
  )

  const accounts = data?.data ?? []
  const totalBalance = data?.total_balance ?? '0'

  return (
    <div className="space-y-6">
      {/* Header & Total Net Worth */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Rekening & Dompet</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Kelola seluruh tempat penyimpanan uang, tabungan, dan dompet digital Anda.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditAccount(null)
            setModalOpen(true)
          }}
          className="gap-1.5"
        >
          <PlusCircle className="size-4" /> Tambah Rekening
        </Button>
      </div>

      {/* Net Worth Highlight Card */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 via-surface to-surface border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Total Kekayaan Bersih (Net Worth)
            </span>
            <p className="mt-1 text-3xl font-black tabular tracking-tight text-fg">
              {formatRupiah(totalBalance)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Akumulasi saldo terkini dari seluruh {accounts.filter((a) => a.is_active).length} rekening aktif
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="primary" className="text-xs px-3 py-1">
              {accounts.length} Total Rekening
            </Badge>
          </div>
        </div>
      </Card>

      {/* Account Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="p-12 text-center">
          <Landmark className="mx-auto size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Belum ada rekening</p>
          <p className="text-xs text-fg-muted mt-1">Tambahkan rekening bank atau dompet pertama Anda sekarang.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card
              key={acc.id}
              className={`p-5 flex flex-col justify-between transition-all hover:border-border-strong ${
                !acc.is_active ? 'opacity-60 bg-surface-2' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={acc.icon} color={acc.color} size="md" />
                    <div>
                      <h3 className="font-bold text-base text-fg leading-tight">{acc.name}</h3>
                      <Badge tone="neutral" className="mt-1 text-[10px] uppercase">
                        {acc.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditAccount(acc)
                        setModalOpen(true)
                      }}
                      title="Edit Rekening"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      onClick={() => setDeleteAccount(acc)}
                      title="Hapus / Nonaktifkan"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-5">
                  <span className="text-[11px] font-semibold text-fg-subtle">Saldo Saat Ini</span>
                  <p className="text-2xl font-black tabular tracking-tight text-fg mt-0.5">
                    {formatRupiah(acc.balance)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-fg-muted">
                <span>Saldo awal: {formatRupiah(acc.opening_balance)}</span>
                <span>{acc.transactions_count ?? 0} transaksi</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Account */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editAccount ? 'Edit Rekening' : 'Tambah Rekening Baru'}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!name.trim()}
                onClick={() => saveMutation.mutate(undefined)}
              >
                {editAccount ? 'Simpan Perubahan' : 'Buat Rekening'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <Field label="Nama Rekening / Dompet" required>
              <Input
                placeholder="mis. BCA Prioritas, GoPay, Dompet Tunai"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipe Akun" required>
                <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                  <option value="bank">Bank (BCA, Mandiri, dll)</option>
                  <option value="ewallet">e-Wallet (GoPay, OVO, Dana)</option>
                  <option value="cash">Uang Tunai (Cash / Dompet)</option>
                  <option value="savings">Tabungan / Investasi (Bibit, dll)</option>
                  <option value="other">Lainnya</option>
                </Select>
              </Field>

              <Field label="Saldo Awal" required>
                <AmountInput
                  value={openingBalance}
                  onValueChange={setOpeningBalance}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Pilih Ikon Rekening">
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </Field>

            <Field label="Pilih Warna Rekening">
              <ColorPicker value={color} onChange={setColor} />
            </Field>

            <Field label="Catatan Tambahan (Opsional)">
              <Textarea
                placeholder="Nomor rekening atau keterangan lainnya..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Account */}
      <ConfirmDialog
        open={deleteAccount !== null}
        onOpenChange={(o) => !o && setDeleteAccount(null)}
        title="Hapus / Nonaktifkan Rekening?"
        description={
          deleteAccount?.transactions_count && deleteAccount.transactions_count > 0
            ? 'Rekening ini memiliki riwayat transaksi, sehingga akan dinonaktifkan agar data mutasi tetap aman.'
            : 'Rekening ini belum memiliki transaksi dan akan dihapus secara permanen.'
        }
        confirmLabel="Konfirmasi"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteAccount && deleteMutation.mutate(deleteAccount.id)}
      />
    </div>
  )
}
