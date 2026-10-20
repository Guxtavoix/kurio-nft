import type {
  CheckoutCollector,
  Network,
  NftDetail,
  OrderSnapshot,
  OrderStatus,
  Quote,
  Wallet,
  WalletType,
} from '@/api/contracts'

export type DbUser = {
  id: string
  username: string
  displayName: string
  email: string
  salt: string
  passwordHash: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  updatedAt: string
}

export type DbSession = { token: string; userId: string; expiresAt: string }

export type DbCartLine = {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedPriceEth: string
}

export type DbCart = {
  id: string
  userId: string | null
  lines: DbCartLine[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export type DbWallets = {
  primary: Wallet | null
  secondary: Wallet | null
  secondarySameAsPrimary: boolean
}

export type DbWalletConnection = {
  id: string
  userId: string
  walletId: string
  network: Network
  provider: WalletType
  connectedAt: string
}

export type DbQuote = Quote & { userId: string | null; cartId: string; fingerprint: string }

export type DbOrder = {
  id: string
  userId: string
  status: OrderStatus
  version: number
  txHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  snapshot: OrderSnapshot
  collector: CheckoutCollector
  cartId: string
  /** Simulation: when the "chain" settles the order and with which outcome. */
  settleAt: number
  outcome: 'confirmed' | 'declined'
  createdAt: string
  updatedAt: string
}

export type DbIdempotency = {
  key: string
  userId: string
  requestHash: string
  orderId: string
}

export type DbState = {
  schema: number
  nfts: NftDetail[]
  users: DbUser[]
  sessions: DbSession[]
  carts: DbCart[]
  favorites: Record<string, string[]>
  wallets: Record<string, DbWallets>
  walletConnections: DbWalletConnection[]
  quotes: DbQuote[]
  orders: DbOrder[]
  idempotency: DbIdempotency[]
  /** Monotonic counter used for event ids. */
  eventSeq: number
}
