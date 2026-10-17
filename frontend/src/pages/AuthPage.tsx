import * as React from 'react'
import { Sparkles, ArrowRight, Lock, Mail, User, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/providers/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { Field, Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function AuthPage() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = React.useState(false)

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordConfirm, setPasswordConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isRegister) {
        if (password !== passwordConfirm) {
          toast.error('Konfirmasi kata sandi tidak cocok')
          setLoading(false)
          return
        }
        await register({
          name,
          email,
          password,
          password_confirmation: passwordConfirm,
        })
        toast.success('Pendaftaran berhasil! Selamat datang di Finora.')
      } else {
        await login(email, password, true)
        toast.success('Berhasil masuk!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat masuk.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemoLogin = async () => {
    setLoading(true)
    try {
      await login('demo@finora.test', 'password', true)
      toast.success('Berhasil masuk dengan akun demo!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal masuk ke akun demo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 text-white shadow-[0_4px_20px_rgb(22_163_74/0.4)] mb-3">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-fg">FINORA</h1>
          <p className="text-xs font-semibold tracking-wider text-primary uppercase mt-0.5">
            Personal Finance Manager
          </p>
          <p className="text-sm text-fg-muted mt-2">
            Kelola pengeluaran, anggaran, dan tabungan Anda dengan cerdas.
          </p>
        </div>

        {/* 1-Click Demo Login Banner */}
        <Card className="p-4 bg-primary/10 border-primary/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-fg">Coba Langsung Tanpa Daftar?</p>
            <p className="text-[11px] text-fg-muted">Masuk instan dengan data demo Indonesia.</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            loading={loading}
            onClick={handleQuickDemoLogin}
            className="text-xs gap-1.5 shadow-sm"
          >
            <ShieldCheck className="size-3.5" /> Masuk Demo
          </Button>
        </Card>

        {/* Auth Form Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
            <h2 className="text-base font-bold text-fg">
              {isRegister ? 'Buat Akun Baru' : 'Masuk ke Akun Anda'}
            </h2>
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {isRegister ? 'Sudah punya akun? Masuk' : 'Daftar akun baru'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <Field label="Nama Lengkap" required>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    placeholder="Nama Anda"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </Field>
            )}

            <Field label="Alamat Email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </Field>

            <Field label="Kata Sandi" required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </Field>

            {isRegister && (
              <Field label="Konfirmasi Kata Sandi" required>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </Field>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full gap-2 mt-2"
              loading={loading}
            >
              {isRegister ? 'Daftar Sekarang' : 'Masuk'} <ArrowRight className="size-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
