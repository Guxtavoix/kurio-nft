import { z } from 'zod'
import { IsoDate, Network, NETWORKS, WALLET_TYPES, WalletType } from './common'
import { NftSummary } from './nft'

const ensLabel = z
  .string()
  .trim()
  .max(32, 'Máximo de 32 caracteres')
  .regex(/^[a-z0-9-]*$/i, 'Use apenas letras, números ou "-"')

export const EvmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x + 40 hexadecimais)')

/** Solana base58 public key (32–44 chars). */
export const SolanaAddress = z
  .string()
  .trim()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Endereço Solana inválido')

export const Profile = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.string().email(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: IsoDate,
})
export type Profile = z.infer<typeof Profile>

export const UpdateProfileRequest = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(24, 'Máximo de 24 caracteres')
    .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, "_" ou "."'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  ensName: ensLabel.min(3, 'Mínimo de 3 caracteres'),
  walletNickname: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(32, 'Máximo de 32 caracteres'),
})
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>

export const UpdateAvatarRequest = z.object({
  /** data: URL (image/png|jpeg|webp), max ~1.5MB. */
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPG ou WEBP'),
})
export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequest>

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const WalletSlot = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof WalletSlot>

const walletFields = {
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  nickname: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(32, 'Máximo de 32 caracteres'),
  network: z.enum(NETWORKS, { error: 'Selecione uma rede' }),
  profileName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  address: z.string().trim().min(1, 'Informe o endereço da carteira'),
  secondaryAddress: z.string().trim().max(64, 'Máximo de 64 caracteres').optional().or(z.literal('')),
  walletType: z.enum(WALLET_TYPES, { error: 'Selecione o tipo de carteira' }),
  referralCode: z
    .string()
    .trim()
    .min(4, 'Mínimo de 4 caracteres')
    .max(16, 'Máximo de 16 caracteres')
    .regex(/^[A-Z0-9-]+$/i, 'Use letras, números ou "-"'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  ensName: ensLabel.min(3, 'Mínimo de 3 caracteres'),
}

/** Address must match the selected network's format. */
export const WalletInput = z
  .object(walletFields)
  .superRefine((v, ctx) => {
    const check = v.network === 'solana' ? SolanaAddress : EvmAddress
    const res = check.safeParse(v.address)
    if (!res.success) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: res.error.issues[0]!.message })
    }
  })
export type WalletInput = z.infer<typeof WalletInput>

export const Wallet = z.object({
  id: z.string(),
  slot: WalletSlot,
  ...walletFields,
  secondaryAddress: z.string(),
  updatedAt: IsoDate,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletsResponse = z.object({
  primary: Wallet.nullable(),
  secondary: Wallet.nullable(),
  secondarySameAsPrimary: z.boolean(),
})
export type WalletsResponse = z.infer<typeof WalletsResponse>

export const SecondaryWalletRequest = z.discriminatedUnion('sameAsPrimary', [
  z.object({ sameAsPrimary: z.literal(true) }),
  z.object({ sameAsPrimary: z.literal(false), wallet: WalletInput }),
])
export type SecondaryWalletRequest = z.infer<typeof SecondaryWalletRequest>

export const WalletConnection = z.object({
  walletId: z.string(),
  connectionId: z.string(),
  network: Network,
  /** App used to connect (WalletConnect, MetaMask, Coinbase Wallet). */
  provider: WalletType,
  status: z.literal('connected'),
  connectedAt: IsoDate,
})
export type WalletConnection = z.infer<typeof WalletConnection>

export const ConnectWalletRequest = z.object({ network: Network, provider: WalletType })
export type ConnectWalletRequest = z.infer<typeof ConnectWalletRequest>

export const FavoritesResponse = z.object({
  nftIds: z.array(z.string()),
  items: z.array(NftSummary),
})
export type FavoritesResponse = z.infer<typeof FavoritesResponse>
