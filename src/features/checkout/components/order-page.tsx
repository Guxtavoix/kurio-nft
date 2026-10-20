import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Order } from '@/api/contracts'
import { errorMessage, toApiError } from '@/api/errors'
import closeIcon from '@/assets/icons/close.svg'
import thankYou from '@/assets/icons/thank-you.svg'
import { NotFound } from '@/components/feedback/not-found'
import { ErrorState } from '@/components/feedback/states'
import { NftImage } from '@/components/nft/nft-image'
import { WALLET_TYPE_LABELS } from '@/features/account/components/wallet-fields'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { announce } from '@/lib/announcer'
import { eth, formatEth } from '@/lib/eth'
import { useRealtimeStatus } from '@/realtime/hooks'
import { clearCheckoutAttempt, useOrder } from '../queries'

const EXPLORER_NAME = { ethereum: 'Etherscan', polygon: 'Polygonscan', solana: 'Solana Explorer' } as const

/**
 * Order status page. The receipt is rendered only for orders the API
 * reports as confirmed, and always from the order snapshot (catalog changes
 * after the purchase never affect it). Pending orders recover after refresh
 * or reconnection via REST + order.updated.
 */
export function OrderPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)
  const status = order.data?.status
  const previous = useRef(status)

  useEffect(() => {
    if (status && previous.current === 'pending' && status !== 'pending') {
      announce(status === 'confirmed' ? 'Pagamento confirmado. Seus NFTs estão na sua carteira.' : 'Pagamento recusado.', 'assertive')
    }
    if (status && status !== 'pending') clearCheckoutAttempt()
    previous.current = status
  }, [status])

  if (order.isPending) return <Shell><PendingView /></Shell>
  if (order.isError) {
    if (toApiError(order.error).code === 'NOT_FOUND') return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />
    return (
      <div className="mx-auto max-w-[600px] px-4 py-24">
        <ErrorState message={errorMessage(order.error)} onRetry={() => void order.refetch()} retrying={order.isFetching} />
      </div>
    )
  }
  const o = order.data
  return (
    <Shell>
      {o.status === 'pending' ? <PendingView order={o} /> : o.status === 'confirmed' ? <Receipt order={o} /> : <Declined order={o} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-10 md:py-[140px]">
      <div className="bg-surface-card relative w-full max-w-[578px] overflow-hidden" data-testid="order-panel">
        {children}
        <div aria-hidden className="bg-brand h-2" />
      </div>
    </div>
  )
}

function CloseLink() {
  return (
    <Link to="/" className="absolute top-3 right-4 grid size-8 place-items-center" aria-label="Fechar e voltar ao início">
      <img src={closeIcon} alt="" width={18} height={18} />
    </Link>
  )
}

function PendingView({ order }: { order?: Order }) {
  const rt = useRealtimeStatus()
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-14 text-center" role="status" aria-live="polite" data-testid="order-pending">
      <Loader2 className="text-accent-text size-12 animate-spin" aria-hidden />
      <h1 className="text-fg text-lg font-bold">Pagamento em processamento</h1>
      <p className="text-text-secondary text-sm leading-6">
        Estamos aguardando a confirmação da rede{order ? ` ${NETWORK_LABELS[order.snapshot.network]}` : ''}. Você pode atualizar ou fechar
        esta página — o pedido continua sendo processado e nenhuma nova compra será criada.
      </p>
      {order && <p className="text-muted-gold font-mono text-xs">Pedido {order.id}</p>}
      {rt !== 'connected' && (
        <p className="text-accent-text text-xs">Sem conexão em tempo real — verificando o status periodicamente.</p>
      )}
    </div>
  )
}

