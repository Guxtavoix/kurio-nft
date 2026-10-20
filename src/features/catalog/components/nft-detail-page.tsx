import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Edition, NftDetail } from '@/api/contracts'
import { errorMessage, toApiError } from '@/api/errors'
import mailIcon from '@/assets/icons/mail.svg'
import linkedinIcon from '@/assets/icons/share-linkedin.svg'
import twitterIcon from '@/assets/icons/share-twitter.svg'
import zoomIcon from '@/assets/icons/zoom.svg'
import { NotFound } from '@/components/feedback/not-found'
import { ErrorState } from '@/components/feedback/states'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftCard } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { RatingStars } from '@/components/nft/rating-stars'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddToCart } from '@/features/cart/queries'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useNftDetail, useRelated } from '../queries'
import { NETWORK_LABELS } from '../search'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const detail = useNftDetail(nftId)

  if (detail.isPending) return <DetailSkeleton />
  if (detail.isError) {
    const err = toApiError(detail.error)
    if (err.code === 'NOT_FOUND') {
      return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo." />
    }
    return (
      <div className="mx-auto max-w-[600px] px-4 py-24">
        <ErrorState
          title="Não foi possível carregar este NFT"
          message={errorMessage(err)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </div>
    )
  }
  return <Detail nft={detail.data} />
}

const editionAvailable = (e: Edition) => e.available > 0
const limitOf = (e: Edition) => Math.min(e.available, e.maxPerOrder)

