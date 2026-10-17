/**
 * HTTP client untuk Finora API (Laravel + Sanctum, cookie-based SPA auth).
 * - credentials: 'include' agar cookie session terkirim
 * - Header X-XSRF-TOKEN diambil dari cookie XSRF-TOKEN (proteksi CSRF)
 * - Tidak ada token/secret yang disimpan di localStorage
 */

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>
  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
  /** Pesan pertama untuk field tertentu */
  field(name: string): string | undefined {
    return this.errors[name]?.[0]
  }
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[2]) : null
}

let csrfPromise: Promise<void> | null = null
export function ensureCsrf(force = false): Promise<void> {
  if (!force && getCookie('XSRF-TOKEN')) return Promise.resolve()
  if (!csrfPromise || force) {
    csrfPromise = fetch('/sanctum/csrf-cookie', { credentials: 'include' }).then(() => undefined)
  }
  return csrfPromise
}

type Query = Record<string, string | number | boolean | null | undefined>

export function buildQuery(q?: Query): string {
  if (!q) return ''
  const p = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface RequestOpts {
  query?: Query
  body?: unknown
  raw?: boolean
  signal?: AbortSignal
}

async function request<T>(method: string, path: string, opts: RequestOpts = {}, retried = false): Promise<T> {
  const isWrite = method !== 'GET'
  if (isWrite) await ensureCsrf()

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  const xsrf = getCookie('XSRF-TOKEN')
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf

  let body: BodyInit | undefined
  if (opts.body instanceof FormData) {
    body = opts.body
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await fetch(`/api${path}${buildQuery(opts.query)}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan API berjalan.')
  }

  // CSRF token kedaluwarsa -> ambil ulang sekali lalu ulangi
  if (res.status === 419 && !retried) {
    await ensureCsrf(true)
    return request<T>(method, path, opts, true)
  }

  if (opts.raw && res.ok) return res as unknown as T

  if (res.status === 204) return undefined as T

  let data: unknown = null
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null)
  }

  if (!res.ok) {
    const d = (data ?? {}) as { message?: string; errors?: Record<string, string[]> }
    if (res.status === 401 && onUnauthorized && !path.startsWith('/auth/')) onUnauthorized()
    const fallback: Record<number, string> = {
      401: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      403: 'Anda tidak memiliki akses ke data ini.',
      404: 'Data tidak ditemukan.',
      419: 'Sesi kedaluwarsa. Muat ulang halaman.',
      422: 'Data yang dikirim tidak valid.',
      429: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
      500: 'Terjadi kesalahan di server. Coba lagi nanti.',
    }
    throw new ApiError(res.status, d.message || fallback[res.status] || `Permintaan gagal (${res.status})`, d.errors ?? {})
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T>(path: string, query?: Query) => request<T>('DELETE', path, { query }),
  download: async (path: string, query?: Query): Promise<Blob> => {
    const res = await request<Response>('GET', path, { query, raw: true })
    return res.blob()
  },
}