function Declined({ order }: { order: Order }) {
  const navigate = useNavigate()
  return (
    <div className="relative flex flex-col items-center gap-4 px-8 py-14 text-center" data-testid="order-declined">
      <CloseLink />
      <XCircle className="text-danger size-12" aria-hidden />
      <h1 className="text-fg text-lg font-bold">Pagamento recusado</h1>
      <p role="alert" className="text-text-secondary text-sm leading-6">
        {order.declineReason ?? 'A carteira recusou o pagamento.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
      </p>
      <p className="text-muted-gold font-mono text-xs">Pedido {order.id}</p>
      <button type="button" onClick={() => void navigate({ to: '/carrinho' })} className="bg-brand text-ink rounded-md px-4 py-2 font-bold">
        Voltar ao carrinho
      </button>
    </div>
  )
}

const shortHash = (h: string) => `0x${h.slice(2, 6).toUpperCase()}…${h.slice(-4).toUpperCase()}`

function Receipt({ order }: { order: Order }) {
  const s = order.snapshot
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.updatedAt))
  return (
    <article aria-labelledby="receipt-title" className="relative" data-testid="order-receipt">
      <CloseLink />
      <header className="flex h-[156px] flex-col items-center justify-center gap-4">
        <img src={thankYou} alt="" width={56} height={80} />
        <h1 id="receipt-title" className="text-text-secondary text-center text-base leading-4 font-bold">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <div aria-hidden className="bg-brand h-px" />
      <dl className="text-text-secondary grid grid-cols-2 gap-y-3 px-6 py-3 sm:flex sm:items-center sm:justify-between sm:px-9">
        <div className="flex flex-col">
          <dt className="text-sm leading-4 font-bold">ID da transação</dt>
          <dd className="font-mono text-[15px]" data-testid="receipt-tx">
            {order.txHash ? shortHash(order.txHash) : '—'}
          </dd>
        </div>
        <span aria-hidden className="bg-brand hidden h-[31px] w-px sm:block" />
        <div className="flex flex-col">
          <dt className="text-sm leading-4">Data</dt>
          <dd className="text-[15px]">{date}</dd>
        </div>
        <span aria-hidden className="bg-brand hidden h-[31px] w-px sm:block" />
        <div className="flex flex-col">
          <dt className="text-sm leading-4">Total</dt>
          <dd className="text-[15px]">{formatEth(s.totalEth)}</dd>
        </div>
        <span aria-hidden className="bg-brand hidden h-[31px] w-px sm:block" />
        <div className="flex flex-col">
          <dt className="text-sm leading-4 font-bold">Carteira</dt>
          <dd className="text-[15px]">{WALLET_TYPE_LABELS[s.walletType]}</dd>
        </div>
      </dl>
      <div aria-hidden className="bg-brand h-px" />

      <section className="flex flex-col gap-3 px-6 pt-5 pb-12 sm:px-11" aria-labelledby="tx-details">
        <h2 id="tx-details" className="text-fg text-[15px] leading-4 font-bold">
          Detalhes da transação
        </h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-brand/60 text-fg border-b-[0.3px] text-base">
              <th scope="col" className="pb-3 font-bold">NFTs</th>
              <th scope="col" className="pb-3 text-center font-bold">Edições</th>
              <th scope="col" className="pb-3 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.lineId}>
                <td className="py-2">
                  <div className="flex items-center gap-2.5">
                    <NftImage src={l.image} alt={l.imageAlt} sizes="60px" width={60} height={60} className="size-[56px] shrink-0 rounded-md sm:size-[60px]" />
                    <div className="flex flex-col gap-1 leading-4">
                      <span className="text-fg text-[15px] font-bold">{l.name}</span>
                      <span className="text-muted-gold text-[13px]">
                        ID do token: {l.tokenId} · {l.editionLabel}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="text-fg text-center text-sm">(x {l.quantity})</td>
                <td className="text-accent-text text-right text-base font-bold whitespace-nowrap">{formatEth(l.lineTotalEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex w-full flex-col gap-2 sm:w-[272px]">
          {!eth.isZero(s.discountEth) && (
            <div className="flex justify-between text-sm">
              <dt className="text-fg">Desconto{s.couponCode ? ` (${s.couponCode})` : ''}</dt>
              <dd className="text-fg">(-) {formatEth(s.discountEth)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-fg text-sm">Taxa de rede</dt>
            <dd className="text-fg text-base">{formatEth(s.networkFeeEth)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt className="text-fg text-sm">Total</dt>
            <dd className="text-accent-text text-base" data-testid="receipt-total">
              {formatEth(s.totalEth)}
            </dd>
          </div>
        </dl>
        <div aria-hidden className="bg-brand/60 h-[0.3px]" />
        <p className="text-text-secondary text-center text-[13px] leading-[19px]">
          Transação confirmada na {NETWORK_LABELS[s.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
          <span className="block text-xs opacity-80">(Transação simulada para demonstração.)</span>
        </p>
        {order.explorerUrl && (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand text-ink mx-auto mt-2 rounded-md px-3.5 py-2.5 text-[15px] font-bold"
          >
            Ver no {EXPLORER_NAME[s.network]}
            <span className="sr-only"> (abre em nova aba; link simulado)</span>
          </a>
        )}
      </section>
    </article>
  )
}
