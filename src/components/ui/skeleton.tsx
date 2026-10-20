import { cn } from '@/lib/utils'

/** Shimmering placeholder. Size it like the content it replaces (no CLS). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('skeleton-shimmer rounded-md', className)} {...props} />
}

export { Skeleton }
