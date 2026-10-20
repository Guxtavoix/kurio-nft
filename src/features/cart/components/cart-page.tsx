import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { CartLine } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import deleteIcon from '@/assets/icons/delete.svg'
import { EmptyState, ErrorState } from '@/components/feedback/states'
import { NftCard } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { useNftList } from '@/features/catalog/queries'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useAcknowledgePrices, useCart, useQuote, useRemoveCartLine, useUpdateCartLine } from '../queries'
import { CouponForm } from './coupon-form'
import { SummaryRows } from './order-summary'

export function CartPage() {
  const cart = useCart()
  const quote = useQuote('ethereum', (cart.data?.lines.length ?? 0) > 0)
  const ack = useAcknowledgePrices()
  const navigate = useNavigate()
  const router = useRouter()

  const lines = cart.data?.lines ?? []
  const changed = lines.filter((l) => l.status === 'price_changed')
  const blocked = lines.filter((l) => l.status === 'sold_out' || l.status === 'insufficient')
  const canCheckout = lines.length > 0 && changed.length === 0 && blocked.length === 0 && quote.data?.purchasable === true

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:pt-8 xl:px-0">
      {/* Mobile title bar */}
      <div className="relative mb-6 flex items-center justify-center md:hidden">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="bg-surface-dark text-fg absolute left-0 grid size-9 place-items-center rounded-full"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-fg text-xl font-bold">Carrinho de NFTs</h1>
      </div>

      <nav aria-label="Trilha de navegação" className="text-fg hidden text-sm font-bold md:block">
        <ol className="flex gap-1">
          <li>
            <Link to="/">Início</Link> /
          </li>
          <li>
            <Link to="/" hash="catalogo">
              Mercado
            </Link>{' '}
            /
          </li>
          <li aria-current="page">Carrinho</li>
        </ol>
      </nav>
      <h1 className="sr-only hidden md:block">Carrinho de NFTs</h1>

      {cart.isError && !cart.data ? (
        <ErrorState
          className="mt-6"
          title="Não foi possível carregar o carrinho"
          message={errorMessage(cart.error)}
          onRetry={() => void cart.refetch()}
          retrying={cart.isFetching}
        />
      ) : cart.isPending ? (
        <CartSkeleton />
      ) : lines.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Seu carrinho está vazio"
          message="Explore o catálogo e adicione NFTs para continuar."
          action={
            <Link to="/" hash="catalogo" className="bg-brand text-ink rounded-md px-4 py-2 font-bold">
              Explorar NFTs
            </Link>
          }
        />
      ) : (
        <div className="mt-3 flex flex-col gap-10 pb-[360px] md:pb-0 lg:flex-row lg:justify-between">
          <section aria-labelledby="cart-items-title" className="min-w-0 flex-1 lg:max-w-[782px]">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>

            {changed.length > 0 && (
              <div role="alert" className="bg-surface-dark border-brand mb-4 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="price-changed-banner">
                <p className="text-fg flex items-start gap-2 text-sm">
                  <AlertTriangle className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
                  O preço de {changed.length === 1 ? '1 item mudou' : `${changed.length} itens mudou`} desde que você o adicionou. Revise os valores antes de
                  finalizar.
                </p>
                <button
                  type="button"
                  className="bg-brand text-ink shrink-0 rounded-md px-3 py-2 text-sm font-bold disabled:opacity-60"
                  disabled={ack.isPending}
                  onClick={() =>
                    ack.mutate(undefined, {
                      onSuccess: () => announce('Novos preços confirmados.'),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Aceitar novos preços
                </button>
              </div>
            )}

            <div className="hidden items-center justify-between pr-6 text-base leading-4 md:flex" aria-hidden>
              <span className="w-[250px] font-bold">NFTs</span>
              <span className="w-[77px] font-medium">Preço</span>
              <span className="w-[75px] font-bold">Edições</span>
              <span className="w-[87px] font-medium">Total</span>
              <span className="w-6" />
            </div>
            <div aria-hidden className="bg-brand mt-3 hidden h-[0.3px] md:block" />
            <ul className="mt-3 flex flex-col gap-3" data-testid="cart-lines">
              {lines.map((line) => (
                <CartRow key={line.id} line={line} />
              ))}
            </ul>
          </section>

          <aside
            aria-labelledby="summary-title"
            className="bg-surface-card fixed inset-x-0 bottom-[76px] z-30 flex flex-col gap-6 rounded-t-[32px] px-6 py-6 md:static md:w-full md:rounded-none md:bg-transparent md:p-0 lg:w-[332px] lg:shrink-0"
          >
            <div className="hidden flex-col gap-3 md:flex">
              <h2 id="summary-title" className="text-fg text-lg leading-4 font-bold">
                Resumo da carteira
              </h2>
              <div aria-hidden className="bg-brand h-[0.3px]" />
            </div>
            <h2 className="sr-only md:hidden">Resumo</h2>
            <CouponForm applied={cart.data.couponCode} />
            {quote.isError ? (
              <p role="alert" className="text-danger text-sm">
                Não foi possível calcular o resumo. {errorMessage(quote.error)}{' '}
                <button type="button" className="underline" onClick={() => void quote.refetch()}>
                  Tentar novamente
                </button>
              </p>
            ) : (
              <SummaryRows quote={quote.data} loading={quote.isPending || (quote.isFetching && !quote.data)} />
            )}
            {quote.data?.issues.some((i) => i.type === 'coupon_expired') && (
              <p role="status" className="text-accent-text text-xs">
                O cupom aplicado expirou e não está sendo considerado.
              </p>
            )}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                disabled={!canCheckout}
                onClick={() => void navigate({ to: '/pagamento' })}
                className="bg-brand text-ink h-14 w-full rounded-full text-[15px] leading-4 font-bold disabled:opacity-50 md:h-10 md:rounded-[3px]"
                data-testid="checkout-button"
                aria-describedby={!canCheckout ? 'checkout-hint' : undefined}
              >
                Conectar e finalizar
              </button>
              {!canCheckout && (
                <p id="checkout-hint" className="text-text-secondary text-center text-xs">
                  {changed.length > 0
                    ? 'Aceite os novos preços para continuar.'
                    : blocked.length > 0
                      ? 'Ajuste ou remova itens indisponíveis para continuar.'
                      : 'Calculando o resumo…'}
                </p>
              )}
              <Link to="/" hash="catalogo" className="text-accent-text hidden text-[15px] md:block">
                Continuar explorando
              </Link>
            </div>
          </aside>
        </div>
      )}

      <AlsoViewed />
    </div>
  )
}

function CartRow({ line }: { line: CartLine }) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  const max = Math.max(1, Math.min(line.maxPerOrder, line.available || line.quantity))
  const busy = update.isPending || remove.isPending

  const setQuantity = (quantity: number) =>
    update.mutate(
      { lineId: line.id, quantity },
      {
        onSuccess: () => announce(`${line.name}: quantidade ${quantity}`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  const status =
    line.status === 'sold_out'
      ? { text: 'Esgotado — remova para continuar', tone: 'text-danger' }
      : line.status === 'insufficient'
        ? { text: `Restam apenas ${line.available}. Reduza a quantidade.`, tone: 'text-danger' }
        : line.status === 'price_changed'
          ? { text: `Preço alterado: era ${formatEth(line.acknowledgedPriceEth)}`, tone: 'text-accent-text' }
          : null

  return (
    <li
      className={cn('bg-surface-card relative rounded-[12px] md:rounded-none', busy && 'opacity-70')}
      data-testid="cart-line"
      data-status={line.status}
      aria-busy={busy}
    >
      <div className="flex items-stretch gap-3 md:min-h-[70px] md:items-center md:justify-between md:gap-0 md:pr-6">
        <div className="flex items-center gap-4 md:w-[250px]">
          <NftImage
            src={line.image}
            alt={line.imageAlt}
            sizes="(min-width: 768px) 70px, 100px"
            width={100}
            height={100}
            className="size-[100px] shrink-0 rounded-l-[12px] md:size-[70px] md:rounded-md"
          />
          <div className="flex min-w-0 flex-col gap-1.5 py-2 leading-4">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="text-fg truncate text-base font-bold hover:underline">
              {line.name}
            </Link>
            <span className="text-muted-gold text-sm md:hidden">Edição: {line.editionLabel === 'ABERTA' ? 'aberta' : line.editionLabel}</span>
            <span className="text-muted-gold hidden text-sm md:inline">
              ID do token: {line.tokenId}
              <span className="sr-only"> · edição {line.editionLabel}</span>
            </span>
            <span className="text-accent-text text-lg font-bold md:hidden">{formatEth(line.lineTotalEth)}</span>
          </div>
        </div>
        <p className="text-text-secondary hidden w-[77px] text-base leading-4 font-bold whitespace-nowrap md:block" data-testid="line-unit-price">
          {formatEth(line.unitPriceEth)}
        </p>
        <div className="ml-auto flex flex-col items-end justify-between py-2 pr-3 md:ml-0 md:w-[75px] md:p-0">
          <QuantityStepper
            value={line.quantity}
            max={max}
            onChange={setQuantity}
            label={`Quantidade de ${line.name}`}
            size="sm"
            disabled={busy || line.status === 'sold_out'}
          />
          <button
            type="button"
            className="md:hidden"
            onClick={() => remove.mutate(line.id, { onSuccess: () => announce(`${line.name} removido do carrinho`) })}
            aria-label={`Remover ${line.name} do carrinho`}
            disabled={busy}
          >
            <img src={deleteIcon} alt="" width={18} height={20} />
          </button>
        </div>
        <p className="text-accent-text hidden w-[87px] text-base leading-4 font-bold whitespace-nowrap md:block" data-testid="line-total">
          {formatEth(line.lineTotalEth)}
        </p>
        <button
          type="button"
          className="hidden size-6 place-items-center md:grid"
          onClick={() =>
            remove.mutate(line.id, {
              onSuccess: () => announce(`${line.name} removido do carrinho`),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
          aria-label={`Remover ${line.name} do carrinho`}
          disabled={busy}
          data-testid="remove-line"
        >
          <img src={deleteIcon} alt="" width={18} height={20} />
        </button>
      </div>
      {status && (
        <p className={cn('px-4 pb-2 text-xs md:pl-[86px]', status.tone)} role="status" data-testid="line-status">
          {status.text}
          {line.status === 'price_changed' && <> · agora {formatEth(line.unitPriceEth)}</>}
        </p>
      )}
    </li>
  )
}

function AlsoViewed() {
  const list = useNftList({ sort: 'popular', pageSize: 5 })
  if (list.isError) return null
  return (
    <section aria-labelledby="also-title" className="mt-24 hidden md:block">
      <h2 id="also-title" className="text-accent-text border-brand/60 border-b-[0.3px] pb-3 text-[17px] leading-4 font-bold">
        Colecionadores também viram
      </h2>
      <ul className="mt-8 grid grid-cols-5 gap-[26px]">
        {list.isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} aria-hidden>
                <div className="skeleton-shimmer aspect-[219/255]" />
              </li>
            ))
          : list.data.items.map((n) => (
              <li key={n.id}>
                <NftCard nft={n} />
              </li>
            ))}
      </ul>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-10 lg:flex-row lg:justify-between" aria-busy="true" aria-label="Carregando carrinho">
      <div className="flex flex-1 flex-col gap-3 lg:max-w-[782px]">
        <div className="skeleton-shimmer h-4 w-full rounded" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton-shimmer h-[100px] md:h-[70px]" />
        ))}
      </div>
      <div className="flex flex-col gap-6 lg:w-[332px]">
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
        <div className="skeleton-shimmer h-10 w-full rounded" />
        <div className="skeleton-shimmer h-[150px] w-full rounded" />
        <div className="skeleton-shimmer h-10 w-full rounded" />
      </div>
    </div>
  )
}
