import { AlertTriangle, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
  retrying,
  className,
}: {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('bg-surface-card flex flex-col items-center gap-4 rounded-lg p-8 text-center', className)}>
      <AlertTriangle className="text-accent-text size-8" aria-hidden />
      <h2 className="text-fg text-lg font-bold">{title}</h2>
      <p className="text-text-secondary max-w-prose text-sm leading-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying}>
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string
  message?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div role="status" className={cn('bg-surface-card flex flex-col items-center gap-4 rounded-lg p-8 text-center', className)}>
      <SearchX className="text-accent-text size-8" aria-hidden />
      <h2 className="text-fg text-lg font-bold">{title}</h2>
      {message && <p className="text-text-secondary max-w-prose text-sm leading-6">{message}</p>}
      {action}
    </div>
  )
}

/** Small inline indicator for background refetches (no layout shift). */
export function RefreshingHint({ active }: { active: boolean }) {
  return (
    <span aria-live="polite" className={cn('text-text-secondary text-xs transition-opacity', active ? 'opacity-100' : 'opacity-0')}>
      {active ? 'Atualizando…' : ''}
    </span>
  )
}
