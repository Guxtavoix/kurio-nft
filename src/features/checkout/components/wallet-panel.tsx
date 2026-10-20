import { CheckCircle2, Loader2, PlugZap } from 'lucide-react'
import { WALLET_TYPES, type Network, type Wallet, type WalletType } from '@/api/contracts'
import { errorMessage, toApiError } from '@/api/errors'
import { WALLET_TYPE_LABELS } from '@/features/account/components/wallet-fields'
import { shortAddress } from '@/features/account/components/wallets-page'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { cn } from '@/lib/utils'
import { useWalletConnection } from '../queries'

const radio = (on: boolean) =>
  cn('grid size-4 shrink-0 place-items-center rounded-full border border-brand', on && 'after:size-2 after:rounded-full after:bg-brand')

/** Saved wallets as radio cards (Figma mobile "Carteira conectada"). */
export function SavedWalletPicker({
  wallets,
  value,
  onChange,
  disabled,
}: {
  wallets: Wallet[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  if (wallets.length === 0) return null
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-fg mb-3 text-[17px] leading-4 font-bold">Carteira cadastrada</legend>
      {wallets.map((w) => (
        <label
          key={w.id}
          className={cn(
            'bg-surface-card relative flex cursor-pointer items-start gap-4 rounded-[12px] border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--kurio-accent)]',
            value === w.id ? 'border-brand' : 'border-transparent',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input type="radio" name="saved-wallet" className="input-overlay" checked={value === w.id} onChange={() => onChange(w.id)} />
          <span aria-hidden className={cn(radio(value === w.id), 'mt-1')} />
          <span className="flex flex-col gap-1 text-sm">
            <span className="text-fg text-base font-bold">
              {w.slot === 'primary' ? 'Principal' : 'Secundária'} · {w.nickname}
            </span>
            <span className="text-text-secondary font-mono">{shortAddress(w.address)}</span>
            <span className="text-text-secondary">Rede {NETWORK_LABELS[w.network]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/**
 * Figma "Carteira e rede": provider options + simulated connection with
 * connect / rejected / disconnect states.
 */
export function ConnectionPanel({
  walletId,
  network,
  provider,
  onProvider,
  canConnect,
  blockedReason,
}: {
  walletId: string | null
  network: Network
  provider: WalletType
  onProvider: (p: WalletType) => void
  canConnect: boolean
  blockedReason?: string
}) {
  const { connection, connect, disconnect } = useWalletConnection()
  const connected = !!connection && connection.walletId === walletId && connection.network === network && connection.provider === provider
  const rejected = connect.isError && toApiError(connect.error).code === 'WALLET_REJECTED'

  return (
    <section aria-labelledby="wallet-network-title" className="flex flex-col gap-4">
      <h2 id="wallet-network-title" className="text-fg text-center text-[17px] leading-4 font-bold">
        Carteira e rede
      </h2>
      <div role="radiogroup" aria-label="Aplicativo de carteira" className="flex flex-col gap-4">
        {(['walletconnect', ...WALLET_TYPES.filter((t) => t !== 'walletconnect')] as WalletType[]).map((t) => (
          <label
            key={t}
            className={cn(
              'relative flex h-[45px] cursor-pointer items-center gap-2.5 rounded-[3px] border px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--kurio-accent)]',
              provider === t ? 'border-brand' : 'border-line',
            )}
          >
            <input
              type="radio"
              name="wallet-provider"
              className="input-overlay"
              checked={provider === t}
              onChange={() => {
                onProvider(t)
                if (connection) disconnect.mutate()
              }}
            />
            <span aria-hidden className={radio(provider === t)} />
            {t === 'walletconnect' ? (
              <span className="bg-surface-dark border-line-soft text-accent-text flex h-[26px] items-center rounded-md border px-2 text-[9px] font-bold tracking-[0.1px] whitespace-pre">
                <span className="sr-only">WalletConnect (MetaMask, WalletConnect e Coinbase)</span>
                <span aria-hidden>{'METAMASK  •  WALLETCONNECT  •  COINBASE'}</span>
              </span>
            ) : (
              <span className="text-fg text-[15px]">{WALLET_TYPE_LABELS[t]}</span>
            )}
          </label>
        ))}
      </div>

      <div aria-live="polite" className="flex flex-col gap-2" data-testid="wallet-connection">
        {connected ? (
          <div className="bg-surface-dark flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm">
            <span className="text-success flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden />
              Conectada via {WALLET_TYPE_LABELS[provider]} · {NETWORK_LABELS[network]}
            </span>
            <button type="button" className="text-accent-text underline" onClick={() => disconnect.mutate()}>
              Desconectar
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canConnect || !walletId || connect.isPending}
            onClick={() => walletId && connect.mutate({ walletId, network, provider })}
            className="border-brand text-accent-text flex h-10 items-center justify-center gap-2 rounded-[3px] border text-sm font-bold disabled:opacity-50"
            data-testid="connect-wallet"
          >
            {connect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
            {connect.isPending ? 'Aguardando aprovação na carteira…' : 'Conectar carteira'}
          </button>
        )}
        {!connected && blockedReason && <p className="text-text-secondary text-xs">{blockedReason}</p>}
        {connect.isError && !connected && (
          <p role="alert" className="text-danger text-xs">
            {rejected ? 'A conexão foi recusada na carteira. Aprove a solicitação e tente novamente.' : errorMessage(connect.error)}
          </p>
        )}
      </div>
    </section>
  )
}
