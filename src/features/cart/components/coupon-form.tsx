import { useId, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, toApiError } from '@/api/errors'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from '../queries'

/** Figma "Promo Code": input + Aplicar; shows the applied code with remove. */
export function CouponForm({ applied, variant = 'desktop' }: { applied: string | null; variant?: 'desktop' | 'mobile' }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2" data-testid="coupon-applied">
        <p className="text-fg text-sm">
          Cupom <strong className="text-accent-text">{applied}</strong> aplicado
        </p>
        <button
          type="button"
          className="text-accent-text text-sm underline disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => toast.success('Cupom removido'),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          {remove.isPending ? 'Removendo…' : 'Remover cupom'}
        </button>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const value = code.trim()
        if (!value) {
          setError('Informe o código promocional.')
          return
        }
        setError(null)
        apply.mutate(value, {
          onSuccess: () => {
            setCode('')
            toast.success(`Cupom ${value.toUpperCase()} aplicado`)
          },
          onError: (err) => {
            const e = toApiError(err)
            setError(e.fieldErrors.code ? `${e.message}.` : errorMessage(e))
          },
        })
      }}
    >
      <label htmlFor={id} className={cn('text-fg text-sm leading-4 font-bold', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex h-10 items-center pl-2',
          variant === 'desktop' ? 'border-brand rounded-[3px] border' : 'bg-surface-dark h-12 rounded-full pl-4',
          error && 'border-danger',
        )}
      >
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          autoComplete="off"
          className="text-fg placeholder:text-muted-gold min-w-0 flex-1 bg-transparent text-xs leading-4 outline-none"
          data-testid="coupon-input"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'bg-brand text-ink h-full w-[102px] text-[15px] leading-4 font-bold disabled:opacity-60',
            variant === 'desktop' ? 'rounded-r-[3px]' : 'rounded-full',
          )}
        >
          {apply.isPending ? '…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </form>
  )
}
