import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ArrowLeftRight, Landmark, Target, CalendarClock, HandCoins,
  Loader2, X,
} from 'lucide-react'
import { useSearch } from '@/lib/queries'
import { formatRupiah } from '@/lib/format'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/primitives'

export function SearchModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const navigate = useNavigate()

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useSearch(debouncedQuery)

  const handleSelect = (path: string) => {
    onOpenChange(false)
    setQuery('')
    setDebouncedQuery('')
    navigate(path)
  }

  const hasResults =
    data &&
    (data.transactions.length > 0 ||
      data.accounts.length > 0 ||
      data.goals.length > 0 ||
      data.bills.length > 0 ||
      data.debts.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Pencarian Global" size="lg" className="p-0 overflow-hidden">
        {/* Search Input bar */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="mr-3 size-5 text-fg-subtle" />
          <input
            autoFocus
            type="text"
            placeholder="Cari transaksi, rekening, target, tagihan, atau hutang..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-base text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          {isLoading && <Loader2 className="size-4 animate-spin text-primary mr-2" />}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-fg-subtle hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Results area */}
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {query.trim().length < 2 && (
            <div className="py-12 text-center text-sm text-fg-muted">
              Ketik minimal 2 karakter untuk mulai mencari.
            </div>
          )}

          {query.trim().length >= 2 && !isLoading && !hasResults && (
            <div className="py-12 text-center text-sm text-fg-muted">
              Tidak ditemukan hasil untuk <span className="font-bold text-fg">"{query}"</span>.
            </div>
          )}

          {/* Transactions */}
          {data?.transactions && data.transactions.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                <ArrowLeftRight className="size-3.5" /> Transaksi ({data.transactions.length})
              </div>
              <div className="space-y-1">
                {data.transactions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect('/transactions')}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{t.description || 'Transaksi tanpa keterangan'}</p>
                      <p className="text-xs text-fg-subtle">
                        {t.date} • {t.account?.name ?? 'Akun'} {t.category?.name ? `• ${t.category.name}` : ''}
                      </p>
                    </div>
                    <span className={`tabular font-bold ${t.flow === 'in' ? 'text-income' : 'text-expense'}`}>
                      {t.flow === 'in' ? '+' : '-'}
                      {formatRupiah(t.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accounts */}
          {data?.accounts && data.accounts.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                <Landmark className="size-3.5" /> Rekening ({data.accounts.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelect('/accounts')}
                    className="flex items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{a.name}</p>
                      <Badge tone="neutral" className="mt-1">
                        {a.type}
                      </Badge>
                    </div>
                    <span className="tabular font-bold text-fg">{formatRupiah(a.balance)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {data?.goals && data.goals.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                <Target className="size-3.5" /> Target Tabungan ({data.goals.length})
              </div>
              <div className="space-y-1">
                {data.goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelect('/goals')}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{g.name}</p>
                      <p className="text-xs text-fg-subtle">
                        Terkumpul: {formatRupiah(g.saved_amount)} dari {formatRupiah(g.target_amount)}
                      </p>
                    </div>
                    <Badge tone="primary">{g.percent}%</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bills */}
          {data?.bills && data.bills.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                <CalendarClock className="size-3.5" /> Tagihan ({data.bills.length})
              </div>
              <div className="space-y-1">
                {data.bills.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect('/bills')}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{b.name}</p>
                      <p className="text-xs text-fg-subtle">Jatuh tempo: {b.next_due_date || '—'}</p>
                    </div>
                    <span className="tabular font-bold text-fg">{formatRupiah(b.amount)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Debts */}
          {data?.debts && data.debts.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                <HandCoins className="size-3.5" /> Hutang & Piutang ({data.debts.length})
              </div>
              <div className="space-y-1">
                {data.debts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelect('/debts')}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <div>
                      <p className="font-semibold text-fg">{d.party_name}</p>
                      <p className="text-xs text-fg-subtle">
                        {d.type === 'debt' ? 'Hutang saya' : 'Piutang ke saya'} • Sisa: {formatRupiah(d.remaining)}
                      </p>
                    </div>
                    <Badge tone={d.type === 'debt' ? 'expense' : 'income'}>
                      {formatRupiah(d.amount)}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
