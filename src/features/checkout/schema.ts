import { z } from 'zod'
import { CheckoutCollector, EvmAddress, NETWORKS, SolanaAddress, WALLET_TYPES } from '@/api/contracts'

/** Payment form (Figma "Perfil do colecionador" on the payment screen). */
export const CheckoutForm = CheckoutCollector.extend({
  network: z.enum(NETWORKS, { error: 'Selecione uma rede' }),
  walletId: z.string(),
  useOtherWallet: z.boolean(),
  address: z.string().trim(),
  secondaryAddress: z.string().trim().max(64, 'Máximo de 64 caracteres'),
  walletType: z.enum(WALLET_TYPES, { error: 'Selecione o tipo de carteira' }),
  note: z.string().trim().max(280, 'Máximo de 280 caracteres'),
}).superRefine((v, ctx) => {
  if (!v.useOtherWallet && !v.walletId) {
    ctx.addIssue({ code: 'custom', path: ['walletId'], message: 'Selecione uma carteira cadastrada ou use outra carteira' })
  }
  if (v.useOtherWallet) {
    const res = (v.network === 'solana' ? SolanaAddress : EvmAddress).safeParse(v.address)
    if (!res.success) ctx.addIssue({ code: 'custom', path: ['address'], message: res.error.issues[0]!.message })
  }
})
export type CheckoutFormValues = z.input<typeof CheckoutForm>

export const emptyCheckout: CheckoutFormValues = {
  displayName: '',
  username: '',
  profileName: '',
  email: '',
  ensName: '',
  referralCode: '',
  note: '',
  network: 'ethereum',
  walletId: '',
  useOtherWallet: false,
  address: '',
  secondaryAddress: '',
  walletType: 'metamask',
}

const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`

/** Draft kept per user so an expired session can resume the checkout. */
export function loadDraft(userId: string): Partial<CheckoutFormValues> | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId))
    return raw ? (JSON.parse(raw) as Partial<CheckoutFormValues>) : null
  } catch {
    return null
  }
}
export function saveDraft(userId: string, v: CheckoutFormValues) {
  try {
    sessionStorage.setItem(draftKey(userId), JSON.stringify(v))
  } catch {
    // ignore
  }
}
export function clearDraft(userId: string) {
  try {
    sessionStorage.removeItem(draftKey(userId))
  } catch {
    // ignore
  }
}
