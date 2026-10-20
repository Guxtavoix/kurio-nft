import { z } from 'zod'
import { EthAmount, IsoDate } from './common'
import { OrderStatus } from './order'

/**
 * Every realtime event carries a stable id (dedupe), the affected resource
 * and the resource version (ordering). Clients must ignore events whose
 * version is <= the version they already hold.
 */
const envelope = {
  eventId: z.string(),
  occurredAt: IsoDate,
  version: z.number().int(),
}

export const NftUpdatedEvent = z.object({
  ...envelope,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  data: z.object({
    priceEth: EthAmount,
    compareAtPriceEth: EthAmount.nullable(),
    soldOut: z.boolean(),
    editions: z.array(
      z.object({ id: z.string(), priceEth: EthAmount, available: z.number().int().min(0) }),
    ),
  }),
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = z.object({
  ...envelope,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  /** Owner of the order — clients drop events for any other user. */
  userId: z.string(),
  data: z.object({
    status: OrderStatus,
    txHash: z.string().nullable(),
    explorerUrl: z.string().nullable(),
    declineReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const SOCKET_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const

/** Socket.IO `path` option (server and client must agree). */
export const SOCKET_PATH = '/realtime/'
