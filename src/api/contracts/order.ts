import { z } from 'zod'
import { EthAmount, IsoDate, Network, WalletType } from './common'
import { QuoteLine } from './cart'

export const ORDER_STATUSES = ['pending', 'confirmed', 'declined'] as const
export const OrderStatus = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatus>

export const isTerminalStatus = (s: OrderStatus) => s === 'confirmed' || s === 'declined'

/** Collector data from the payment form. */
export const CheckoutCollector = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40),
  username: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(24),
  profileName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  ensName: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(32),
  referralCode: z.string().trim().min(4, 'Mínimo de 4 caracteres').max(16),
  note: z.string().trim().max(280, 'Máximo de 280 caracteres').optional(),
})
export type CheckoutCollector = z.infer<typeof CheckoutCollector>

export const CreateOrderRequest = z.object({
  quoteId: z.string(),
  /** Connection obtained from POST /api/wallets/:id/connect. */
  walletConnectionId: z.string(),
  collector: CheckoutCollector,
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>

/** Immutable copy of what was bought, captured when the order is created. */
export const OrderSnapshot = z.object({
  lines: z.array(QuoteLine),
  subtotalEth: EthAmount,
  discountEth: EthAmount,
  couponCode: z.string().nullable(),
  networkFeeEth: EthAmount,
  totalEth: EthAmount,
  network: Network,
  walletType: WalletType,
  walletAddress: z.string(),
})
export type OrderSnapshot = z.infer<typeof OrderSnapshot>

export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  version: z.number().int(),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  declineReason: z.string().nullable(),
  snapshot: OrderSnapshot,
  createdAt: IsoDate,
  updatedAt: IsoDate,
})
export type Order = z.infer<typeof Order>

export const ActiveOrdersResponse = z.object({ items: z.array(Order) })
export type ActiveOrdersResponse = z.infer<typeof ActiveOrdersResponse>