function Detail({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const router = useRouter()
  const add = useAddToCart()
  const initialEdition =
    nft.editions.find((e) => e.id === nft.defaultEditionId && editionAvailable(e)) ?? nft.editions.find(editionAvailable)
  const [editionId, setEditionId] = useState(initialEdition?.id ?? nft.defaultEditionId)
  const [quantity, setQuantity] = useState(1)
  const [image, setImage] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const limit = limitOf(edition)
  const unavailable = edition.available === 0

  // Realtime: availability may drop while the page is open → clamp quantity.
  useEffect(() => {
    if (limit > 0 && quantity > limit) setQuantity(limit)
  }, [limit, quantity])

  // Realtime: tell the collector when the price of the selected edition changes.
  const lastPrice = useRef(edition.priceEth)
  const [priceNotice, setPriceNotice] = useState<string | null>(null)
  useEffect(() => {
    if (lastPrice.current !== edition.priceEth) {
      const msg = `Preço atualizado: de ${formatEth(lastPrice.current)} para ${formatEth(edition.priceEth)}.`
      setPriceNotice(msg)
      announce(msg)
      lastPrice.current = edition.priceEth
    }
  }, [edition.priceEth])

  const submit = (goToCart: boolean) => {
    setFormError(null)
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (${edition.label}) adicionado ao carrinho`)
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (e) => setFormError(errorMessage(e)),
      },
    )
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const gallery = nft.gallery

  return (
    <>
      {/* Mobile top bar (back + favorite) */}
      <div className="flex items-center justify-between px-6 pt-6 md:hidden">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/' }))}
          className="border-line-soft text-fg grid size-9 place-items-center rounded-full border"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <FavoriteButton nftId={nft.id} name={nft.name} variant="round" />
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 md:pt-8 xl:px-0">
        <nav aria-label="Trilha de navegação" className="text-fg hidden text-sm font-bold md:block">
          <ol className="flex gap-1">
            <li>
              <Link to="/">Início</Link> /
            </li>
            <li>
              <Link to="/" hash="catalogo">
                Mercado
              </Link>
            </li>
          </ol>
        </nav>

        <article className="mt-3 flex flex-col gap-8 lg:flex-row" aria-labelledby="nft-title">
          {/* Gallery */}
          <div className="flex shrink-0 flex-col-reverse gap-4 md:flex-row md:gap-7 lg:w-[573px]">
            <ul className="hidden gap-4 md:flex md:w-[100px] md:flex-col" aria-label="Imagens do NFT">
              {gallery.map((g, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setImage(i)}
                    aria-label={`Mostrar ${g.alt}`}
                    aria-pressed={i === image}
                    className={cn('bg-surface-card block size-[100px] overflow-hidden rounded-lg border', i === image ? 'border-brand' : 'border-transparent')}
                  >
                    <NftImage src={g.src} alt="" sizes="100px" width={100} height={100} className="size-full" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="bg-surface-card relative grid aspect-square w-full place-items-center rounded-md p-4 md:size-[444px]">
              <NftImage
                src={gallery[image]?.src ?? nft.image}
                alt={gallery[image]?.alt ?? nft.imageAlt}
                sizes="(min-width: 768px) 404px, 92vw"
                priority
                width={404}
                height={404}
                className="aspect-square w-full rounded-[24px]"
              />
              <Dialog>
                <DialogTrigger className="absolute top-4 right-4 size-[30px] rounded-full" aria-label="Ampliar imagem">
                  <img src={zoomIcon} alt="" width={30} height={30} />
                </DialogTrigger>
                <DialogContent className="bg-surface-card border-line max-w-[min(92vw,820px)] p-4">
                  <DialogTitle className="sr-only">{nft.name}</DialogTitle>
                  <DialogDescription className="sr-only">{gallery[image]?.alt ?? nft.imageAlt}</DialogDescription>
                  <NftImage
                    src={gallery[image]?.src ?? nft.image}
                    alt={gallery[image]?.alt ?? nft.imageAlt}
                    sizes="(min-width: 820px) 800px, 90vw"
                    width={800}
                    height={800}
                    className="aspect-square w-full rounded-[24px]"
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Details */}
          <div className="bg-surface-card -mx-4 flex min-w-0 flex-1 flex-col gap-5 rounded-t-[32px] px-6 pt-8 pb-32 md:mx-0 md:rounded-none md:bg-transparent md:p-0 md:pb-0 lg:justify-between">
            <header className="flex flex-col gap-3">
              <h1 id="nft-title" className="text-fg text-[22px] font-bold md:text-[28px]">
                {nft.name}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-accent-text text-[22px] leading-4 font-bold" data-testid="detail-price">
                  {formatEth(edition.priceEth)}
                </p>
                <a href="#avaliacoes" className="flex items-center gap-1 text-[15px]">
                  <RatingStars value={nft.rating.average} />
                  <span className="text-fg">{nft.rating.count} avaliações de colecionadores</span>
                </a>
              </div>
              {priceNotice && (
                <p role="status" className="text-accent-text bg-surface-dark rounded-md px-3 py-2 text-sm" data-testid="price-notice">
                  {priceNotice}
                </p>
              )}
              <div aria-hidden className="bg-brand h-[0.3px] w-full" />
            </header>

            <section className="flex flex-col gap-3" aria-labelledby="about-title">
              <h2 id="about-title" className="text-fg text-[15px] leading-4 font-bold">
                Sobre este NFT:
              </h2>
              <p className="text-text-secondary text-sm leading-6">{nft.description}</p>
            </section>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-fg mb-3 text-[15px] leading-4 font-bold">Edição:</legend>
              <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-1.5">
                {nft.editions.map((e) => {
                  const selected = e.id === edition.id
                  const soldOut = e.available === 0
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Edição ${e.label === 'ABERTA' ? 'aberta' : e.label}${soldOut ? ' — esgotada' : ''}, ${formatEth(e.priceEth)}`}
                      onClick={() => {
                        setEditionId(e.id)
                        setQuantity(1)
                        setFormError(null)
                      }}
                      className={cn(
                        'h-7 rounded-full border px-2 text-sm leading-4',
                        selected ? 'border-brand text-accent-text font-medium' : 'border-line text-text-secondary',
                        soldOut && 'line-through opacity-60',
                      )}
                      data-testid={`edition-${e.kind}`}
                    >
                      {e.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-text-secondary text-xs" aria-live="polite" data-testid="edition-availability">
                {unavailable
                  ? 'Edição indisponível: esgotada. Escolha outra edição.'
                  : edition.supply === null
                    ? `Edição aberta · até ${edition.maxPerOrder} por pedido`
                    : `${edition.available} de ${edition.supply} disponíveis · até ${limit} por pedido`}
              </p>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <QuantityStepper
                value={quantity}
                max={Math.max(1, limit)}
                onChange={setQuantity}
                label={`Quantidade (máximo ${limit})`}
                disabled={unavailable}
              />
              <div className="hidden gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={unavailable || add.isPending}
                  className="bg-brand text-ink h-10 w-[130px] rounded-md text-sm leading-5 font-bold disabled:opacity-50"
                  data-testid="buy-button"
                >
                  {add.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
                </button>
                <FavoriteButton nftId={nft.id} name={nft.name} variant="detail" className="h-10 w-[130px]" />
              </div>
            </div>
            {quantity >= limit && !unavailable && (
              <p className="text-text-secondary -mt-2 text-xs" data-testid="quantity-limit">
                Limite de {limit} unidade(s) para esta edição.
              </p>
            )}
            {formError && (
              <p role="alert" className="text-danger text-sm">
                {formError}
              </p>
            )}

            <dl className="text-muted-gold flex flex-col gap-3 text-[15px]">
              <div className="flex gap-1">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Coleção:</dt>
                <dd>{nft.collectionName}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Atributos:</dt>
                <dd>{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-2">
              <p className="text-fg text-[15px] leading-4 font-bold">Compartilhar este NFT:</p>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartilhar no LinkedIn (abre em nova aba)"
              >
                <img src={linkedinIcon} alt="" width={15} height={14} />
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail">
                <img src={mailIcon} alt="" width={18} height={18} />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartilhar no X/Twitter (abre em nova aba)"
              >
                <img src={twitterIcon} alt="" width={16} height={12} />
              </a>
            </div>
          </div>
        </article>

        {/* Mobile sticky purchase bar */}
        <div className="bg-surface-card fixed inset-x-0 bottom-[76px] z-30 flex flex-col gap-3 rounded-t-[24px] px-6 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:hidden">
          <div className="flex items-center justify-between">
            <span className="text-fg text-sm">Qtd.</span>
            <QuantityStepper value={quantity} max={Math.max(1, limit)} onChange={setQuantity} label="Quantidade" size="sm" disabled={unavailable} className="mr-auto ml-3" />
            <span className="text-accent-text text-xl font-bold">{formatEth(edition.priceEth)}</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={unavailable || add.isPending}
              className="from-brand text-ink h-14 flex-1 rounded-full bg-gradient-to-r to-[#b9773f] text-base font-bold disabled:opacity-50"
            >
              Comprar NFT
            </button>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={unavailable || add.isPending}
              className="bg-surface-dark text-accent-text grid size-14 place-items-center rounded-full disabled:opacity-50"
              aria-label="Adicionar ao carrinho"
            >
              <ShoppingCart className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <DetailTabs nft={nft} />
        <Related nftId={nft.id} />
      </div>
    </>
  )
}

function DetailTabs({ nft }: { nft: NftDetail }) {
  return (
    <Tabs defaultValue="detalhes" className="mt-24 hidden md:flex" id="avaliacoes">
      <TabsList className="border-brand/60 h-auto w-full justify-start gap-8 rounded-none border-b-[0.3px] bg-transparent p-0">
        <TabsTrigger
          value="detalhes"
          className="text-fg data-[state=active]:text-accent-text data-[state=active]:border-brand h-auto flex-none rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-3 text-[17px] leading-4 data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:shadow-none"
        >
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger
          value="avaliacoes"
          className="text-fg data-[state=active]:text-accent-text data-[state=active]:border-brand h-auto flex-none rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-3 text-[17px] leading-4 data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:shadow-none"
        >
          Avaliações de colecionadores ({nft.rating.count})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="detalhes" className="text-text-secondary flex flex-col gap-3 pt-3 text-sm leading-6">
        {nft.longDescription.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <h3 className="text-fg font-bold">Rede:</h3>
        <p>Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
        <h3 className="text-fg font-bold">Contrato:</h3>
        <p>
          {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4).toUpperCase()} • Contrato inteligente ERC-721 verificado.
        </p>
        <h3 className="text-fg font-bold">Direitos autorais:</h3>
        <p>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
      </TabsContent>
      <TabsContent value="avaliacoes" className="pt-3">
        <ul className="flex flex-col gap-4">
          {nft.reviews.map((r) => (
            <li key={r.id} className="bg-surface-card rounded-md p-4">
              <div className="flex items-center gap-3">
                <span className="text-fg text-sm font-bold">{r.author}</span>
                <RatingStars value={r.rating} size={13} />
              </div>
              <p className="text-text-secondary mt-2 text-sm leading-6">{r.text}</p>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  )
}

function Related({ nftId }: { nftId: string }) {
  const related = useRelated(nftId)
  const listRef = useRef<HTMLUListElement>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const items = related.data ?? []
  const pages = useMemo(() => Math.max(1, Math.ceil(items.length / 5)), [items.length])

  const goTo = (p: number) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / pages) * p, behavior: 'smooth' })
  }

  if (related.isError || (related.isSuccess && items.length === 0)) return null
  return (
    <section aria-labelledby="related-title" className="mt-24 hidden md:block">
      <h2 id="related-title" className="text-accent-text border-brand/60 border-b-[0.3px] pb-3 text-[17px] leading-4 font-bold">
        Mais desta coleção
      </h2>
      <ul
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setPageIdx(Math.round((el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (pages - 1)))
        }}
        className="mt-8 grid snap-x snap-mandatory auto-cols-[calc((100%-104px)/5)] grid-flow-col gap-[26px] overflow-x-auto pb-2 [scrollbar-width:none]"
      >
        {related.isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} aria-hidden>
                <div className="skeleton-shimmer aspect-[219/250]" />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="snap-start">
                <NftCard nft={n} />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center" role="group" aria-label="Páginas de relacionados">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Página ${i + 1} de relacionados`}
              aria-current={i === pageIdx}
              className="grid size-6 place-items-center"
            >
              <span aria-hidden className={cn('border-brand size-3 rounded-full border', i === pageIdx && 'bg-brand')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-8 xl:px-0" aria-busy="true" aria-label="Carregando NFT">
      <div className="skeleton-shimmer h-4 w-[145px] rounded" />
      <div className="mt-3 flex flex-col gap-8 lg:flex-row">
        <div className="flex gap-7 lg:w-[573px]">
          <div className="hidden flex-col gap-4 md:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton-shimmer size-[100px] rounded-lg" />
            ))}
          </div>
          <div className="skeleton-shimmer aspect-square w-full rounded-md md:size-[444px]" />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="skeleton-shimmer h-8 w-2/3 rounded" />
          <div className="skeleton-shimmer h-6 w-1/4 rounded" />
          <div className="skeleton-shimmer h-[66px] w-full rounded" />
          <div className="skeleton-shimmer h-7 w-[209px] rounded-full" />
          <div className="skeleton-shimmer h-[50px] w-full rounded" />
          <div className="skeleton-shimmer h-[90px] w-[308px] rounded" />
        </div>
      </div>
      {/* Reserve the height of tabs + related so the footer doesn't jump. */}
      <div className="mt-24 hidden h-[340px] md:block" />
      <div className="mt-24 hidden h-[407px] md:block" />
    </div>
  )
}
