import { AlertTriangle, Loader2 } from 'lucide-react'
import type { Quote } from '@/api/contracts'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { NftImage } from '@/components/nft/nft-image'
import { SummaryRows } from '@/features/cart/components/order-summary'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { WALLET_TYPE_LABELS } from '@/features/account/components/wallet-fields'
import { formatEth } from '@/lib/eth'
import type { WalletType } from '@/api/contracts'

/**
 * Final review before sending (focus-trapped dialog). Shows exactly the
 * quote that will be sent. When values changed since the collector opened
 * it, a notice is shown and a new explicit confirmation is required.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  quote,
  changedNotice,
  provider,
  address,
  submitting,
  error,
  needsAck,
  onAck,
  acking,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  quote: Quote | null
  changedNotice: string | null
  provider: WalletType
  address: string
  submitting: boolean
  error: string | null
  needsAck: boolean
  onAck: () => void
  acking: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="bg-surface-card border-line text-fg max-h-[90dvh] overflow-y-auto sm:max-w-[520px]" data-testid="review-dialog">
        <DialogTitle className="text-lg font-bold">Revise seu pedido</DialogTitle>
        <DialogDescription className="text-text-secondary text-sm">
          Confira os valores. Eles foram revalidados agora e serão enviados exatamente como abaixo.
        </DialogDescription>

        {changedNotice && (
          <p role="alert" className="border-brand bg-surface-dark text-fg flex gap-2 rounded-md border p-3 text-sm" data-testid="review-changed">
            <AlertTriangle className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
            {changedNotice}
          </p>
        )}

        {quote && (
          <>
            <ul className="flex flex-col gap-3">
              {quote.lines.map((l) => (
                <li key={l.lineId} className="flex items-center gap-3">
                  <NftImage src={l.image} alt="" sizes="48px" width={48} height={48} className="size-12 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="truncate font-bold">{l.name}</span>
                    <span className="text-text-secondary text-xs">
                      Edição {l.editionLabel} · (x {l.quantity}) · {formatEth(l.unitPriceEth)} cada
                    </span>
                  </div>
                  <span className="text-accent-text text-sm font-bold">{formatEth(l.lineTotalEth)}</span>
                </li>
              ))}
            </ul>
            <SummaryRows quote={quote} loading={false} />
            <p className="text-text-secondary text-xs">
              Pagamento via {WALLET_TYPE_LABELS[provider]} na rede {NETWORK_LABELS[quote.network]} · carteira{' '}
              <span className="font-mono">{address}</span>
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <button type="button" className="text-fg text-sm underline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Voltar e editar
          </button>
          {needsAck ? (
            <button
              type="button"
              onClick={onAck}
              disabled={acking}
              className="bg-brand text-ink h-11 rounded-md px-4 text-sm font-bold disabled:opacity-60"
            >
              {acking ? 'Atualizando…' : 'Aceitar novos valores'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting || !quote?.purchasable}
              aria-disabled={submitting}
              className="bg-brand text-ink flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold disabled:opacity-60"
              data-testid="confirm-order"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {submitting ? 'Enviando pedido…' : `Confirmar e pagar ${quote ? formatEth(quote.totalEth) : ''}`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
