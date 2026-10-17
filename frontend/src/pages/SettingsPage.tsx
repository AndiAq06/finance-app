import * as React from 'react'
import {
  User, Palette, Bell, Save, LogOut,
} from 'lucide-react'
import { useAuth, applyTheme } from '@/providers/auth'
import { api } from '@/lib/api'
import { useFinanceMutation } from '@/lib/queries'
import { Card, Badge, Switch } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/input'
import type { Preferences } from '@/types'

export function SettingsPage() {
  const { user, preferences, setPreferences, logout } = useAuth()

  // Preferences form
  const [currency, setCurrency] = React.useState(preferences?.currency || 'IDR')
  const [timezone, setTimezone] = React.useState(preferences?.timezone || 'Asia/Jakarta')
  const [dateFormat, setDateFormat] = React.useState(preferences?.date_format || 'd MMM yyyy')
  const [theme, setTheme] = React.useState(preferences?.theme || 'light')

  // Notification toggles
  const [notifyTx, setNotifyTx] = React.useState(preferences?.notify_transaction ?? true)
  const [notifyBudget, setNotifyBudget] = React.useState(preferences?.notify_budget ?? true)
  const [notifyBill, setNotifyBill] = React.useState(preferences?.notify_bill ?? true)
  const [notifyGoal, setNotifyGoal] = React.useState(preferences?.notify_goal ?? true)
  const [notifyDebt, setNotifyDebt] = React.useState(preferences?.notify_debt ?? true)
  const [billDays, setBillDays] = React.useState(String(preferences?.bill_reminder_days || 3))

  React.useEffect(() => {
    if (preferences) {
      setCurrency(preferences.currency)
      setTimezone(preferences.timezone)
      setDateFormat(preferences.date_format)
      setTheme(preferences.theme)
      setNotifyTx(preferences.notify_transaction)
      setNotifyBudget(preferences.notify_budget)
      setNotifyBill(preferences.notify_bill)
      setNotifyGoal(preferences.notify_goal)
      setNotifyDebt(preferences.notify_debt)
      setBillDays(String(preferences.bill_reminder_days || 3))
    }
  }, [preferences])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload: Partial<Preferences> = {
        currency,
        timezone,
        date_format: dateFormat,
        theme,
        notify_transaction: notifyTx,
        notify_budget: notifyBudget,
        notify_bill: notifyBill,
        notify_goal: notifyGoal,
        notify_debt: notifyDebt,
        bill_reminder_days: Number(billDays),
      }
      const res = await api.put<{ preferences: Preferences }>('/auth/preferences', payload)
      if (res.preferences) {
        setPreferences(res.preferences)
        applyTheme(res.preferences.theme)
      }
      return res
    },
    {
      success: 'Pengaturan preferensi berhasil disimpan',
    },
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-fg">Pengaturan & Preferensi</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Sesuaikan profil akun, format mata uang, tema aplikasi, dan notifikasi pengingat.
        </p>
      </div>

      {/* Profil User */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <User className="size-4 text-primary" />
          <h2 className="text-base font-bold text-fg">Profil Pengguna</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-semibold text-fg-subtle">Nama Lengkap</span>
            <p className="text-sm font-bold text-fg mt-0.5">{user?.name}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-subtle">Alamat Email</span>
            <p className="text-sm font-bold text-fg mt-0.5">{user?.email}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-subtle">Tipe Akun</span>
            <div className="mt-1">
              <Badge tone={user?.is_demo ? 'info' : 'primary'}>
                {user?.is_demo ? 'Akun Demo (Lokal)' : 'Pengguna Standar'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-fg">Sesi Masuk</p>
            <p className="text-[11px] text-fg-muted">Keluar dari akun Anda pada perangkat ini.</p>
          </div>
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={async () => {
              await logout()
            }}
            className="gap-1.5"
          >
            <LogOut className="size-4" /> Keluar dari Akun
          </Button>
        </div>
      </Card>

      {/* Tampilan & Tema */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <Palette className="size-4 text-primary" />
          <h2 className="text-base font-bold text-fg">Tampilan & Tema</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tema Antarmuka">
            <Select
              value={theme}
              onChange={(e) => {
                const t = e.target.value as 'light' | 'dark' | 'system'
                setTheme(t)
                applyTheme(t)
              }}
            >
              <option value="light">Mode Terang (Light Mode)</option>
              <option value="dark">Mode Gelap (Dark Mode)</option>
              <option value="system">Mengikuti Pengaturan Perangkat</option>
            </Select>
          </Field>

          <Field label="Zona Waktu">
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              <option value="Asia/Jakarta">WIB - Waktu Indonesia Barat (Jakarta)</option>
              <option value="Asia/Makassar">WITA - Waktu Indonesia Tengah (Makassar/Bali)</option>
              <option value="Asia/Jayapura">WIT - Waktu Indonesia Timur (Jayapura)</option>
            </Select>
          </Field>

          <Field label="Format Tanggal">
            <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              <option value="d MMM yyyy">16 Okt 2026 (Ringkas)</option>
              <option value="d MMMM yyyy">16 Oktober 2026 (Lengkap)</option>
              <option value="dd/MM/yyyy">16/10/2026</option>
              <option value="yyyy-MM-dd">2026-10-16 (Standar ISO)</option>
            </Select>
          </Field>

          <Field label="Mata Uang">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="IDR">IDR (Rupiah Indonesia - Rp)</option>
              <option value="USD">USD (US Dollar - $)</option>
              <option value="SGD">SGD (Singapore Dollar - S$)</option>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Notifikasi & Pengingat */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <Bell className="size-4 text-primary" />
          <h2 className="text-base font-bold text-fg">Preferensi Pengingat & Notifikasi</h2>
        </div>

        <div className="divide-y divide-border space-y-3">
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-bold text-fg">Pengingat Tagihan Berkala</p>
              <p className="text-xs text-fg-muted">Dapatkan peringatan sebelum tagihan jatuh tempo.</p>
            </div>
            <Switch checked={notifyBill} onCheckedChange={setNotifyBill} />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-bold text-fg">Peringatan Anggaran (Budget Alert)</p>
              <p className="text-xs text-fg-muted">Dapatkan notifikasi jika belanja mendekati batas limit.</p>
            </div>
            <Switch checked={notifyBudget} onCheckedChange={setNotifyBudget} />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-bold text-fg">Pengingat Jatuh Tempo Hutang & Piutang</p>
              <p className="text-xs text-fg-muted">Ingatkan jadwal pelunasan hutang dan penagihan piutang.</p>
            </div>
            <Switch checked={notifyDebt} onCheckedChange={setNotifyDebt} />
          </div>

          <div className="pt-3">
            <Field label="Ingatkan Tagihan Berapa Hari Sebelumnya?">
              <Select value={billDays} onChange={(e) => setBillDays(e.target.value)} className="sm:w-60">
                <option value="1">1 Hari Sebelumnya</option>
                <option value="3">3 Hari Sebelumnya</option>
                <option value="5">5 Hari Sebelumnya</option>
                <option value="7">7 Hari Sebelumnya</option>
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          className="gap-2 shadow-sm"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate(undefined)}
        >
          <Save className="size-4" /> Simpan Pengaturan
        </Button>
      </div>
    </div>
  )
}
