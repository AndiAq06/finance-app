import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type {
  Account, AppNotification, Bill, BudgetMonth, CashflowPoint, Category, Dashboard, Debt, Recurring, ReportSummary,
  SavingsGoal, SearchResults, Transaction, TransactionList,
} from '@/types'

type Params = Record<string, string | number | boolean | null | undefined>

/**
 * Setiap perubahan data keuangan dapat memengaruhi saldo, anggaran, dashboard, laporan,
 * kalender, dan notifikasi. Untuk konsistensi, semua query non-auth di-invalidate.
 */
export function useInvalidateFinance() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Terjadi kesalahan.'
}

/** Mutasi generik dengan toast sukses/gagal + invalidasi data keuangan. */
export function useFinanceMutation<TVars, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  opts: { success?: string | ((r: TRes, v: TVars) => string); onSuccess?: (r: TRes, v: TVars) => void; silentError?: boolean } = {},
) {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      invalidate()
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r, v) : opts.success)
      opts.onSuccess?.(r, v)
    },
    onError: (e) => {
      if (!opts.silentError && !(e instanceof ApiError && e.status === 422)) toast.error(errorMessage(e))
    },
  })
}

// ---------------------------------------------------------------- Queries
export const useAccounts = (includeInactive = false) =>
  useQuery({
    queryKey: ['accounts', { includeInactive }],
    queryFn: () => api.get<{ data: Account[]; total_balance: string }>('/accounts', { include_inactive: includeInactive ? 1 : undefined }),
  })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ data: Category[] }>('/categories').then((r) => r.data), staleTime: 60_000 })

export const useTransactions = (params: Params) =>
  useQuery({
    queryKey: ['transactions', params],
    queryFn: ({ signal }) => api.get<TransactionList>('/transactions', params, signal),
    placeholderData: keepPreviousData,
  })

export const useTransaction = (id: number | null) =>
  useQuery({ queryKey: ['transaction', id], queryFn: () => api.get<{ data: Transaction }>(`/transactions/${id}`).then((r) => r.data), enabled: !!id })

export const useDashboard = (params: Params) =>
  useQuery({ queryKey: ['dashboard', params], queryFn: () => api.get<Dashboard>('/dashboard', params), placeholderData: keepPreviousData })

export const useCashflow = (params: Params) =>
  useQuery({
    queryKey: ['reports', 'cashflow', params],
    queryFn: () => api.get<{ data: CashflowPoint[] }>('/reports/cashflow', params).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

export const useReportSummary = (params: Params) =>
  useQuery({ queryKey: ['reports', 'summary', params], queryFn: () => api.get<ReportSummary>('/reports/summary', params), placeholderData: keepPreviousData })

export const useBalanceTrend = (params: Params) =>
  useQuery({
    queryKey: ['reports', 'balance', params],
    queryFn: () => api.get<{ data: { period: string; label: string; balance: string }[] }>('/reports/balance-trend', params).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

export const useComparison = (params: Params) =>
  useQuery({
    queryKey: ['reports', 'comparison', params],
    queryFn: () =>
      api
        .get<{ data: { month: number; label: string; income: string; expense: string; prev_income: string; prev_expense: string }[]; year: number }>(
          '/reports/comparison',
          params,
        ),
    placeholderData: keepPreviousData,
  })

export const useBudgets = (month: string) =>
  useQuery({ queryKey: ['budgets', month], queryFn: () => api.get<BudgetMonth>('/budgets', { month }), placeholderData: keepPreviousData })

export const useGoals = () => useQuery({ queryKey: ['goals'], queryFn: () => api.get<{ data: SavingsGoal[] }>('/goals').then((r) => r.data) })
export const useGoal = (id: number | null) =>
  useQuery({ queryKey: ['goal', id], queryFn: () => api.get<{ data: SavingsGoal }>(`/goals/${id}`).then((r) => r.data), enabled: !!id })

export const useDebts = (params: Params = {}) =>
  useQuery({
    queryKey: ['debts', params],
    queryFn: () => api.get<{ data: Debt[]; summary: { debt_remaining: string; receivable_remaining: string; debt_count: number; receivable_count: number; overdue_count: number } }>('/debts', params),
  })
export const useDebt = (id: number | null) =>
  useQuery({ queryKey: ['debt', id], queryFn: () => api.get<{ data: Debt }>(`/debts/${id}`).then((r) => r.data), enabled: !!id })

export const useBills = () => useQuery({ queryKey: ['bills'], queryFn: () => api.get<{ data: Bill[] }>('/bills').then((r) => r.data) })
export const useBill = (id: number | null) =>
  useQuery({ queryKey: ['bill', id], queryFn: () => api.get<{ data: Bill }>(`/bills/${id}`).then((r) => r.data), enabled: !!id })

export const useRecurring = () =>
  useQuery({ queryKey: ['recurring'], queryFn: () => api.get<{ data: Recurring[] }>('/recurring').then((r) => r.data) })

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: AppNotification[]; unread_count: number }>('/notifications'),
    refetchInterval: 120_000,
  })

export const useCalendar = (month: string) =>
  useQuery({
    queryKey: ['calendar', month],
    queryFn: () =>
      api.get<{
        days: Record<string, { income: string; expense: string; count: number }>
        bills: { bill_id: number; name: string; date: string; amount: string; status: 'paid' | 'unpaid' | 'overdue' }[]
      }>('/calendar', { month }),
    placeholderData: keepPreviousData,
  })

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api.get<SearchResults>('/search', { q }, signal),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  })
