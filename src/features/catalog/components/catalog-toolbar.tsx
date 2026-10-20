import { NFT_SORTS, NFT_TABS, type NftSort, type NftTab } from '@/api/contracts'
import arrowDown from '@/assets/icons/arrow-down.svg'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SORT_LABELS, TAB_LABELS } from '../search'

/** Tabs (Todos / Novos lançamentos / Em alta) + sort select (Figma "Toolbar"). */
export function CatalogToolbar({
  tab,
  sort,
  onTab,
  onSort,
}: {
  tab: NftTab
  sort: NftSort
  onTab: (t: NftTab) => void
  onSort: (s: NftSort) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div role="tablist" aria-label="Filtrar listagem" className="flex gap-5 overflow-x-auto text-[15px] leading-4 font-medium">
        {NFT_TABS.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls="catalog-results"
              onClick={() => onTab(t)}
              className={cn(
                'flex shrink-0 flex-col gap-1.5 whitespace-nowrap',
                active ? 'text-accent-text' : 'text-fg hover:text-accent-text',
              )}
            >
              {TAB_LABELS[t]}
              <span aria-hidden className={cn('h-0.5 w-full', active ? 'bg-brand' : 'bg-transparent')} />
            </button>
          )
        })}
      </div>
      <div className="hidden items-center gap-1 text-[15px] md:flex">
        <span id="sort-label" className="text-fg">
          Ordenar por:
        </span>
        <Select value={sort} onValueChange={(v) => onSort(v as NftSort)}>
          <SelectTrigger
            aria-labelledby="sort-label"
            className="text-fg h-auto gap-2 border-0 bg-transparent p-0 text-[15px] shadow-none [&>svg]:hidden"
            data-testid="sort-select"
          >
            <SelectValue />
            <img src={arrowDown} alt="" width={11} height={6} />
          </SelectTrigger>
          <SelectContent align="end">
            {NFT_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
