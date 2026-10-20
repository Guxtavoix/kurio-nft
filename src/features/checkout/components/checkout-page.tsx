import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { NETWORKS, WalletInput, type Profile, type Quote, type Wallet, type WalletsResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { errorMessage, toApiError } from '@/api/errors'
import { qk } from '@/api/query-keys'
import { ErrorState } from '@/components/feedback/states'
import { NftImage } from '@/components/nft/nft-image'
import { FormError, FormField, inputClass } from '@/components/ui/form-field'
import { EnsInput } from '@/features/account/components/ens-input'
import { NativeSelect, WALLET_TYPE_LABELS } from '@/features/account/components/wallet-fields'
import { useProfile, useSaveSecondaryWallet, useWallets } from '@/features/account/queries'
import { CouponForm } from '@/features/cart/components/coupon-form'
import { SummaryRows } from '@/features/cart/components/order-summary'
import { useAcknowledgePrices, useCart, useQuote } from '@/features/cart/queries'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { formatEth } from '@/lib/eth'
import { useZodForm } from '@/lib/use-zod-form'
import { cn } from '@/lib/utils'
import { useAuthUser, useOwner } from '@/session/hooks'
import { PLACE_ORDER_KEY, usePendingOrders, usePlaceOrder, useWalletConnection } from '../queries'
import { CheckoutForm, clearDraft, emptyCheckout, loadDraft, saveDraft, type CheckoutFormValues } from '../schema'
import { ReviewDialog } from './review-dialog'
import { ConnectionPanel, SavedWalletPicker } from './wallet-panel'

export function CheckoutPage() {
  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()
  const placing = useIsMutating({ mutationKey: PLACE_ORDER_KEY }) > 0

  if (cart.isPending || wallets.isPending || profile.isPending) return <CheckoutSkeleton />
  const error = cart.error ?? wallets.error ?? profile.error
  if (error || !cart.data || !wallets.data || !profile.data) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-24">
        <ErrorState
          title="Não foi possível carregar o pagamento"
          message={errorMessage(error)}
          onRetry={() => {
            void cart.refetch()
            void wallets.refetch()
            void profile.refetch()
          }}
        />
      </div>
    )
  }
  if (cart.data.lines.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-24 text-center">
        <h1 className="text-fg text-xl font-bold">Seu carrinho está vazio</h1>
        <p className="text-text-secondary mt-3 text-sm">Não há itens para pagar.</p>
        <Link to="/" hash="catalogo" className="bg-brand text-ink mt-6 inline-block rounded-md px-4 py-2 font-bold">
          Explorar NFTs
        </Link>
      </div>
    )
  }
  return <Checkout wallets={wallets.data} profile={profile.data} />
}

function initialValues(userId: string, profile: Profile, wallets: WalletsResponse): CheckoutFormValues {
  const w = wallets.primary ?? wallets.secondary
  const base: CheckoutFormValues = {
    ...emptyCheckout,
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName,
    profileName: w?.profileName ?? profile.username,
    referralCode: w?.referralCode ?? '',
    walletId: w?.id ?? '',
    useOtherWallet: !w,
    network: w?.network ?? 'ethereum',
    address: w?.address ?? '',
    secondaryAddress: w?.secondaryAddress ?? '',
    walletType: w?.walletType ?? 'metamask',
  }
  const draft = loadDraft(userId)
  return draft ? { ...base, ...draft } : base
}

function sameQuote(a: Quote, b: Quote) {
  return a.totalEth === b.totalEth && a.discountEth === b.discountEth && a.networkFeeEth === b.networkFeeEth &&
    JSON.stringify(a.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth])) ===
      JSON.stringify(b.lines.map((l) => [l.editionId, l.quantity, l.unitPriceEth]))
}

