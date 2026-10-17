import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar } from '@/lib/queries'
import { formatRupiah, formatMonth, monthKey } from '@/lib/format'
import { Card, Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'

export function CalendarPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const month = React.useMemo(() => monthKey(currentDate), [currentDate])
  const { data } = useCalendar(month)

  const [selectedDay, setSelectedDay] = React.useState<string | null>(null)

  const prevMonth = () => {
    setCurrentDate((d) => {
      const copy = new Date(d)
      copy.setMonth(copy.getMonth() - 1)
      return copy
    })
    setSelectedDay(null)
  }

  const nextMonth = () => {
    setCurrentDate((d) => {
      const copy = new Date(d)
      copy.setMonth(copy.getMonth() + 1)
      return copy
    })
    setSelectedDay(null)
  }

  // Generate calendar days grid
  const daysInMonth = React.useMemo(() => {
    const year = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const firstDayIndex = new Date(year, m, 1).getDay() // 0 = Sunday
    // Adjust for Monday start (1 = Monday, 7 = Sunday)
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1
    const totalDays = new Date(year, m + 1, 0).getDate()

    const days: ({ date: string; dayNum: number; isCurrentMonth: boolean } | null)[] = []
    for (let i = 0; i < offset; i++) {
      days.push(null)
    }
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        date: dStr,
        dayNum: d,
        isCurrentMonth: true,
      })
    }
    return days
  }, [currentDate])

  const daysData = data?.days ?? {}
  const bills = data?.bills ?? []

  const selectedDayData = selectedDay ? daysData[selectedDay] : null
  const selectedDayBills = selectedDay ? bills.filter((b) => b.date === selectedDay) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg">Kalender Keuangan</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Lihat persebaran arus kas masuk & keluar serta jadwal jatuh tempo tagihan setiap hari.
          </p>
        </div>

        {/* Month Switcher */}
        <div className="flex items-center rounded-xl border border-border bg-surface p-1">
          <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-4 text-xs font-bold text-fg tabular min-w-[120px] text-center">
            {formatMonth(month)}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid (2 cols) */}
        <Card className="p-5 lg:col-span-2">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-fg-subtle pb-3 border-b border-border">
            <span>Sen</span>
            <span>Sel</span>
            <span>Rab</span>
            <span>Kam</span>
            <span>Jum</span>
            <span className="text-primary font-bold">Sab</span>
            <span className="text-expense font-bold">Min</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 pt-3">
            {daysInMonth.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-20 sm:h-24 rounded-xl bg-surface-2/30" />
              }

              const dInfo = daysData[day.date]
              const dBills = bills.filter((b) => b.date === day.date)
              const isSelected = selectedDay === day.date

              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDay(day.date)}
                  className={`flex flex-col justify-between rounded-xl border p-1.5 sm:p-2 h-20 sm:h-24 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-soft/40 shadow-sm'
                      : 'border-border bg-surface hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-fg'}`}>
                      {day.dayNum}
                    </span>
                    {dBills.length > 0 && (
                      <span className="size-2 rounded-full bg-warning" title={`${dBills.length} tagihan`} />
                    )}
                  </div>

                  <div className="space-y-0.5 text-[10px] tabular overflow-hidden">
                    {dInfo?.income && Number(dInfo.income) > 0 && (
                      <div className="text-income font-bold truncate">
                        +{formatRupiah(dInfo.income)}
                      </div>
                    )}
                    {dInfo?.expense && Number(dInfo.expense) > 0 && (
                      <div className="text-expense font-bold truncate">
                        -{formatRupiah(dInfo.expense)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Selected Day Details (1 col) */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-fg border-b border-border pb-3">
              {selectedDay ? `Detail Tanggal: ${selectedDay}` : 'Pilih Tanggal'}
            </h3>

            {!selectedDay ? (
              <div className="py-12 text-center text-xs text-fg-muted">
                Klik salah satu tanggal pada kalender untuk melihat rincian aktivitas keuangan pada hari tersebut.
              </div>
            ) : !selectedDayData && selectedDayBills.length === 0 ? (
              <div className="py-12 text-center text-xs text-fg-muted">
                Tidak ada mutasi transaksi atau tagihan pada tanggal ini.
              </div>
            ) : (
              <div className="space-y-4 pt-3">
                {selectedDayData && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                      Arus Kas Hari Ini
                    </span>
                    <div className="rounded-xl border border-border p-3 space-y-2 bg-surface-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-fg-muted">Total Pemasukan:</span>
                        <span className="font-bold tabular text-income">
                          +{formatRupiah(selectedDayData.income)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-fg-muted">Total Pengeluaran:</span>
                        <span className="font-bold tabular text-expense">
                          -{formatRupiah(selectedDayData.expense)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border font-bold">
                        <span>Jumlah Transaksi:</span>
                        <span>{selectedDayData.count} transaksi</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDayBills.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-warning">
                      Tagihan Jatuh Tempo
                    </span>
                    <div className="space-y-2">
                      {selectedDayBills.map((b) => (
                        <div key={b.bill_id} className="rounded-xl border border-border p-3 text-xs flex justify-between items-center">
                          <div>
                            <p className="font-bold text-fg">{b.name}</p>
                            <Badge tone={b.status === 'overdue' ? 'expense' : 'warning'} className="mt-1">
                              {b.status}
                            </Badge>
                          </div>
                          <span className="font-black tabular text-fg">{formatRupiah(b.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
