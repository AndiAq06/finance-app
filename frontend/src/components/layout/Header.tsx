import {
  Search, Bell, Sun, Moon, Laptop, LogOut, User as UserIcon, CheckCheck,
  ChevronDown, PlusCircle, ArrowRightLeft, Menu, Sparkles,
} from 'lucide-react'
import { useAuth, applyTheme } from '@/providers/auth'
import { useNotifications, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { initials } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, Popover, PopoverTrigger, PopoverContent,
  Badge,
} from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'

export function Header({
  onOpenSidebar,
  onOpenSearch,
  onOpenQuickTransaction,
  onOpenQuickTransfer,
}: {
  onOpenSidebar?: () => void
  onOpenSearch: () => void
  onOpenQuickTransaction: () => void
  onOpenQuickTransfer: () => void
}) {
  const { user, logout } = useAuth()
  const { data: notifData } = useNotifications()

  const markAllMutation = useFinanceMutation(() => api.post('/notifications/read-all'), {
    success: 'Semua notifikasi ditandai sudah dibaca',
  })

  const markOneMutation = useFinanceMutation((id: number) => api.post(`/notifications/${id}/read`))

  const unreadCount = notifData?.unread_count ?? 0
  const notifications = notifData?.data ?? []

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-surface/90 px-3 sm:px-6 backdrop-blur-md">
      {/* Left section: Mobile menu + Brand + Search trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            className="lg:hidden text-fg-muted hover:text-fg size-9"
            aria-label="Buka Menu"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* Mobile brand mark */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <div className="grid size-7 place-items-center rounded-lg bg-primary text-white shadow-sm">
            <Sparkles className="size-4" />
          </div>
          <span className="font-extrabold tracking-tight text-sm text-fg">Finora</span>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 sm:h-10 w-9 sm:w-64 items-center justify-center sm:justify-between rounded-xl border border-border bg-surface-2 px-2 sm:px-3 text-sm text-fg-subtle transition-all hover:border-border-strong hover:text-fg focus:outline-none focus:ring-2 focus:ring-primary/40"
          title="Cari transaksi, rekening, target... (Ctrl+K)"
        >
          <span className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-fg-muted" />
            <span className="hidden sm:inline">Cari apa saja...</span>
          </span>
          <kbd className="hidden rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-fg-subtle shadow-sm border border-border sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Quick Add Buttons */}
        <div className="hidden items-center gap-1.5 md:flex">
          <Button variant="secondary" size="sm" onClick={onOpenQuickTransfer} className="h-9 gap-1.5">
            <ArrowRightLeft className="size-3.5" /> Transfer
          </Button>
          <Button variant="primary" size="sm" onClick={onOpenQuickTransaction} className="h-9 gap-1.5">
            <PlusCircle className="size-4" /> Transaksi
          </Button>
        </div>

        {/* Theme switch */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ganti tema">
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => applyTheme('light')}>
              <Sun className="mr-2 size-4" /> Terang
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyTheme('dark')}>
              <Moon className="mr-2 size-4" /> Gelap
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyTheme('system')}>
              <Laptop className="mr-2 size-4" /> Mengikuti Sistem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative grid size-10 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none"
              aria-label="Notifikasi"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-expense text-[10px] font-bold text-white shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 sm:w-96" align="end">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-fg">Notifikasi</span>
                {unreadCount > 0 && <Badge tone="expense">{unreadCount} baru</Badge>}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllMutation.mutate(undefined)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <CheckCheck className="size-3.5" /> Tandai semua dibaca
                </button>
              )}
            </div>

            <div className="scrollbar-thin max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-fg-muted">
                  Tidak ada notifikasi saat ini.
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.read_at
                  return (
                    <div
                      key={n.id}
                      onClick={() => isUnread && markOneMutation.mutate(n.id)}
                      className={`flex cursor-pointer items-start gap-3 p-3.5 transition-colors hover:bg-surface-2 ${
                        isUnread ? 'bg-primary-soft/30' : ''
                      }`}
                    >
                      <div className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" style={{ opacity: isUnread ? 1 : 0 }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-fg">{n.title}</p>
                        <p className="mt-0.5 text-xs text-fg-muted line-clamp-2">{n.body}</p>
                        <p className="mt-1 text-[10px] text-fg-subtle">{formatRelative(n.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-surface-2 focus:outline-none"
            >
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-fg shadow-sm">
                {user?.name ? initials(user.name) : <UserIcon className="size-4" />}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-bold text-fg leading-none truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-fg-subtle leading-none mt-1">{user?.is_demo ? 'Mode Demo' : user?.email}</p>
              </div>
              <ChevronDown className="hidden size-3.5 text-fg-subtle md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-bold text-fg">{user?.name}</p>
              <p className="text-xs text-fg-muted truncate">{user?.email}</p>
              {user?.is_demo && (
                <Badge tone="info" className="mt-1.5">
                  Akun Demo Aktif
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => (window.location.hash = '#/settings')}>
              <UserIcon className="mr-2 size-4" /> Pengaturan & Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              danger
              onSelect={async () => {
                await logout()
              }}
              onClick={async () => {
                await logout()
              }}
            >
              <LogOut className="mr-2 size-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
