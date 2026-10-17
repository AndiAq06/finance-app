import * as React from 'react'
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAccounts, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/input'

interface ImportCsvModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ImportCsvModal({ open, onOpenChange, onSuccess }: ImportCsvModalProps) {
  const { data: accountsData } = useAccounts()
  const accounts = accountsData?.data ?? []

  const [accountId, setAccountId] = React.useState<string>('')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [resultMsg, setResultMsg] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setResultMsg(null)
      if (accounts.length > 0 && !accountId) {
        setAccountId(String(accounts[0].id))
      }
    }
  }, [open, accounts, accountId])

  const importMutation = useFinanceMutation(
    async () => {
      if (!selectedFile || !accountId) return
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('default_account_id', accountId)

      const res = (await api.post('/transactions/import/csv', formData)) as {
        message: string
        imported_count: number
      }
      return res
    },
    {
      success: 'Data transaksi CSV berhasil diimpor!',
      onSuccess: (data) => {
        setResultMsg(data?.message || 'Berhasil mengimpor transaksi.')
        onSuccess?.()
      },
    },
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResultMsg(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Impor Transaksi dari CSV"
        size="md"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const sampleCsv = `Tanggal,Nominal,Tipe,Kategori,Deskripsi,Catatan\n2026-10-15,50000,expense,Makanan & Minuman,Makan Siang Nasi Padang,Makan siang tim kantor\n2026-10-14,2500000,income,Gaji Bulanan,Bonus Proyek,`
                const blob = new Blob([sampleCsv], { type: 'text/csv' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'contoh_format_finora.csv'
                a.click()
                window.URL.revokeObjectURL(url)
              }}
              className="text-xs text-fg-subtle hover:text-fg"
            >
              Unduh Contoh CSV
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {resultMsg ? 'Tutup' : 'Batal'}
              </Button>
              {!resultMsg && (
                <Button
                  variant="primary"
                  disabled={!selectedFile || !accountId}
                  loading={importMutation.isPending}
                  onClick={() => importMutation.mutate(undefined)}
                >
                  Mulai Impor
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-fg-muted leading-relaxed">
            Unggah file CSV rekening koran atau catatan keuangan Anda. Sistem akan secara otomatis
            mencocokkan kolom tanggal, nominal, tipe, kategori, dan deskripsi.
          </p>

          {/* Account Selector */}
          <Field label="Akun / Rekening Tujuan" required>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </Select>
          </Field>

          {/* File Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl hover:border-primary/60 transition-colors cursor-pointer bg-surface-2/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center gap-3 text-left">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-fg">{selectedFile.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Klik untuk mengganti
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-fg-muted">
                  <UploadCloud className="size-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-fg">Pilih atau seret file CSV ke sini</p>
                <p className="text-xs text-fg-subtle">Format yang didukung: .csv (maksimal 5MB)</p>
              </div>
            )}
          </div>

          {/* Result Alert */}
          {resultMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          {importMutation.isError && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{importMutation.error?.message || 'Gagal memproses file CSV.'}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
