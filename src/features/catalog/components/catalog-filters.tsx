import { useEffect, useId, useState } from 'react'
import { CATEGORIES, NETWORKS, type Category, type Network, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, NETWORK_LABELS, type CatalogSearch } from '../search'

type Facets = NftListResponse['facets']

/**
 * Sidebar filters (Figma "Filters", 310px). Collections and networks are
 * multi-select and apply immediately; the price range applies on "Aplicar".
 * Every change resets pagination (handled by the caller).
 */
export function CatalogFilters({
  search,
  facets,
  onChange,
  className,
}: {
  search: CatalogSearch
  facets: Facets | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  className?: string
}) {
  const toggle = <T extends string>(list: T[] | undefined, v: T) =>
    list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]

  const count = (kind: 'categories' | 'networks', v: string) =>
    facets?.[kind].find((f) => f.value === v)?.count

  return (
    <div className={cn('bg-surface-card flex flex-col gap-10 p-5', className)} data-testid="catalog-filters">
      <FilterGroup title="Coleções">
        {CATEGORIES.map((c) => (
          <CheckRow
            key={c}
            label={CATEGORY_LABELS[c]}
            count={count('categories', c)}
            checked={search.categories?.includes(c) ?? false}
            onChange={() => onChange({ categories: toggle<Category>(search.categories, c) })}
            boldCount
          />
        ))}
      </FilterGroup>

      <PriceFilter search={search} facets={facets} onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })} />

      <FilterGroup title="Rede">
        {NETWORKS.map((n) => (
          <CheckRow
            key={n}
            label={NETWORK_LABELS[n]}
            count={count('networks', n)}
            checked={search.networks?.includes(n) ?? false}
            onChange={() => onChange({ networks: toggle<Network>(search.networks, n) })}
          />
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-3" aria-labelledby={id}>
      <legend id={id} className="text-fg mb-3 text-lg leading-4 font-bold">
        {title}
      </legend>
      <div className="flex flex-col px-3">{children}</div>
    </fieldset>
  )
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
  boldCount,
}: {
  label: string
  count: number | undefined
  checked: boolean
  onChange: () => void
  boldCount?: boolean
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center justify-between text-[15px] leading-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--kurio-accent)]',
        checked ? 'text-accent-text' : 'text-text-secondary hover:text-fg',
      )}
    >
      <span className="flex items-center gap-2">
        <input type="checkbox" className="peer input-overlay" checked={checked} onChange={onChange} />
        <span
          aria-hidden
          className={cn('size-2 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-transparent')}
        />
        {label}
      </span>
      <span className={cn('text-right', boldCount && 'font-bold')}>
        {count === undefined ? '' : `(${count})`}
        <span className="sr-only"> itens</span>
      </span>
    </label>
  )
}

function fmtComma(v: number) {
  return v.toFixed(2).replace('.', ',')
}

function PriceFilter({
  search,
  facets,
  onApply,
}: {
  search: CatalogSearch
  facets: Facets | undefined
  onApply: (min: string | undefined, max: string | undefined) => void
}) {
  const id = useId()
  const lo = Number(facets?.priceRange.min ?? 0)
  const hi = Number(facets?.priceRange.max ?? 15)
  const floor = Math.floor(lo * 100) / 100
  const ceil = Math.ceil(hi * 100) / 100
  const [range, setRange] = useState<[number, number]>([
    search.minPrice ? Number(search.minPrice) : floor,
    search.maxPrice ? Number(search.maxPrice) : ceil,
  ])

  // Keep the slider in sync with URL changes (history navigation, reset).
  useEffect(() => {
    setRange([search.minPrice ? Number(search.minPrice) : floor, search.maxPrice ? Number(search.maxPrice) : ceil])
  }, [search.minPrice, search.maxPrice, floor, ceil])

  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby={id}>
      <h3 id={id} className="text-fg text-lg leading-4 font-bold">
        Faixa de preço
      </h3>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          min={floor}
          max={ceil}
          step={0.01}
          value={range}
          onValueChange={(v) => setRange([v[0]!, v[1]!])}
          minStepsBetweenThumbs={1}
          aria-label="Faixa de preço em ETH"
          thumbLabels={['Preço mínimo', 'Preço máximo']}
        />
        <p className="text-fg text-[15px]" aria-live="polite">
          Preço: {fmtComma(range[0])} - {fmtComma(range[1])} ETH
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="h-9 px-3 text-base font-bold"
            onClick={() =>
              onApply(
                range[0] > floor ? range[0].toFixed(2) : undefined,
                range[1] < ceil ? range[1].toFixed(2) : undefined,
              )
            }
          >
            Aplicar
          </Button>
          {(search.minPrice || search.maxPrice) && (
            <button type="button" className="text-accent-text text-sm underline" onClick={() => onApply(undefined, undefined)}>
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