function Checkout({ wallets, profile }: { wallets: WalletsResponse; profile: Profile }) {
  const user = useAuthUser()!
  const owner = useOwner()
  const qc = useQueryClient()
  const router = useRouter()
  const form = useZodForm(CheckoutForm, initialValues(user.id, profile, wallets))
  const v = form.values
  const saved = useMemo(() => [wallets.primary, wallets.secondary].filter(Boolean) as Wallet[], [wallets])
  const selectedWallet = saved.find((w) => w.id === v.walletId) ?? null

  const cart = useCart()
  const quote = useQuote(v.network)
  const ack = useAcknowledgePrices()
  const { connection } = useWalletConnection()
  const placeOrder = usePlaceOrder()
  const saveSecondary = useSaveSecondaryWallet()
  const pending = usePendingOrders()

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [changedNotice, setChangedNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  // Persist the draft so an expired session can resume where it stopped.
  useEffect(() => saveDraft(user.id, v), [user.id, v])

  // Selecting a saved wallet fills its network/address/type.
  const pickWallet = (id: string) => {
    const w = saved.find((x) => x.id === id)
    if (!w) return
    form.setValues((prev) => ({
      ...prev,
      walletId: w.id,
      useOtherWallet: false,
      network: w.network,
      address: w.address,
      secondaryAddress: w.secondaryAddress,
      walletType: w.walletType,
      profileName: prev.profileName || w.profileName,
      referralCode: prev.referralCode || w.referralCode,
    }))
  }

  // While reviewing, realtime changes (nft.updated → quote refetch) update
  // the values shown and require a new explicit confirmation.
  useEffect(() => {
    if (!reviewOpen || !reviewed || !quote.data || quote.data.network !== reviewed.network) return
    if (!sameQuote(quote.data, reviewed) || quote.data.purchasable !== reviewed.purchasable) {
      setReviewed(quote.data)
      setChangedNotice('Os valores mudaram enquanto você revisava. Confira o novo total antes de confirmar.')
    }
  }, [quote.data, reviewOpen, reviewed])

  const connected =
    !!connection && !!selectedWallet && connection.walletId === selectedWallet.id && connection.network === v.network && connection.provider === v.walletType
  const networkMismatch = !!selectedWallet && selectedWallet.network !== v.network

  /** "Usar outra carteira": validate the wallet fields and save as secondary. */
  const saveOtherWallet = () => {
    const data = form.validate()
    if (!data) return
    const input = WalletInput.safeParse({
      displayName: data.displayName,
      nickname: 'Carteira de pagamento',
      network: data.network,
      profileName: data.profileName,
      address: data.address,
      secondaryAddress: data.secondaryAddress,
      walletType: data.walletType,
      referralCode: data.referralCode,
      email: data.email,
      ensName: data.ensName,
    })
    if (!input.success) {
      const errs: Record<string, string> = {}
      for (const i of input.error.issues) errs[String(i.path[0])] ??= i.message
      form.setErrors({ ...errs, _form: 'Verifique os dados da carteira.' })
      return
    }
    saveSecondary.mutate(
      { sameAsPrimary: false, wallet: input.data },
      {
        onSuccess: (res) => {
          toast.success('Carteira salva como secundária')
          if (res.secondary) {
            form.setValues((prev) => ({ ...prev, walletId: res.secondary!.id, useOtherWallet: false }))
          }
        },
        onError: (err) => form.applyServerError(err, 'Não foi possível salvar a carteira.'),
      },
    )
  }

  /** Validate, revalidate the quote with the API, then open the review. */
  const openReview = async () => {
    setSubmitError(null)
    setChangedNotice(null)
    const data = form.validate()
    if (!data) return
    if (data.useOtherWallet) {
      form.setErrors((e) => ({ ...e, _form: 'Salve a outra carteira antes de continuar.' }))
      return
    }
    if (!connected) {
      form.setErrors((e) => ({ ...e, _form: 'Conecte a carteira na rede selecionada para continuar.' }))
      return
    }
    setPreparing(true)
    try {
      const fresh = await qc.fetchQuery({
        queryKey: qk.quote(owner, data.network),
        queryFn: ({ signal }) => api.cart.quote(data.network, { signal }),
        staleTime: 0,
      })
      setReviewed(fresh)
      if (quote.data && !sameQuote(quote.data, fresh)) {
        setChangedNotice('Os valores foram atualizados desde a última visualização. Revise antes de confirmar.')
      }
      setReviewOpen(true)
    } catch (err) {
      form.setErrors((e) => ({ ...e, _form: `Não foi possível revalidar o pedido. ${errorMessage(err)}` }))
    } finally {
      setPreparing(false)
    }
  }

  const confirm = () => {
    if (!reviewed || !connection) return
    setSubmitError(null)
    const data = form.validate()
    if (!data) {
      setReviewOpen(false)
      return
    }
    placeOrder.mutate(
      {
        quoteId: reviewed.id,
        walletConnectionId: connection.connectionId,
        collector: {
          displayName: data.displayName,
          username: data.username,
          profileName: data.profileName,
          email: data.email,
          ensName: data.ensName,
          referralCode: data.referralCode,
          note: data.note || undefined,
        },
      },
      {
        onSuccess: () => {
          clearDraft(user.id)
          setReviewOpen(false)
        },
        onError: (err) => {
          const e = toApiError(err)
          if (e.code === 'QUOTE_STALE') {
            const next = (e.details as { quote?: Quote } | undefined)?.quote
            if (next) setReviewed(next)
            setChangedNotice(e.message)
          } else if (e.code === 'WALLET_NOT_CONNECTED') {
            setReviewOpen(false)
            form.setErrors((x) => ({ ...x, _form: e.message }))
          } else if (e.isTransient) {
            setSubmitError(
              'Não conseguimos confirmar o envio (conexão instável). Tente novamente: a mesma tentativa será reaproveitada e nenhuma compra duplicada será criada.',
            )
          } else {
            setSubmitError(errorMessage(e))
          }
        },
      },
    )
  }

  const needsAck = !!reviewed && reviewed.issues.some((i) => i.type === 'price_changed')
  const blockingIssues = reviewed?.issues.filter((i) => i.type === 'sold_out' || i.type === 'insufficient') ?? []
  const pendingOrder = pending.data?.items[0]

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:pt-8 xl:px-0">
      <div className="relative mb-6 flex items-center justify-center md:hidden">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="bg-surface-dark text-fg absolute left-0 grid size-9 place-items-center rounded-full"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p className="text-fg text-xl font-bold" aria-hidden>
          Pagamento com carteira
        </p>
      </div>
      <nav aria-label="Trilha de navegação" className="text-fg hidden text-sm font-bold md:block">
        <ol className="flex gap-1">
          <li>
            <Link to="/">Início</Link> /
          </li>
          <li>
            <Link to="/carrinho">Mercado</Link> /
          </li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      {pendingOrder && (
        <p role="status" className="bg-surface-dark border-brand text-fg mt-6 flex items-center gap-2 rounded-md border p-3 text-sm" data-testid="pending-order-banner">
          <Clock className="text-accent-text size-4" aria-hidden />
          Você tem um pedido em processamento.{' '}
          <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className="text-accent-text underline">
            Acompanhar status
          </Link>
        </p>
      )}

      <form
        ref={form.formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void openReview()
        }}
        className="mt-8 flex flex-col gap-10 pb-28 md:pb-0 lg:flex-row lg:justify-between"
        data-testid="checkout-form"
      >
        {/* Collector data */}
        <section aria-labelledby="collector-title" className="flex min-w-0 flex-col gap-6 lg:w-[645px]">
          <h2 id="collector-title" className="text-fg text-base leading-4 font-bold">
            Perfil do colecionador
          </h2>
          <FormError message={form.errors._form} />
          <div className="grid gap-6 md:grid-cols-2 md:gap-x-5">
            <FormField label="Nome de exibição" required error={form.errors.displayName}>
              {(a) => <input {...a} {...form.field('displayName')} autoComplete="name" className={inputClass} />}
            </FormField>
            <FormField label="Nome de usuário" required error={form.errors.username}>
              {(a) => <input {...a} {...form.field('username')} autoComplete="username" className={inputClass} />}
            </FormField>
            <FormField label="Rede" required error={form.errors.network}>
              {(a) => (
                <NativeSelect {...a} {...form.field('network')} disabled={!v.useOtherWallet && !!selectedWallet}>
                  {NETWORKS.map((n) => (
                    <option key={n} value={n} className="bg-surface-card text-fg">
                      {NETWORK_LABELS[n]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label="Nome do perfil" required error={form.errors.profileName}>
              {(a) => <input {...a} {...form.field('profileName')} className={inputClass} />}
            </FormField>
            <FormField label="Endereço da carteira" required error={form.errors.address}>
              {(a) => (
                <input
                  {...a}
                  {...form.field('address')}
                  readOnly={!v.useOtherWallet}
                  placeholder="Endereço 0x da carteira"
                  spellCheck={false}
                  className={cn(inputClass, 'font-mono', !v.useOtherWallet && 'text-text-secondary')}
                />
              )}
            </FormField>
            <FormField label="ENS ou carteira secundária (opcional)" hideLabel error={form.errors.secondaryAddress} className="md:mt-7">
              {(a) => (
                <input
                  {...a}
                  {...form.field('secondaryAddress')}
                  readOnly={!v.useOtherWallet}
                  placeholder="ENS ou carteira secundária (opcional)"
                  className={inputClass}
                />
              )}
            </FormField>
            <FormField label="Tipo de carteira" required error={form.errors.walletType}>
              {(a) => (
                <NativeSelect {...a} {...form.field('walletType')}>
                  {Object.entries(WALLET_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k} className="bg-surface-card text-fg">
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label="Código de indicação" required error={form.errors.referralCode}>
              {(a) => <input {...a} {...form.field('referralCode')} className={cn(inputClass, 'uppercase')} />}
            </FormField>
            <FormField label="E-mail" required error={form.errors.email}>
              {(a) => <input {...a} {...form.field('email')} type="email" autoComplete="email" className={inputClass} />}
            </FormField>
            <FormField label="Nome ENS" required error={form.errors.ensName}>
              {(a) => <EnsInput {...a} {...form.field('ensName')} className="md:w-full" />}
            </FormField>
          </div>

          <label className="text-fg relative flex w-fit cursor-pointer items-center gap-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--kurio-accent)]">
            <input
              type="checkbox"
              className="peer input-overlay"
              checked={v.useOtherWallet}
              onChange={(e) => {
                const on = e.target.checked
                form.setValues((prev) => ({ ...prev, useOtherWallet: on, address: on ? '' : (selectedWallet?.address ?? ''), secondaryAddress: on ? '' : (selectedWallet?.secondaryAddress ?? '') }))
              }}
              data-testid="use-other-wallet"
            />
            <span aria-hidden className="border-brand peer-checked:after:bg-brand grid size-4 place-items-center rounded-full border after:size-2 after:rounded-full" />
            Usar outra carteira?
          </label>
          {v.useOtherWallet && (
            <div className="bg-surface-card flex flex-col gap-3 rounded-md p-4 text-sm">
              <p className="text-text-secondary">
                Informe o endereço acima. A carteira será salva como sua carteira secundária e poderá ser usada agora.
              </p>
              <button
                type="button"
                onClick={saveOtherWallet}
                disabled={saveSecondary.isPending}
                className="bg-brand text-ink h-10 w-fit rounded-[3px] px-4 font-bold disabled:opacity-60"
              >
                {saveSecondary.isPending ? 'Salvando…' : 'Salvar e usar esta carteira'}
              </button>
            </div>
          )}

          <FormField label="Observação do colecionador (opcional)" error={form.errors.note}>
            {(a) => (
              <textarea
                {...a}
                {...form.field('note')}
                rows={5}
                maxLength={280}
                className="border-line text-fg focus:border-brand min-h-[128px] w-full rounded-[3px] border bg-transparent p-3 text-sm outline-none md:w-[296px]"
              />
            )}
          </FormField>
        </section>

        {/* Order + wallet */}
        <aside aria-labelledby="your-nfts-title" className="flex flex-col gap-6 lg:w-[342px] lg:shrink-0">
          <h2 id="your-nfts-title" className="text-fg text-base leading-4 font-bold">
            Seus NFTs
          </h2>
          <div className="flex justify-between text-sm" aria-hidden>
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul className="-mt-4 flex flex-col gap-2.5">
            {cart.data?.lines.map((l) => (
              <li key={l.id} className="bg-surface-card flex items-center gap-2 py-1 pr-2">
                <NftImage src={l.image} alt="" sizes="60px" width={60} height={60} className="size-[60px] rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col leading-4">
                  <span className="text-fg truncate text-sm font-bold">{l.name}</span>
                  <span className="text-muted-gold text-xs">ID do token: {l.tokenId}</span>
                </div>
                <span className="text-fg text-xs">(x {l.quantity})</span>
                <span className="text-accent-text text-base font-bold whitespace-nowrap">{formatEth(l.lineTotalEth)}</span>
              </li>
            ))}
          </ul>
          <details className="text-fg text-sm" open={!!cart.data?.couponCode}>
            <summary className="cursor-pointer text-center">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3">
              <CouponForm applied={cart.data?.couponCode ?? null} />
            </div>
          </details>
          {quote.isError ? (
            <p role="alert" className="text-danger text-sm">
              {errorMessage(quote.error)}{' '}
              <button type="button" className="underline" onClick={() => void quote.refetch()}>
                Tentar novamente
              </button>
            </p>
          ) : (
            <SummaryRows quote={quote.data} loading={quote.isPending} />
          )}
          {quote.data && !quote.data.purchasable && (
            <div role="alert" className="border-brand bg-surface-dark flex flex-col gap-2 rounded-md border p-3 text-sm" data-testid="quote-issues">
              {quote.data.issues.map((i, idx) => (
                <p key={idx} className="text-fg">
                  {i.message}
                </p>
              ))}
              {quote.data.issues.some((i) => i.type === 'price_changed') ? (
                <button
                  type="button"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate()}
                  className="bg-brand text-ink w-fit rounded-md px-3 py-1.5 font-bold disabled:opacity-60"
                >
                  Aceitar novos preços
                </button>
              ) : (
                <Link to="/carrinho" className="text-accent-text underline">
                  Ajustar carrinho
                </Link>
              )}
            </div>
          )}

          <SavedWalletPicker wallets={saved} value={v.useOtherWallet ? '' : v.walletId} onChange={pickWallet} />
          {form.errors.walletId && (
            <p role="alert" className="text-danger -mt-3 text-xs">
              {form.errors.walletId}
            </p>
          )}
          {saved.length === 0 && !v.useOtherWallet && (
            <p className="text-text-secondary text-sm">
              Você ainda não tem carteiras.{' '}
              <Link to="/perfil/carteiras" className="text-accent-text underline">
                Cadastrar carteira
              </Link>
            </p>
          )}

          <ConnectionPanel
            walletId={v.useOtherWallet ? null : (selectedWallet?.id ?? null)}
            network={v.network}
            provider={v.walletType}
            onProvider={(p) => form.setField('walletType', p)}
            canConnect={!v.useOtherWallet && !!selectedWallet && !networkMismatch}
            blockedReason={
              v.useOtherWallet
                ? 'Salve a outra carteira para conectá-la.'
                : !selectedWallet
                  ? 'Selecione uma carteira cadastrada.'
                  : networkMismatch
                    ? `A carteira selecionada está na rede ${NETWORK_LABELS[selectedWallet.network]}.`
                    : undefined
            }
          />

          <button
            type="submit"
            disabled={preparing || placeOrder.isPending}
            className="bg-brand text-ink fixed inset-x-6 bottom-[92px] z-30 h-14 rounded-full text-[15px] leading-4 font-bold shadow-lg disabled:opacity-60 md:static md:h-[45px] md:rounded-[8px] md:shadow-none"
            data-testid="open-review"
          >
            {preparing ? 'Revalidando valores…' : 'Confirmar compra'}
          </button>
        </aside>
      </form>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        quote={reviewed}
        changedNotice={
          blockingIssues.length
            ? `${blockingIssues.map((i) => i.message).join(' ')} Ajuste o carrinho para continuar.`
            : changedNotice
        }
        provider={v.walletType}
        address={selectedWallet ? `${selectedWallet.address.slice(0, 6)}…${selectedWallet.address.slice(-4)}` : ''}
        submitting={placeOrder.isPending}
        error={submitError}
        needsAck={needsAck}
        acking={ack.isPending}
        onAck={() =>
          ack.mutate(undefined, {
            onSuccess: async () => {
              const fresh = await qc.fetchQuery({
                queryKey: qk.quote(owner, v.network),
                queryFn: ({ signal }) => api.cart.quote(v.network, { signal }),
                staleTime: 0,
              })
              setReviewed(fresh)
              setChangedNotice('Novos valores aceitos. Confira o total e confirme.')
            },
          })
        }
        onConfirm={confirm}
      />
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 pt-12 lg:flex-row lg:justify-between xl:px-0" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid flex-1 gap-6 md:grid-cols-2 lg:max-w-[645px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton-shimmer h-[70px] rounded" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:w-[342px]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton-shimmer h-[60px]" />
        ))}
        <div className="skeleton-shimmer h-[150px]" />
        <div className="skeleton-shimmer h-[45px]" />
      </div>
    </div>
  )
}
