import {
  Wallet, Landmark, Smartphone, PiggyBank, CreditCard, Briefcase, Laptop, TrendingUp, Gift, Store, Sparkles,
  Utensils, Car, ShoppingBag, Receipt, HeartPulse, Clapperboard, GraduationCap, Home, Users, CircleDot,
  Plane, Shield, Bike, Baby, Dumbbell, Coffee, Fuel, Wifi, Zap, Droplets, Phone, Music, Gamepad2, Shirt,
  BookOpen, Banknote, Coins, HandCoins, Target, Tag, Building2, Bus, Stethoscope, PawPrint, Smile,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Registry ikon yang dapat dipilih pengguna untuk kategori, akun, dan target. */
export const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, landmark: Landmark, smartphone: Smartphone, 'piggy-bank': PiggyBank, 'credit-card': CreditCard,
  briefcase: Briefcase, laptop: Laptop, 'trending-up': TrendingUp, gift: Gift, store: Store, sparkles: Sparkles,
  utensils: Utensils, car: Car, 'shopping-bag': ShoppingBag, receipt: Receipt, 'heart-pulse': HeartPulse,
  clapperboard: Clapperboard, 'graduation-cap': GraduationCap, home: Home, users: Users, 'circle-dot': CircleDot,
  plane: Plane, shield: Shield, bike: Bike, baby: Baby, dumbbell: Dumbbell, coffee: Coffee, fuel: Fuel, wifi: Wifi,
  zap: Zap, droplets: Droplets, phone: Phone, music: Music, gamepad: Gamepad2, shirt: Shirt, 'book-open': BookOpen,
  banknote: Banknote, coins: Coins, 'hand-coins': HandCoins, target: Target, tag: Tag, building: Building2, bus: Bus,
  stethoscope: Stethoscope, paw: PawPrint, smile: Smile,
}
export const ICON_NAMES = Object.keys(ICONS)

export const COLORS = [
  '#16A34A', '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899', '#E11D48', '#F97316', '#F59E0B',
  '#84CC16', '#14B8A6', '#0F172A', '#64748B',
]

export function IconByName({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || CircleDot
  return <Icon className={className} aria-hidden />
}

/** Lingkaran ikon berwarna (warna kategori/akun) dengan latar transparan. */
export function IconBadge({
  icon,
  color = '#64748B',
  size = 'md',
  className,
}: {
  icon?: string | null
  color?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const s = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-[18px]', lg: 'size-12 [&_svg]:size-5' }[size]
  const c = color || '#64748B'
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-xl', s, className)} style={{ backgroundColor: `${c}1F`, color: c }}>
      <IconByName name={icon} />
    </span>
  )
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color?: string }) {
  return (
    <div className="scrollbar-thin grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-border p-2" role="radiogroup" aria-label="Pilih ikon">
      {ICON_NAMES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n}
          onClick={() => onChange(n)}
          className={cn(
            'grid aspect-square place-items-center rounded-lg transition-colors [&_svg]:size-4',
            value === n ? 'ring-2 ring-primary' : 'hover:bg-surface-2',
          )}
          style={value === n ? { backgroundColor: `${color ?? '#16A34A'}1F`, color: color ?? '#16A34A' } : undefined}
        >
          <IconByName name={n} />
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih warna">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={`Warna ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            'size-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
            value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-fg',
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
