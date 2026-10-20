import { z } from 'zod'
import { EthAmount, IsoDate, Network } from './common'

export const CART_LINE_STATUSES = ['ok', 'price_changed', 'insufficient', 'sold_out'] as const
export const CartLineStatus = z.enum(CART_LINE_STATUSES)
export type CartLineStatus = z.infer<typeof CartLineStatus>

export const CartLine = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  slug: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  editionLabel: z.string(),
  network: Network,
  quantity: z.number().int().positive(),
  /** Current catalog price for the edition. */
  unitPriceEth: EthAmount,
  /** Price when the collector last saw/acknowledged it. */
  acknowledgedPriceEth: EthAmount,
  lineTotalEth: EthAmount,
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().positive(),
  status: CartLineStatus,
  nftVersion: z.number().int(),
})
export type CartLine = z.infer<typeof CartLine>

export const Cart = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  lines: z.array(CartLine),
  itemCount: z.number().int().min(0),
  couponCode: z.string().nullable(),
  version: z.number().int(),
  updatedAt: IsoDate,
})
export type Cart = z.infer<typeof Cart>

export const AddCartItemRequest = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type AddCartItemRequest = z.infer<typeof AddCartItemRequest>

export const UpdateCartItemRequest = z.object({
  quantity: z.number().int().min(1),
})
export type UpdateCartItemRequest = z.infer<typeof UpdateCartItemRequest>

export const ApplyCouponRequest = z.object({
  code: z.string().trim().min(1, 'Informe o código').max(32),
})
export type ApplyCouponRequest = z.infer<typeof ApplyCouponRequest>

export const QUOTE_ISSUE_TYPES = ['price_changed', 'insufficient', 'sold_out', 'coupon_expired'] as const

export const QuoteIssue = z.object({
  type: z.enum(QUOTE_ISSUE_TYPES),
  lineId: z.string().nullable(),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof QuoteIssue>

export const QuoteLine = z.object({
  lineId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  editionLabel: z.string(),
  quantity: z.number().int().positive(),
  unitPriceEth: EthAmount,
  lineTotalEth: EthAmount,
})
export type QuoteLine = z.infer<typeof QuoteLine>

/**
 * Authoritative pricing for the cart. The checkout must send `quote.id`;
 * the server rejects stale quotes with QUOTE_STALE.
 */
export const Quote = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  network: Network,
  lines: z.array(QuoteLine),
  subtotalEth: EthAmount,
  discountEth: EthAmount,
  coupon: z.object({ code: z.string(), description: z.string() }).nullable(),
  networkFeeEth: EthAmount,
  totalEth: EthAmount,
  issues: z.array(QuoteIssue),
  /** False when any issue blocks checkout. */
  purchasable: z.boolean(),
  createdAt: IsoDate,
  expiresAt: IsoDate,
})
export type Quote = z.infer<typeof Quote>

export const QuoteRequest = z.object({
  network: Network.optional(),
})
export type QuoteRequest = z.infer<typeof QuoteRequest>
