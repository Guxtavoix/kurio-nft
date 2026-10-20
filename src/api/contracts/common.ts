import { z } from 'zod'

/**
 * ETH amounts travel as decimal strings (never JS numbers) so precision is
 * preserved end-to-end. Up to 18 fractional digits (wei precision).
 */
export const EthAmount = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, 'Valor ETH deve ser uma string decimal')
export type EthAmount = z.infer<typeof EthAmount>

export const IsoDate = z.string().datetime({ offset: true })

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const Network = z.enum(NETWORKS)
export type Network = z.infer<typeof Network>

export const WALLET_TYPES = ['metamask', 'coinbase', 'walletconnect'] as const
export const WalletType = z.enum(WALLET_TYPES)
export type WalletType = z.infer<typeof WalletType>

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'AVAILABILITY_CONFLICT',
  'QUOTE_STALE',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'WALLET_NOT_CONNECTED',
  'RATE_LIMITED',
  'INTERNAL',
  'UNAVAILABLE',
] as const
export const ApiErrorCode = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof ApiErrorCode>

export const ApiErrorBody = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    /** Field name → human message, for form validation errors. */
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
  requestId: z.string().optional(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export const Paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
