import { format as fnsFormat, parseISO, isValid } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

/**
 * Semua nominal dari API dikirim sebagai string desimal (mis. "1250000.00")
 * agar tidak kehilangan presisi. Konversi ke number HANYA untuk tampilan/grafik.
 */
export type Money = string | number | null | undefined

export function toNumber(v: Money): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Format Rupiah: Rp1.250.000 (tanpa spasi), negatif: -Rp1.250.000 */
export function formatRupiah(v: Money, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const n = toNumber(v)
  const abs = Math.abs(n)
  const body = (opts.decimals ? nf2 : nf0).format(opts.decimals ? abs : Math.round(abs))
  const prefix = n < 0 ? '-' : opts.sign && n > 0 ? '+' : ''
  return `${prefix}Rp${body}`
}

/** Format ringkas untuk sumbu grafik: Rp1,2 jt / Rp350 rb / Rp2,5 M */
export function formatRupiahCompact(v: Money): string {
  const n = toNumber(v)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const fmt = (x: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(x)
  if (abs >= 1_000_000_000_000) return `${sign}Rp${fmt(abs / 1_000_000_000_000)} T`
  if (abs >= 1_000_000_000) return `${sign}Rp${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}Rp${fmt(abs / 1_000_000)} jt`
  if (abs >= 1_000) return `${sign}Rp${fmt(abs / 1_000)} rb`
  return `${sign}Rp${nf0.format(abs)}`
}

export function formatNumber(v: Money): string {
  return nf0.format(toNumber(v))
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(v)}%`
}

/**
 * Ubah input pengguna "1.250.000" atau "1250000,50" menjadi string desimal "1250000.50".
 * Mengembalikan '' jika tidak valid.
 */
export function parseAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, '')
  if (!cleaned) return ''
  const [intPart, decPart] = cleaned.split(',')
  const int = intPart.replace(/^0+(?=\d)/, '')
  if (decPart !== undefined && decPart.length > 0) return `${int || '0'}.${decPart.slice(0, 2)}`
  return int
}

/** Tampilkan string desimal "1250000.5" sebagai "1.250.000,5" untuk input */
export function formatAmountInput(v: string): string {
  if (!v) return ''
  const [int, dec] = v.split('.')
  const intFmt = int ? nf0.format(Number(int)) : '0'
  return dec !== undefined ? `${intFmt},${dec}` : intFmt
}

// ---------------------------------------------------------------- Tanggal

export const DATE_FORMATS = {
  'd MMM yyyy': '16 Okt 2026',
  'dd/MM/yyyy': '16/10/2026',
  'yyyy-MM-dd': '2026-10-16',
  'd MMMM yyyy': '16 Oktober 2026',
} as const
export type DateFormatKey = keyof typeof DATE_FORMATS

let currentDateFormat: DateFormatKey = 'd MMM yyyy'
let currentTimezone = 'Asia/Makassar'

export function configureFormatting(opts: { dateFormat?: string; timezone?: string }) {
  if (opts.dateFormat && opts.dateFormat in DATE_FORMATS) currentDateFormat = opts.dateFormat as DateFormatKey
  if (opts.timezone) currentTimezone = opts.timezone
}
export function getTimezone() {
  return currentTimezone
}

/** Parse tanggal "YYYY-MM-DD" sebagai tanggal lokal (tanpa pergeseran zona waktu). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Format tanggal-saja (tanggal transaksi). Tidak dikonversi zona waktu. */
export function formatDate(s: string | null | undefined, fmt?: string): string {
  if (!s) return '—'
  const d = s.length <= 10 ? parseDateOnly(s) : parseISO(s)
  if (!isValid(d)) return '—'
  return fnsFormat(d, fmt ?? currentDateFormat, { locale: localeId })
}

/** Format timestamp (created_at dsb.) sesuai zona waktu pengguna. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: currentTimezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} hari lalu`
  return formatDateTime(iso)
}

/** Tanggal hari ini (YYYY-MM-DD) di zona waktu pengguna. */
export function todayISO(tz: string = currentTimezone): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(d: Date): string {
  return toISODate(d).slice(0, 7)
}

export function formatMonth(key: string): string {
  return fnsFormat(parseDateOnly(`${key}-01`), 'MMMM yyyy', { locale: localeId })
}

export function greeting(tz: string = currentTimezone): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()))
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}
