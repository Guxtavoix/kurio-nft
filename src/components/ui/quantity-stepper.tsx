import minusIcon from '@/assets/icons/minus.svg'
import plusIcon from '@/assets/icons/plus.svg'
import { cn } from '@/lib/utils'

/**
 * Figma "Add Button" pair around the quantity. Accessible as a group with
 * labelled buttons; the value is announced via aria-live.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'lg',
  disabled,
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  size?: 'lg' | 'sm'
  disabled?: boolean
  className?: string
}) {
  const btn =
    size === 'lg'
      ? 'h-[49.5px] w-[33px] rounded-[33px] border border-ink shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]'
      : 'h-[26px] w-[18px] rounded-[18px]'
  const icon = size === 'lg' ? 26 : 16
  return (
    <div role="group" aria-label={label} className={cn('flex items-center', size === 'lg' ? 'gap-3' : 'gap-2', className)}>
      <button
        type="button"
        className={cn('bg-brand grid place-items-center disabled:opacity-40', btn)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <img src={minusIcon} alt="" width={icon} height={icon} />
      </button>
      <output
        aria-live="polite"
        className={cn('text-fg min-w-[1.5ch] text-center', size === 'lg' ? 'text-xl leading-7' : 'text-base')}
        data-testid="quantity-value"
      >
        {value}
      </output>
      <button
        type="button"
        className={cn('bg-brand grid place-items-center disabled:opacity-40', btn)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <img src={plusIcon} alt="" width={icon} height={icon} />
      </button>
    </div>
  )
}
