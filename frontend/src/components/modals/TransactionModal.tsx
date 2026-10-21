import * as React from 'react'
import { useAccounts, useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { todayISO } from '@/lib/format'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea, AmountInput } from '@/components/ui/input'
import { Segmented } from '@/components/ui/primitives'
import type { Transaction } from '@/types'

export function TransactionModal({
  open,
  onOpenChange,
  initialType = 'expense',
  editItem,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialType?: 'expense' | 'income' | 'transfer'
  editItem?: Transaction | null
}) {
  const { data: accountsData } = useAccounts()
  const { data: categories = [] } = useCategories()

  const [type, setType] = React.useState<'expense' | 'income' | 'transfer'>(
    (editItem?.type as 'expense' | 'income' | 'transfer') || initialType,
  )
  const [amount, setAmount] = React.useState(editItem ? editItem.amount : '')
  const [accountId, setAccountId] = React.useState<string>(editItem ? String(editItem.account_id) : '')
  const [toAccountId, setToAccountId] = React.useState<string>(
    editItem?.transfer ? String(editItem.transfer.to_account_id) : '',
  )
  const [categoryId, setCategoryId] = React.useState<string>(editItem?.category_id ? String(editItem.category_id) : '')
  const [date, setDate] = React.useState(editItem?.date ? editItem.date : todayISO())
  const [description, setDescription] = React.useState(editItem?.description || '')
  const [notes, setNotes] = React.useState(editItem?.notes || '')
  const [counterparty, setCounterparty] = React.useState(editItem?.counterparty || '')
  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null)

  const accounts = accountsData?.data ?? []

  // Default akun jika belum dipilih
  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(String(accounts[0].id))
    }
    if (!toAccountId && accounts.length > 1) {
      setToAccountId(String(accounts[1].id))
    }
  }, [accounts, accountId, toAccountId])

  // Reset form saat modal dibuka kembali
  React.useEffect(() => {
    if (open) {
      if (editItem) {
        setType(editItem.type as 'expense' | 'income' | 'transfer')
        setAmount(editItem.amount)
        setAccountId(String(editItem.account_id))
        setCategoryId(editItem.category_id ? String(editItem.category_id) : '')
        setDate(editItem.date)
        setDescription(editItem.description || '')
        setNotes(editItem.notes || '')
        setCounterparty(editItem.counterparty || '')
        if (editItem.transfer) {
          setToAccountId(String(editItem.transfer.to_account_id))
        }
      } else {
        setType(initialType)
        setAmount('')
        setDate(todayISO())
        setDescription('')
        setNotes('')
        setCounterparty('')
        setAttachmentFile(null)
        const defaultCat = categories.find((c) => c.type === (initialType === 'income' ? 'income' : 'expense'))
        if (defaultCat) setCategoryId(String(defaultCat.id))
      }
    }
  }, [open, editItem, initialType, categories])

  const saveMutation = useFinanceMutation(
    async () => {
      if (type === 'transfer') {
        const payload = {
          type: 'transfer',
          account_id: Number(accountId),
          from_account_id: Number(accountId),
          to_account_id: Number(toAccountId),
          amount: Number(amount),
          date,
          notes: notes || undefined,
        }
        if (editItem) {
          return api.put(`/transactions/${editItem.id}`, payload)
        }
        return api.post('/transactions', payload)
      }

      const payload = {
        type,
        flow: type === 'income' ? 'in' : 'out',
        account_id: Number(accountId),
        category_id: categoryId ? Number(categoryId) : null,
        amount: Number(amount),
        date,
        description: description || undefined,
        notes: notes || undefined,
        counterparty: counterparty || undefined,
      }
      let txId: number | undefined
      if (editItem) {
        const res = (await api.put(`/transactions/${editItem.id}`, payload)) as { data: Transaction }
        txId = res?.data?.id ?? editItem.id
      } else {
        const res = (await api.post('/transactions', payload)) as { data: Transaction }
        txId = res?.data?.id
      }

      if (attachmentFile && txId) {
        const formData = new FormData()
        formData.append('file', attachmentFile)
        await api.post(`/transactions/${txId}/attachment`, formData)
      }
    },
    {
      success: editItem ? 'Transaksi berhasil diperbarui' : 'Transaksi berhasil dicatat',
      onSuccess: () => onOpenChange(false),
    },
  )

  const filteredCategories = categories.filter((c) => (type === 'income' ? c.type === 'income' : c.type === 'expense'))

  const isValid = Number(amount) > 0 && accountId && (type === 'transfer' ? toAccountId && toAccountId !== accountId : true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editItem ? 'Edit Transaksi' : 'Catat Transaksi'}
        size="md"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={!isValid}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate(undefined)}
            >
              {editItem ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Tipe Selector jika bukan edit */}
          {!editItem && (
            <div className="flex justify-center">
              <Segmented
                value={type}
                onChange={(t) => {
                  setType(t)
                  const firstCat = categories.find((c) => c.type === (t === 'income' ? 'income' : 'expense'))
                  if (firstCat) setCategoryId(String(firstCat.id))
                }}
                options={[
                  { value: 'expense', label: 'Pengeluaran' },
                  { value: 'income', label: 'Pemasukan' },
                  { value: 'transfer', label: 'Transfer Antar Akun' },
                ]}
              />
            </div>
          )}

          {/* Amount input */}
          <Field label="Nominal Uang" required>
            <AmountInput
              large
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
              autoFocus
            />
          </Field>

          {/* Transfer account picker */}
          {type === 'transfer' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dari Rekening" required>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ke Rekening" required>
                <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={String(a.id) === accountId}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rekening / Dompet" required>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Kategori" required>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Pilih Kategori</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {/* Tanggal & Keterangan */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            {type !== 'transfer' && (
              <Field label="Pihak Terkait / Merchant (Opsional)">
                <Input
                  placeholder="mis. Toko Buku, Teman, Perusahaan"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                />
              </Field>
            )}
          </div>

          {type !== 'transfer' && (
            <Field label="Deskripsi">
              <Input
                placeholder="mis. Makan siang bersama tim, Gaji bulanan"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          )}

          {type !== 'transfer' && (
            <Field label="Lampiran Struk / Bukti Transaksi (Opsional)">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-border file:text-xs file:font-semibold file:bg-surface-2 file:text-fg hover:file:bg-surface-3 cursor-pointer"
              />
              {editItem?.has_attachment && !attachmentFile && (
                <p className="mt-1 text-xs text-primary font-medium">
                  Lampiran saat ini: {editItem.attachment_name}
                </p>
              )}
            </Field>
          )}

          <Field label="Catatan Tambahan (Opsional)">
            <Textarea
              placeholder="Catatan detail mengenai transaksi ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  )
}
