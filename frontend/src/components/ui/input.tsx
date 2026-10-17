import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAmountInput, parseAmountInput } from '@/lib/format'

const fieldBase =
  'w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-expense aria-[invalid=true]:focus:ring-expense/20'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, 'min-h-[76px] py-2', className)} {...props} />,
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </div>
  ),
)
Select.displayName = 'Select'

/** Input nominal Rupiah: menampilkan pemisah ribuan, nilai yang dikirim berupa string desimal. */
export const AmountInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValueChange: (v: string) => void; large?: boolean }
>(({ value, onValueChange, className, large, ...props }, ref) => (
  <div className="relative">
    <span className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-fg-subtle', large ? 'text-lg' : 'text-sm')}>Rp</span>
    <input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      className={cn(fieldBase, 'tabular pl-10', large ? 'h-14 text-2xl font-bold' : 'h-10', className)}
      value={formatAmountInput(value)}
      onChange={(e) => onValueChange(parseAmountInput(e.target.value))}
      {...props}
    />
  </div>
))
AmountInput.displayName = 'AmountInput'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-semibold text-fg', className)} {...props} />
}

/** Bungkus label + kontrol + pesan error/hint agar validasi tampil dekat input. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-expense" aria-hidden>*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="mt-1.5 text-xs font-medium text-expense">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
