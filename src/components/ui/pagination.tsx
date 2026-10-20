import arrowRight from '@/assets/icons/arrow-right.svg'
import { cn } from '@/lib/utils'

/** Pages to show: first, last, current ±1, with gaps as "…". */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total))
  const pages = [...set].sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1]! > 1) out.push('gap')
    out.push(p)
  })
  return out
}

/** Figma "Pagination": 35px squares, active filled with primary. */
export function Pagination({
  page,
  totalPages,
  onPage,
  className,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const cell = 'grid size-[35px] place-items-center rounded-sm text-lg leading-4'
  return (
    <nav aria-label="Paginação" className={cn('flex justify-end', className)}>
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" onClick={() => onPage(page - 1)} aria-label="Página anterior" className={cn(cell, 'border border-line')}>
              <img src={arrowRight} alt="" width={12} height={7} className="rotate-90" />
            </button>
          </li>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="text-text-secondary px-1">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                className={cn(cell, p === page ? 'bg-brand text-ink font-bold' : 'text-fg border border-line hover:border-brand')}
              >
                {p}
              </button>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <button type="button" onClick={() => onPage(page + 1)} aria-label="Próxima página" className={cn(cell, 'border border-line')}>
              <img src={arrowRight} alt="" width={12} height={7} className="-rotate-90" />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
