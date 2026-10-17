import * as React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, Target,
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
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
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

        {/* Page Content Container */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Native App Style) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border/80 bg-surface/95 px-1 py-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('relative grid place-items-center', isActive && 'text-primary')}>
                <LayoutDashboard className="size-5" />
                {isActive && <span className="absolute -bottom-1 size-1 rounded-full bg-primary" />}
              </div>
              <span>Beranda</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('relative grid place-items-center', isActive && 'text-primary')}>
                <ArrowLeftRight className="size-5" />
                {isActive && <span className="absolute -bottom-1 size-1 rounded-full bg-primary" />}
              </div>
              <span>Transaksi</span>
            </>
          )}
        </NavLink>

        {/* Center Floating Quick Action Button */}
        <button
          type="button"
          onClick={() => {
            setTxType('expense')
            setTxModalOpen(true)
          }}
          className="-mt-5 grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/40 ring-4 ring-bg active:scale-90 transition-all hover:brightness-105"
          aria-label="Tambah Transaksi Cepat"
        >
          <PlusCircle className="size-6" />
        </button>

        <NavLink
          to="/goals"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('relative grid place-items-center', isActive && 'text-primary')}>
                <Target className="size-5" />
                {isActive && <span className="absolute -bottom-1 size-1 rounded-full bg-primary" />}
              </div>
              <span>Target</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/accounts"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-90',
              isActive ? 'text-primary' : 'text-fg-subtle hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('relative grid place-items-center', isActive && 'text-primary')}>
                <Landmark className="size-5" />
                {isActive && <span className="absolute -bottom-1 size-1 rounded-full bg-primary" />}
              </div>
              <span>Rekening</span>
            </>
          )}
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
