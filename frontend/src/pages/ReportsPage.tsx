import * as React from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { useCashflow, useBalanceTrend, useReportSummary, useComparison } from '@/lib/queries'
import { formatRupiah, formatRupiahCompact } from '@/lib/format'
import { Card, Skeleton, Segmented } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'

export function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState<'cashflow' | 'balance' | 'categories' | 'comparison'>('cashflow')
  const [year, setYear] = React.useState<number>(new Date().getFullYear())

  // Queries
  const { data: cashflow = [], isLoading: cfLoading } = useCashflow({ interval: 'month' })
  const { data: balanceTrend = [], isLoading: btLoading } = useBalanceTrend({ months: 6 })
  const { data: summary, isLoading: sumLoading } = useReportSummary({})
  const { data: comparisonData, isLoading: cmpLoading } = useComparison({ year })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Laporan & Analitik Keuangan</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Visualisasikan tren pendapatan, pengeluaran, dan evolusi aset bersih Anda.
          </p>
        </div>

        <div className="flex justify-start sm:justify-end">
          <Segmented
            value={activeTab}
            onChange={(t) => setActiveTab(t)}
            options={[
              { value: 'cashflow', label: 'Arus Kas' },
              { value: 'balance', label: 'Tren Kekayaan' },
              { value: 'categories', label: 'Kategori' },
              { value: 'comparison', label: 'Tahunan' },
            ]}
          />
        </div>
      </div>

      {/* Tab 1: Cashflow */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-fg mb-1">Arus Kas Bulanan (Pemasukan vs Pengeluaran)</h2>
            <p className="text-xs text-fg-muted mb-6">
              Perbandingan total uang masuk dan uang keluar yang tercatat setiap bulan.
            </p>

            {cfLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflow} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="var(--fg-subtle)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatRupiahCompact(v)}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatRupiah(value),
                        name === 'income' ? 'Pemasukan' : 'Pengeluaran',
                      ]}
                      labelFormatter={(label) => `Periode: ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--fg)',
                      }}
                    />
                    <Legend
                      formatter={(v) => (v === 'income' ? 'Pemasukan' : 'Pengeluaran')}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                    <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Balance Trend */}
      {activeTab === 'balance' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-fg mb-1">Pertumbuhan Kekayaan Bersih (Net Worth)</h2>
            <p className="text-xs text-fg-muted mb-6">
              Akumulasi saldo kas dan tabungan dari waktu ke waktu.
            </p>

            {btLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="var(--fg-subtle)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatRupiahCompact(v)}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatRupiah(value), 'Saldo Total']}
                      labelFormatter={(label) => `Bulan: ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--fg)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorBalance)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: Categories Breakdown */}
      {activeTab === 'categories' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Expenses Breakdown */}
          <Card className="p-6">
            <h2 className="text-base font-bold text-fg mb-1">Komposisi Pengeluaran</h2>
            <p className="text-xs text-fg-muted mb-4">Distribusi pengeluaran berdasarkan pos kategori.</p>

            {sumLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : summary?.expense_by_category && summary.expense_by_category.length > 0 ? (
              <div className="space-y-4">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.expense_by_category}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {summary.expense_by_category.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatRupiah(value), 'Nominal']}
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--fg)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="divide-y divide-border pt-2">
                  {summary.expense_by_category.map((c) => (
                    <div key={c.category_id ?? c.name} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="font-semibold text-fg">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="tabular font-bold text-fg">{formatRupiah(c.total)}</span>
                        <span className="ml-2 text-fg-subtle">({c.percent}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-fg-muted">Belum ada pengeluaran tercatat.</div>
            )}
          </Card>

          {/* Income Breakdown */}
          <Card className="p-6">
            <h2 className="text-base font-bold text-fg mb-1">Sumber Pemasukan</h2>
            <p className="text-xs text-fg-muted mb-4">Distribusi sumber pendapatan dan hasil investasi.</p>

            {sumLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : summary?.income_by_category && summary.income_by_category.length > 0 ? (
              <div className="space-y-4">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.income_by_category}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {summary.income_by_category.map((entry, index) => (
                          <Cell key={`cell-inc-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatRupiah(value), 'Nominal']}
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--fg)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="divide-y divide-border pt-2">
                  {summary.income_by_category.map((c) => (
                    <div key={c.category_id ?? c.name} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="font-semibold text-fg">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="tabular font-bold text-fg">{formatRupiah(c.total)}</span>
                        <span className="ml-2 text-fg-subtle">({c.percent}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-fg-muted">Belum ada pemasukan tercatat.</div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Yearly Comparison */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-fg">Perbandingan Pengeluaran Antartahun</h2>
                <p className="text-xs text-fg-muted mt-0.5">
                  Tinjau kinerja per bulan pada tahun {year} dibandingkan tahun {year - 1}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setYear((y) => y - 1)}>
                  Tahun {year - 1}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setYear((y) => y + 1)}>
                  Tahun {year + 1}
                </Button>
              </div>
            </div>

            {cmpLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData?.data ?? []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="var(--fg-subtle)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatRupiahCompact(v)}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatRupiah(value),
                        name === 'expense' ? `Pengeluaran ${year}` : `Pengeluaran ${year - 1}`,
                      ]}
                      labelFormatter={(label) => `Bulan: ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--fg)',
                      }}
                    />
                    <Legend
                      formatter={(v) => (v === 'expense' ? `Tahun ${year}` : `Tahun ${year - 1}`)}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                    <Bar dataKey="expense" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="prev_expense" fill="var(--fg-subtle)" opacity={0.4} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
