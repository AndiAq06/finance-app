import * as React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, PieChart, Menu,
  PlusCircle,
} from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SearchModal } from './SearchModal'
import { TransactionModal } from '../modals/TransactionModal'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [txModalOpen, setTxModalOpen] = React.useState(false)
  const [txType, setTxType] = React.useState<'expense' | 'income' | 'transfer'>('expense')

  // Global shortcut: Ctrl+K / Cmd+K to open search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <Header
          onOpenSearch={() => setSearchOpen(true)}
          onOpenQuickTransaction={() => {
            setTxType('expense')
            setTxModalOpen(true)
          }}
          onOpenQuickTransfer={() => {
            setTxType('transfer')
            setTxModalOpen(true)
          }}
        />

        {/* Mobile top bar toggle button */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <Menu className="size-5" /> Menu
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTxType('expense')
                setTxModalOpen(true)
              }}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-fg"
            >
              <PlusCircle className="size-3.5" /> Transaksi
            </button>
          </div>
        </div>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-2 backdrop-blur-md lg:hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          <LayoutDashboard className="size-5" />
          <span>Ringkasan</span>
        </NavLink>
        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          <ArrowLeftRight className="size-5" />
          <span>Transaksi</span>
        </NavLink>

        {/* Center Action Button */}
        <button
          type="button"
          onClick={() => {
            setTxType('expense')
            setTxModalOpen(true)
          }}
          className="-mt-5 grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          aria-label="Tambah Transaksi"
        >
          <PlusCircle className="size-6" />
        </button>

        <NavLink
          to="/accounts"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          <Landmark className="size-5" />
          <span>Rekening</span>
        </NavLink>
        <NavLink
          to="/budgets"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-1 text-[11px] font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          <PieChart className="size-5" />
          <span>Anggaran</span>
        </NavLink>
      </nav>

      {/* Global Modals */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <TransactionModal
        open={txModalOpen}
        onOpenChange={setTxModalOpen}
        initialType={txType}
      />
    </div>
  )
}
