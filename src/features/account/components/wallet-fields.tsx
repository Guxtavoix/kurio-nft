import { NETWORKS, WALLET_TYPES, type Network, type WalletType } from '@/api/contracts'
import chevronDown from '@/assets/icons/chevron-down.svg'
import { FormField, inputClass } from '@/components/ui/form-field'
import { NETWORK_LABELS } from '@/features/catalog/search'
import { cn } from '@/lib/utils'
import { EnsInput } from './ens-input'

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
  walletconnect: 'WalletConnect',
}

export type WalletFormValues = {
  displayName: string
  nickname: string
  network: Network | ''
  profileName: string
  address: string
  secondaryAddress: string
  walletType: WalletType | ''
  referralCode: string
  email: string
  ensName: string
}

export const emptyWallet: WalletFormValues = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  secondaryAddress: '',
  walletType: '',
  referralCode: '',
  email: '',
  ensName: '',
}

export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(inputClass, 'appearance-none rounded-[3px] pr-10', !props.value && 'text-muted-gold', className)}
      >
        {children}
      </select>
      <img src={chevronDown} alt="" width={20} height={20} className="pointer-events-none absolute top-2.5 right-3" />
    </div>
  )
}

/** Structural slice of `useZodForm` that the fields need. */
type Form = {
  field: (k: keyof WalletFormValues & string) => {
    name: string
    value: string
    error?: string
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onBlur: () => void
  }
  errors: Partial<Record<keyof WalletFormValues | '_form', string>>
}

/** The wallet field grid (Figma "Carteira principal" / payment form). */
export function WalletFields({ form, idPrefix }: { form: Form; idPrefix: string }) {
  const f = form.field
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-x-[28px]" data-testid={`${idPrefix}-fields`}>
      <FormField label="Nome de exibição" required error={form.errors.displayName}>
        {(a) => <input {...a} {...f('displayName')} className={inputClass} />}
      </FormField>
      <FormField label="Apelido da carteira" required error={form.errors.nickname}>
        {(a) => <input {...a} {...f('nickname')} className={inputClass} />}
      </FormField>
      <FormField label="Rede" required error={form.errors.network}>
        {(a) => (
          <NativeSelect {...a} {...f('network')}>
            <option value="" disabled>
              Selecione uma rede
            </option>
            {NETWORKS.map((n) => (
              <option key={n} value={n} className="bg-surface-card text-fg">
                {NETWORK_LABELS[n]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Nome do perfil" required error={form.errors.profileName}>
        {(a) => <input {...a} {...f('profileName')} className={inputClass} />}
      </FormField>
      <FormField label="Endereço da carteira" required error={form.errors.address}>
        {(a) => <input {...a} {...f('address')} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" className={cn(inputClass, 'font-mono')} />}
      </FormField>
      <FormField label="ENS ou carteira secundária (opcional)" hideLabel error={form.errors.secondaryAddress} className="md:mt-[30px]">
        {(a) => <input {...a} {...f('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} className={inputClass} />}
      </FormField>
      <FormField label="Tipo de carteira" required error={form.errors.walletType}>
        {(a) => (
          <NativeSelect {...a} {...f('walletType')}>
            <option value="" disabled>
              Selecione uma carteira
            </option>
            {WALLET_TYPES.map((t) => (
              <option key={t} value={t} className="bg-surface-card text-fg">
                {WALLET_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Código de indicação" required error={form.errors.referralCode}>
        {(a) => <input {...a} {...f('referralCode')} autoComplete="off" className={cn(inputClass, 'uppercase')} />}
      </FormField>
      <FormField label="E-mail" required error={form.errors.email}>
        {(a) => <input {...a} {...f('email')} type="email" autoComplete="email" className={inputClass} />}
      </FormField>
      <FormField label="Nome ENS" required error={form.errors.ensName}>
        {(a) => <EnsInput {...a} {...f('ensName')} />}
      </FormField>
    </div>
  )
}
