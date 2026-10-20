import { useState } from 'react'
import { toast } from 'sonner'
import { WalletInput, type Wallet, type WalletsResponse } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { ErrorState } from '@/components/feedback/states'
import { FormError } from '@/components/ui/form-field'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { useZodForm } from '@/lib/use-zod-form'
import { cn } from '@/lib/utils'
import { useSavePrimaryWallet, useSaveSecondaryWallet, useWallets } from '../queries'
import { emptyWallet, WALLET_TYPE_LABELS, WalletFields, type WalletFormValues } from './wallet-fields'

export function toWalletValues(w: Wallet | null): WalletFormValues {
  if (!w) return emptyWallet
  return {
    displayName: w.displayName,
    nickname: w.nickname,
    network: w.network,
    profileName: w.profileName,
    address: w.address,
    secondaryAddress: w.secondaryAddress,
    walletType: w.walletType,
    referralCode: w.referralCode,
    email: w.email,
    ensName: w.ensName,
  }
}

export function shortAddress(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4).toUpperCase()}` : a
}

export function WalletsPage() {
  const wallets = useWallets()
  if (wallets.isPending) return <WalletsSkeleton />
  if (wallets.isError)
    return <ErrorState title="Não foi possível carregar suas carteiras" message={errorMessage(wallets.error)} onRetry={() => void wallets.refetch()} />
  return <WalletsView data={wallets.data} />
}

function WalletsView({ data }: { data: WalletsResponse }) {
  const [editingPrimary, setEditingPrimary] = useState(!data.primary)
  const [editingSecondary, setEditingSecondary] = useState(false)
  const sameAsPrimary = data.secondarySameAsPrimary && !editingSecondary

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 id="primary-title" className="text-fg text-base leading-4 font-bold">
              Carteira principal
            </h1>
            <p className="text-accent-text text-sm">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!editingPrimary && (
            <button type="button" onClick={() => setEditingPrimary(true)} className="text-accent-text text-base font-bold">
              {data.primary ? 'Editar' : 'Adicionar'}
            </button>
          )}
        </header>
        {editingPrimary ? (
          <PrimaryForm wallet={data.primary} onDone={() => setEditingPrimary(false)} canCancel={!!data.primary} />
        ) : (
          data.primary && <WalletSummary wallet={data.primary} />
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 id="secondary-title" className="text-fg text-base leading-4 font-bold">
              Carteira secundária
            </h2>
            {!data.secondary && !data.secondarySameAsPrimary && !editingSecondary && (
              <p className="text-accent-text text-sm">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <SameAsPrimaryToggle data={data} checked={sameAsPrimary} onUncheck={() => setEditingSecondary(true)} />
            {!editingSecondary && !sameAsPrimary && (
              <button type="button" onClick={() => setEditingSecondary(true)} className="text-accent-text text-base font-bold">
                {data.secondary ? 'Editar' : 'Adicionar'}
              </button>
            )}
          </div>
        </header>
        {sameAsPrimary ? (
          <p className="text-text-secondary text-sm" role="status">
            A carteira secundária usa os mesmos dados da principal.
          </p>
        ) : editingSecondary ? (
          <SecondaryForm wallet={data.secondary} onDone={() => setEditingSecondary(false)} />
        ) : (
          data.secondary && <WalletSummary wallet={data.secondary} />
        )}
      </section>
    </div>
  )
}

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <dl className="bg-surface-card grid gap-3 rounded-md p-5 text-sm sm:grid-cols-2" data-testid={`wallet-summary-${wallet.slot}`}>
      {[
        ['Apelido', wallet.nickname],
        ['Rede', NETWORK_LABELS[wallet.network]],
        ['Tipo', WALLET_TYPE_LABELS[wallet.walletType]],
        ['Endereço', shortAddress(wallet.address)],
        ['ENS', `${wallet.ensName}.eth`],
        ['E-mail', wallet.email],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="text-muted-gold">{k}:</dt>
          <dd className="text-fg break-all">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function PrimaryForm({ wallet, onDone, canCancel }: { wallet: Wallet | null; onDone: () => void; canCancel: boolean }) {
  const save = useSavePrimaryWallet()
  const form = useZodForm(WalletInput, toWalletValues(wallet))
  return (
    <form
      ref={form.formRef}
      noValidate
      className="flex flex-col gap-6"
      data-testid="primary-wallet-form"
      onSubmit={(e) => {
        e.preventDefault()
        const data = form.validate()
        if (!data) return
        save.mutate(data, {
          onSuccess: () => {
            toast.success('Carteira principal salva')
            onDone()
          },
          onError: (err) => form.applyServerError(err, 'Não foi possível salvar a carteira.'),
        })
      }}
    >
      <FormError message={form.errors._form} />
      <WalletFields form={form} idPrefix="primary" />
      <div className="flex gap-4">
        <button type="submit" disabled={save.isPending} className="bg-brand text-ink h-10 rounded-[3px] px-3 text-sm font-bold disabled:opacity-60">
          {save.isPending ? 'Salvando…' : 'Salvar carteira'}
        </button>
        {canCancel && (
          <button type="button" className="text-fg text-sm" onClick={onDone}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

function SecondaryForm({ wallet, onDone }: { wallet: Wallet | null; onDone: () => void }) {
  const save = useSaveSecondaryWallet()
  const form = useZodForm(WalletInput, toWalletValues(wallet))
  return (
    <form
      ref={form.formRef}
      noValidate
      className="flex flex-col gap-6"
      data-testid="secondary-wallet-form"
      onSubmit={(e) => {
        e.preventDefault()
        const data = form.validate()
        if (!data) return
        save.mutate(
          { sameAsPrimary: false, wallet: data },
          {
            onSuccess: () => {
              toast.success('Carteira secundária salva')
              onDone()
            },
            onError: (err) => form.applyServerError(err, 'Não foi possível salvar a carteira.'),
          },
        )
      }}
    >
      <FormError message={form.errors._form} />
      <WalletFields form={form} idPrefix="secondary" />
      <div className="flex gap-4">
        <button type="submit" disabled={save.isPending} className="bg-brand text-ink h-10 rounded-[3px] px-3 text-sm font-bold disabled:opacity-60">
          {save.isPending ? 'Salvando…' : 'Salvar carteira'}
        </button>
        <button type="button" className="text-fg text-sm" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Checking saves "same as primary" immediately. Unchecking only opens the
 * secondary form; the server state changes when that form is saved.
 */
function SameAsPrimaryToggle({ data, checked, onUncheck }: { data: WalletsResponse; checked: boolean; onUncheck: () => void }) {
  const save = useSaveSecondaryWallet()
  return (
    <label className={cn('text-fg relative flex items-center gap-2 text-sm', !data.primary && 'opacity-50')}>
      <input
        type="checkbox"
        className="peer input-overlay"
        checked={checked}
        disabled={!data.primary || save.isPending}
        onChange={(e) => {
          if (e.target.checked) {
            save.mutate(
              { sameAsPrimary: true },
              { onSuccess: () => toast.success('Carteira secundária igual à principal'), onError: (err) => toast.error(errorMessage(err)) },
            )
          } else onUncheck()
        }}
      />
      <span aria-hidden className="border-brand peer-checked:bg-brand peer-focus-visible:outline-accent-text grid size-4 place-items-center rounded-full border peer-focus-visible:outline-2" />
      Igual à carteira principal
    </label>
  )
}

function WalletsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando carteiras">
      <div className="skeleton-shimmer h-4 w-48 rounded" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="skeleton-shimmer h-[70px] rounded" />
        ))}
      </div>
    </div>
  )
}
