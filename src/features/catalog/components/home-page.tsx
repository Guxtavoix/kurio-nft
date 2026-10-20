import { useNavigate } from '@tanstack/react-router'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { errorMessage } from '@/api/errors'
import { EmptyState, ErrorState, RefreshingHint } from '@/components/feedback/states'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Pagination } from '@/components/ui/pagination'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { PAGE_SIZE, useFeatured, useNftList } from '../queries'
import { CATEGORY_LABELS, NETWORK_LABELS, toListQuery, type CatalogSearch } from '../search'
import { CatalogFilters } from './catalog-filters'
import { CatalogToolbar } from './catalog-toolbar'
import { HomeHero } from './home-hero'
import { BlogSection, PromoCards, SpotlightBanner } from './home-sections'

export function HomePage({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate()
  const featured = useFeatured()
  const query = toListQuery(search)
  const list = useNftList(query)
  const catalogRef = useRef<HTMLElement>(null)

  /** Filter changes reset pagination; history keeps every state. */
  const update = (patch: Partial<CatalogSearch>, opts: { keepPage?: boolean } = {}) => {
    void navigate({
      to: '/',
      search: (prev: CatalogSearch) => {
        const next = { ...prev, ...patch }
        if (!opts.keepPage) delete next.page
        for (const k of Object.keys(next) as (keyof CatalogSearch)[]) {
          const v = next[k]
          if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete next[k]
        }
        return next
      },
      resetScroll: false,
    })
  }

  const goToPage = (p: number) => {
    update({ page: p > 1 ? p : undefined }, { keepPage: true })
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const data = list.data
  const page = search.page ?? 1
  const showSkeleton = list.isPending
  const activeChips = [
    ...(search.categories ?? []).map((c) => ({ key: `c-${c}`, label: CATEGORY_LABELS[c], remove: () => update({ categories: search.categories!.filter((x) => x !== c) }) })),
    ...(search.networks ?? []).map((n) => ({ key: `n-${n}`, label: NETWORK_LABELS[n], remove: () => update({ networks: search.networks!.filter((x) => x !== n) }) })),
    ...(search.minPrice || search.maxPrice
      ? [{ key: 'price', label: `${search.minPrice ?? '0'} – ${search.maxPrice ?? '∞'} ETH`, remove: () => update({ minPrice: undefined, maxPrice: undefined }) }]
      : []),
    ...(search.q ? [{ key: 'q', label: `“${search.q}”`, remove: () => update({ q: undefined }) }] : []),
  ]

  return (
    <>
      <MobileSearchBar search={search} onSearch={(q) => update({ q })} facets={data?.facets} onChange={update} />
      <HomeHero items={featured.data?.hero} />

      <section
        id="catalogo"
        ref={catalogRef}
        aria-labelledby="catalog-title"
        className="mx-auto mt-10 grid w-full max-w-[1200px] scroll-mt-6 gap-12 px-4 md:mt-24 lg:grid-cols-[310px_1fr] xl:px-0"
      >
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>
        <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros do catálogo">
          <CatalogFilters search={search} facets={data?.facets} onChange={update} />
          <SpotlightBanner nft={featured.data?.spotlight} />
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <CatalogToolbar
            tab={search.tab ?? 'all'}
            sort={search.sort ?? 'recent'}
            onTab={(tab) => update({ tab: tab === 'all' ? undefined : tab })}
            onSort={(sort) => update({ sort: sort === 'recent' ? undefined : sort })}
          />

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.remove}
                  className="border-line-soft text-text-secondary hover:text-fg flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
                  aria-label={`Remover filtro ${c.label}`}
                >
                  {c.label} <X className="size-3" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                className="text-accent-text text-xs underline"
                onClick={() => void navigate({ to: '/', search: {}, resetScroll: false })}
              >
                Limpar filtros
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-text-secondary text-sm" role="status" aria-live="polite" data-testid="result-count">
              {data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : ''}
            </p>
            <RefreshingHint active={list.isFetching && !list.isPending} />
          </div>

          <div id="catalog-results" role="tabpanel" aria-busy={list.isFetching}>
            {list.isError && !data ? (
              <ErrorState
                title="Não foi possível carregar o catálogo"
                message={errorMessage(list.error)}
                onRetry={() => void list.refetch()}
                retrying={list.isFetching}
              />
            ) : showSkeleton ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px]" aria-label="Carregando NFTs">
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                message="Tente remover alguns filtros ou buscar por outro termo."
                action={
                  <button type="button" className="text-accent-text underline" onClick={() => void navigate({ to: '/', search: {} })}>
                    Limpar filtros
                  </button>
                }
              />
            ) : (
              <>
                {list.isError && (
                  <p role="alert" className="text-danger mb-4 text-sm">
                    Não foi possível atualizar: {errorMessage(list.error)}{' '}
                    <button type="button" className="underline" onClick={() => void list.refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                )}
                <ul
                  className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity sm:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px]',
                    list.isPlaceholderData && 'opacity-60',
                  )}
                  data-testid="catalog-grid"
                >
                  {data?.items.map((nft, i) => (
                    <li key={nft.id}>
                      <NftCard nft={nft} priority={i < 3 && page === 1} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {data && <Pagination page={page} totalPages={data.totalPages} onPage={goToPage} className="mt-6" />}
        </div>
      </section>

      <PromoCards />
      <BlogSection />
    </>
  )
}

/** Mobile top bar (Figma Mobile / Início): search field + filters sheet. */
function MobileSearchBar({
  search,
  onSearch,
  facets,
  onChange,
}: {
  search: CatalogSearch
  onSearch: (q: string | undefined) => void
  facets: Parameters<typeof CatalogFilters>[0]['facets']
  onChange: (patch: Partial<CatalogSearch>) => void
}) {
  const id = useId()
  const [value, setValue] = useState(search.q ?? '')
  useEffect(() => setValue(search.q ?? ''), [search.q])
  const activeCount = (search.categories?.length ?? 0) + (search.networks?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)

  return (
    <div className="flex gap-2 px-4 pt-10 md:hidden">
      <form
        role="search"
        className="bg-surface-card flex h-11 flex-1 items-center gap-3 rounded-lg px-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(value.trim() || undefined)
        }}
      >
        <Search className="text-text-secondary size-5" aria-hidden />
        <label htmlFor={id} className="sr-only">
          Explorar coleções
        </label>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          className="text-fg placeholder:text-text-secondary min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
      </form>
      <Sheet>
        <SheetTrigger
          className="bg-brand text-ink relative grid size-11 place-items-center rounded-lg"
          aria-label={`Filtros${activeCount ? ` (${activeCount} ativos)` : ''}`}
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          {activeCount > 0 && (
            <span aria-hidden className="bg-ink text-accent-text absolute -top-1 -right-1 grid size-5 place-items-center rounded-full text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="bg-surface-card max-h-[85dvh] overflow-y-auto rounded-t-[24px] border-0 p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-fg">Filtros</SheetTitle>
            <SheetDescription className="text-text-secondary">Os resultados são atualizados automaticamente.</SheetDescription>
          </SheetHeader>
          <CatalogFilters search={search} facets={facets} onChange={onChange} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
