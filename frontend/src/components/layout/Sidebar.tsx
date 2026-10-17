import * as React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, PieChart, Target,
  HandCoins, CalendarClock, BarChart3, Calendar, Settings, Sparkles,
  Repeat, ChevronRight, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const mainNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Rekening & Dompet', icon: Landmark },
  { to: '/budgets', label: 'Anggaran (Budget)', icon: PieChart },
  { to: '/goals', label: 'Target Tabungan', icon: Target },
  { to: '/debts', label: 'Hutang & Piutang', icon: HandCoins },
  { to: '/bills', label: 'Tagihan Rutin', icon: CalendarClock },
  { to: '/recurring', label: 'Transaksi Terjadwal', icon: Repeat },
  { to: '/reports', label: 'Laporan & Analitik', icon: BarChart3 },
  { to: '/calendar', label: 'Kalender Keuangan', icon: Calendar },
]

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <NavLink to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight text-fg" onClick={onClose}>
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-primary to-emerald-400 text-white shadow-[0_2px_10px_rgb(22_163_74/0.35)]">
              <Sparkles className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-fg leading-none">FINORA</span>
              <span className="text-[10px] font-semibold tracking-wider text-primary uppercase mt-0.5">Smart Finance</span>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-fg-subtle hover:bg-surface-2 lg:hidden"
            aria-label="Tutup Menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
            Menu Utama
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-[0_2px_8px_rgb(22_163_74/0.25)]'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="size-[18px] shrink-0 transition-transform group-hover:scale-105" />
                  <span className="truncate">{item.label}</span>
                </div>
                <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            )
          })}
        </div>

        {/* Footer nav (Settings) */}
        <div className="border-t border-border p-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-fg'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Settings className="size-[18px] shrink-0" />
            <span>Pengaturan</span>
          </NavLink>
        </div>
      </aside>
    </>
  )
}
