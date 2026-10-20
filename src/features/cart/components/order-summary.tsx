import type { Quote } from '@/api/contracts'
import { eth, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/**
 * Values come straight from the API quote (decimal strings) — the client
 * never recomputes totals. Fixed row heights keep skeleton → content stable.
 */
export function SummaryRows({ quote, loading, className }: { quote: Quote | undefined; loading: boolean; className?: string }) {
  const value = (v: string | undefined, f: (s: string) => string = formatEth) =>
    loading || v === undefined ? <span className="skeleton-shimmer inline-block h-4 w-24 rounded" aria-hidden /> : f(v)
  return (
    <dl className={cn('flex flex-col gap-3 text-fg', className)} aria-busy={loading} data-testid="summary">
      <div className="flex items-start justify-between">
        <dt className="text-[15px]">Subtotal</dt>
        <dd className="text-lg leading-4" data-testid="summary-subtotal">
          {value(quote?.subtotalEth)}
        </dd>
      </div>
      <div className="flex items-start justify-between text-[15px]">
        <dt>{quote?.coupon ? quote.coupon.description : 'Desconto do lançamento'}</dt>
        <dd data-testid="summary-discount">
          {value(quote?.discountEth, (v) => `(-) ${eth.isZero(v) ? '00.00' : formatEth(v, { unit: false })}`)}
        </dd>
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="flex w-full items-center justify-between">
          <dt className="text-[15px]">Taxa de rede</dt>
          <dd className="text-lg leading-4" data-testid="summary-fee">
            {value(quote?.networkFeeEth)}
          </dd>
        </div>
        <p className="text-accent-text text-xs leading-4">Taxa estimada</p>
      </div>
      <div className="mt-3 flex items-start justify-between leading-4 font-bold">
        <dt className="text-base">Total</dt>
        <dd className="text-accent-text text-lg" data-testid="summary-total">
          {value(quote?.totalEth)}
        </dd>
      </div>
    </dl>
  )
}
