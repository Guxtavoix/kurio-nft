import { useEffect, useId, useState } from 'react'
import { CATEGORIES, NETWORKS, type Category, type Network, type NftListResponse } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, NETWORK_LABELS, type CatalogSearch } from '../search'

type Facets = NftListResponse['facets']

/** Collections listed alphabetically by their Portuguese label. */
const SORTED_CATEGORIES = [...CATEGORIES].sort((a, b) =>
  CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'pt-BR'),
)

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
        {SORTED_CATEGORIES.map((c) => (
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

/** "1,5" or "1.5" → 1.5; null when not a valid non-negative amount. */
function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d*)?$/.test(t)) return null
  return Math.round(Number(t) * 100) / 100
}

/**
 * Price range: slider plus min/max text fields kept in sync (typing is easier
 * than dragging on touch screens). Applies on "Aplicar" or Enter.
 */
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
  const fromSearch = (): [number, number] => [
    search.minPrice ? Number(search.minPrice) : floor,
    search.maxPrice ? Number(search.maxPrice) : ceil,
  ]
  const [range, setRange] = useState<[number, number]>(fromSearch)
  const [text, setText] = useState<[string, string]>(() => [fmtComma(range[0]), fmtComma(range[1])])
  const [error, setError] = useState<string | null>(null)

  // Keep slider and fields in sync with URL changes (history navigation, reset).
  useEffect(() => {
    const r: [number, number] = [
      search.minPrice ? Number(search.minPrice) : floor,
      search.maxPrice ? Number(search.maxPrice) : ceil,
    ]
    setRange(r)
    setText([fmtComma(r[0]), fmtComma(r[1])])
    setError(null)
  }, [search.minPrice, search.maxPrice, floor, ceil])

  /** Validates the typed values; returns the range or null (and shows why). */
  const readFields = (): [number, number] | null => {
    const min = parseAmount(text[0])
    const max = parseAmount(text[1])
    if (min === null || max === null) {
      setError('Informe valores numéricos, ex.: 0,50')
      return null
    }
    if (min > max) {
      setError('O mínimo não pode ser maior que o máximo')
      return null
    }
    setError(null)
    return [min, max]
  }

  const commitField = () => {
    const r = readFields()
    if (r) setRange([Math.max(floor, Math.min(r[0], ceil)), Math.max(floor, Math.min(r[1], ceil))])
  }

  const apply = () => {
    const r = readFields()
    if (!r) return
    onApply(r[0] > floor ? r[0].toFixed(2) : undefined, r[1] < ceil ? r[1].toFixed(2) : undefined)
  }

  const field = (i: 0 | 1, label: string) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-text-secondary text-xs">{label}</span>
      <span className="border-line focus-within:border-brand flex h-9 items-center gap-1 rounded-md border px-2">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text[i]}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => setText((t) => (i === 0 ? [e.target.value, t[1]] : [t[0], e.target.value]))}
          onBlur={commitField}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitField()
              apply()
            }
          }}
          className="text-fg w-full min-w-0 bg-transparent text-[15px] outline-none"
          data-testid={i === 0 ? 'price-min' : 'price-max'}
        />
        <span aria-hidden className="text-muted-gold text-xs">
          ETH
        </span>
      </span>
    </label>
  )

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
          onValueChange={(v) => {
            setRange([v[0]!, v[1]!])
            setText([fmtComma(v[0]!), fmtComma(v[1]!)])
            setError(null)
          }}
          minStepsBetweenThumbs={1}
          aria-label="Faixa de preço em ETH"
          thumbLabels={['Preço mínimo', 'Preço máximo']}
        />
        <p className="text-fg text-[15px]" aria-live="polite">
          Preço: {fmtComma(range[0])} - {fmtComma(range[1])} ETH
        </p>
        <div className="flex gap-3">
          {field(0, 'Mínimo')}
          {field(1, 'Máximo')}
        </div>
        {error && (
          <p id={`${id}-err`} role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="button" className="h-9 px-3 text-base font-bold" onClick={apply}>
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
