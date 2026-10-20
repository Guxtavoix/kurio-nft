export type CouponDef = {
  code: string
  description: string
  percentOff: number
  /** ISO date; coupons past this date answer COUPON_EXPIRED. */
  expiresAt: string
}

export const COUPONS: CouponDef[] = [
  { code: 'KURIO10', description: 'Desconto do lançamento (10%)', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS25', description: 'Lançamento gênesis (25%)', percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO2025', description: 'Campanha de verão (15%)', percentOff: 15, expiresAt: '2025-03-01T00:00:00.000Z' },
]

/** Network fee per order (simulated gas estimate). */
export const NETWORK_FEES = {
  ethereum: '0.016',
  polygon: '0.0004',
  solana: '0.00025',
} as const
