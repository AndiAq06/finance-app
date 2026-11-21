import * as React from 'react'
import {
  Tag, PlusCircle, Edit2, Trash2, Search, ArrowDownRight, ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { useCategories, useFinanceMutation } from '@/lib/queries'
import { api } from '@/lib/api'
import { Card, Badge, Skeleton, Segmented } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { IconBadge, IconPicker, ColorPicker } from '@/components/ui/icons'
import type { Category, CategoryType } from '@/types'

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()

  const [activeTab, setActiveTab] = React.useState<'all' | 'expense' | 'income'>('all')
  const [search, setSearch] = React.useState('')
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editCategory, setEditCategory] = React.useState<Category | null>(null)
  const [deleteCategory, setDeleteCategory] = React.useState<Category | null>(null)

  // Form states
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<CategoryType>('expense')
  const [icon, setIcon] = React.useState('tag')
  const [color, setColor] = React.useState('#16A34A')

  React.useEffect(() => {
    if (editCategory) {
      setName(editCategory.name)
      setType(editCategory.type)
      setIcon(editCategory.icon || 'tag')
      setColor(editCategory.color || '#16A34A')
    } else {
      setName('')
      setType('expense')
      setIcon('tag')
      setColor('#16A34A')
    }
  }, [editCategory, modalOpen])

  const saveMutation = useFinanceMutation(
    async () => {
      const payload = {
        name: name.trim(),
        type,
        icon,
        color,
      }
      if (editCategory) {
        return api.put(`/categories/${editCategory.id}`, payload)
      }
      return api.post('/categories', payload)
    },
    {
      success: editCategory ? 'Kategori berhasil diperbarui' : 'Kategori baru berhasil ditambahkan',
      onSuccess: () => setModalOpen(false),
    },
  )

  const deleteMutation = useFinanceMutation(
    (id: number) => api.del(`/categories/${id}`),
    {
      success: 'Kategori berhasil dihapus',
      onSuccess: () => setDeleteCategory(null),
    },
  )

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const incomeCategories = categories.filter((c) => c.type === 'income')

  const filteredCategories = React.useMemo(() => {
    let list = categories
    if (activeTab === 'expense') {
      list = expenseCategories
    } else if (activeTab === 'income') {
      list = incomeCategories
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }

    return list
  }, [categories, activeTab, search, expenseCategories, incomeCategories])

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-fg truncate">
              Kategori Transaksi
            </h1>
            <Badge tone="primary" className="text-xs shrink-0 gap-1">
              <Sparkles className="size-3" /> Kelola Pos
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-fg-muted mt-0.5">
            Kelola dan tambah kategori pemasukan & pengeluaran sesuka Anda untuk mempermudah pencatatan keuangan.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditCategory(null)
            setModalOpen(true)
          }}
          className="gap-1.5 justify-center h-10 w-full sm:w-auto shadow-sm text-xs sm:text-sm shrink-0"
        >
          <PlusCircle className="size-4" /> Tambah Kategori
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 min-w-0">
        <Card className="p-3 sm:p-5 min-w-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate block">
            Total Kategori
          </span>
          <p className="mt-1 sm:mt-2 text-lg sm:text-3xl font-black tabular text-fg truncate">
            {categories.length}
          </p>
          <span className="text-[10px] sm:text-xs text-fg-muted mt-0.5 block truncate">
            Semua pos transaksi
          </span>
        </Card>

        <Card className="p-3 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate block">
              Pengeluaran
            </span>
            <span className="grid size-5 sm:size-7 place-items-center rounded-lg bg-expense-soft text-expense shrink-0">
              <ArrowUpRight className="size-3 sm:size-4" />
            </span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-3xl font-black tabular text-expense truncate">
            {expenseCategories.length}
          </p>
          <span className="text-[10px] sm:text-xs text-fg-muted mt-0.5 block truncate">
            Pos biaya belanja
          </span>
        </Card>

        <Card className="p-3 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-fg-subtle truncate block">
              Pemasukan
            </span>
            <span className="grid size-5 sm:size-7 place-items-center rounded-lg bg-income-soft text-income shrink-0">
              <ArrowDownRight className="size-3 sm:size-4" />
            </span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-3xl font-black tabular text-income truncate">
            {incomeCategories.length}
          </p>
          <span className="text-[10px] sm:text-xs text-fg-muted mt-0.5 block truncate">
            Pos pendapatan
          </span>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <Card className="p-3 sm:p-4 space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="Cari kategori (makanan, gaji, transport...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="overflow-x-auto pb-0.5 shrink-0 scrollbar-none">
            <Segmented
              size="sm"
              value={activeTab}
              onChange={(t) => setActiveTab(t)}
              options={[
                { value: 'all', label: `Semua (${categories.length})` },
                { value: 'expense', label: `Pengeluaran (${expenseCategories.length})` },
                { value: 'income', label: `Pemasukan (${incomeCategories.length})` },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center min-w-0">
          <Tag className="mx-auto size-10 sm:size-12 text-fg-muted mb-3" />
          <p className="font-bold text-fg">Tidak ada kategori ditemukan</p>
          <p className="text-xs text-fg-muted mt-1">
            {search.trim()
              ? 'Tidak ada kategori yang cocok dengan kata kunci pencarian.'
              : 'Belum ada kategori untuk tipe ini. Silakan buat kategori baru.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditCategory(null)
              setModalOpen(true)
            }}
            className="mt-4 gap-1.5"
          >
            <PlusCircle className="size-3.5" /> Tambah Kategori
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
          {filteredCategories.map((c) => {
            const isExpense = c.type === 'expense'
            return (
              <Card
                key={c.id}
                className="p-3.5 sm:p-4 flex flex-col justify-between transition-all hover:border-border-strong min-w-0"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <IconBadge icon={c.icon} color={c.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm sm:text-base text-fg leading-tight truncate">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          tone={isExpense ? 'expense' : 'income'}
                          className="text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-semibold"
                        >
                          {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                        </Badge>
                        {!c.is_default && (
                          <Badge tone="neutral" className="text-[10px] px-1.5 py-0.5">
                            Kustom
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditCategory(c)
                        setModalOpen(true)
                      }}
                      title="Edit Kategori"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      onClick={() => setDeleteCategory(c)}
                      title="Hapus Kategori"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px] sm:text-xs text-fg-muted">
                  <span>Digunakan pada:</span>
                  <span className="font-semibold text-fg tabular">
                    {c.transactions_count ?? 0} transaksi
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Add / Edit Category */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
          size="md"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!name.trim()}
                onClick={() => saveMutation.mutate(undefined)}
              >
                {editCategory ? 'Simpan Perubahan' : 'Buat Kategori'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            {/* Live Preview Card */}
            <div className="rounded-xl border border-border bg-surface-2 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <IconBadge icon={icon} color={color} size="md" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-fg-subtle block">Preview Tampilan</span>
                  <p className="font-bold text-sm text-fg truncate">
                    {name.trim() || 'Nama Kategori'}
                  </p>
                </div>
              </div>
              <Badge tone={type === 'expense' ? 'expense' : 'income'} className="text-[10px] uppercase shrink-0">
                {type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
              </Badge>
            </div>

            <Field label="Nama Kategori" required>
              <Input
                placeholder="mis. Hobi & Game, Kopi & Cafe, Bonus, dsb"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Tipe Pos Kategori" required>
              <Select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
                <option value="expense">Pengeluaran (Uang Keluar)</option>
                <option value="income">Pemasukan (Uang Masuk)</option>
              </Select>
            </Field>

            <Field label="Pilih Ikon Kategori">
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </Field>

            <Field label="Pilih Warna Kategori">
              <ColorPicker value={color} onChange={setColor} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Category */}
      <ConfirmDialog
        open={deleteCategory !== null}
        onOpenChange={(o) => !o && setDeleteCategory(null)}
        title="Hapus Kategori?"
        description={
          deleteCategory?.transactions_count && deleteCategory.transactions_count > 0
            ? `Kategori "${deleteCategory.name}" terhubung ke ${deleteCategory.transactions_count} transaksi. Jika dihapus, transaksi tersebut tetap aman namun tidak memiliki kategori.`
            : `Kategori "${deleteCategory?.name}" akan dihapus secara permanen.`
        }
        confirmLabel="Hapus Kategori"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
      />
    </div>
  )
}
