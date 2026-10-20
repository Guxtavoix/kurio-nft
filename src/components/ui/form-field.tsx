import { useId, useState, type ReactNode } from 'react'
import eyeHide from '@/assets/icons/eye-hide.svg'
import { cn } from '@/lib/utils'

/**
 * Label + control + error, wired with aria-invalid / aria-describedby.
 * Required fields show the coral asterisk from the layout (also exposed to
 * assistive tech through `required`).
 */
export function FormField({
  label,
  error,
  required,
  hint,
  hideLabel,
  className,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  hint?: string
  hideLabel?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode
}) {
  const id = useId()
  const errId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  // The error message is absolutely positioned in the gap below the control
  // (or over the hint, which keeps its space) so showing/hiding it never
  // shifts the layout — a shift between mousedown and mouseup would make a
  // click on the submit button land elsewhere.
  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-fg text-sm leading-5', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="text-coral ml-0.5 text-base">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, required })}
        {error && (
          <p id={errId} className="text-danger absolute top-full left-0 mt-0.5 text-xs leading-4" role="alert">
            {error}
          </p>
        )}
      </div>
      {hint && (
        <p id={hintId} className={cn('text-text-secondary text-xs leading-4', error && 'invisible')}>
          {hint}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'bg-transparent text-fg placeholder:text-muted-gold h-10 w-full rounded-[5px] border border-line px-4 text-sm outline-none transition-colors focus:border-brand aria-[invalid=true]:border-danger disabled:opacity-60'

export function PasswordInput(props: React.ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(inputClass, 'pr-12', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center"
      >
        <img src={eyeHide} alt="" width={19} height={15} className={cn(visible && 'opacity-50')} />
      </button>
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-danger bg-danger/10 rounded-md px-3 py-2 text-sm">
      {message}
    </p>
  )
}
