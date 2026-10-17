import * as React from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { formatRupiah, type Money } from '@/lib/format'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary [&_svg]:size-6">{icon}</div>
      <p className="font-bold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-expense-soft text-expense">
        <AlertOctagon className="size-6" />
      </div>
      <p className="font-bold text-fg">Gagal memuat data</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{message ?? 'Terjadi kesalahan. Silakan coba lagi.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Coba lagi
        </Button>
      )}
    </div>
  )
}

/** Tampilkan nominal dengan warna sesuai arah (pemasukan hijau, pengeluaran merah). */
export function Amount({
  value,
  flow,
  className,
  signed = true,
}: {
  value: Money
  flow?: 'in' | 'out' | 'neutral'
  className?: string
  signed?: boolean
}) {
  const color = flow === 'in' ? 'text-income' : flow === 'out' ? 'text-expense' : 'text-fg'
  const prefix = signed ? (flow === 'in' ? '+' : flow === 'out' ? '-' : '') : ''
  return <span className={cn('tabular font-semibold', color, className)}>{prefix}{formatRupiah(Math.abs(Number(value ?? 0)))}</span>
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
