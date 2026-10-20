import chevronDown from '@/assets/icons/chevron-down.svg'
import { inputClass } from '@/components/ui/form-field'
import { cn } from '@/lib/utils'

/** Figma "ENS Input": TLD select (78px) + name field. Only ".eth" is supported. */
export function EnsInput({
  id,
  className,
  ...props
}: React.ComponentProps<'input'> & { id: string }) {
  return (
    <div className={cn('flex gap-2.5', className)}>
      <div className="relative w-[78px] shrink-0">
        <select
          aria-label="Domínio ENS"
          className="border-line text-fg h-10 w-full appearance-none rounded-[3px] border bg-transparent pl-2.5 text-[15px]"
          defaultValue=".eth"
        >
          <option value=".eth" className="bg-surface-card">
            .eth
          </option>
        </select>
        <img src={chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute top-2.5 right-2" />
      </div>
      <input id={id} {...props} className={cn(inputClass, 'rounded-[3px]')} autoComplete="off" spellCheck={false} />
    </div>
  )
}
