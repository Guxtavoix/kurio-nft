import Decimal from 'decimal.js'

/**
 * Decimal arithmetic for ETH amounts. Amounts are always exchanged as
 * decimal strings; never convert them to JS numbers.
 */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type EthInput = string | Decimal

const toD = (v: EthInput) => (v instanceof Decimal ? v : new D(v))

/** Canonical string: no exponent, trailing zeros trimmed, max 18 decimals. */
export function ethToString(v: EthInput): string {
  const d = toD(v).toDecimalPlaces(18, Decimal.ROUND_HALF_UP)
  const s = d.toFixed()
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

export const eth = {
  add: (...vs: EthInput[]) => ethToString(vs.reduce<Decimal>((acc, v) => acc.plus(toD(v)), new D(0))),
  sub: (a: EthInput, b: EthInput) => ethToString(toD(a).minus(toD(b))),
  mul: (a: EthInput, qty: number | string) => ethToString(toD(a).times(new D(qty))),
  /** Multiply by a percentage (e.g. 10 → 10%). */
  percent: (a: EthInput, pct: number) => ethToString(toD(a).times(pct).dividedBy(100)),
  max: (a: EthInput, b: EthInput) => ethToString(Decimal.max(toD(a), toD(b))),
  min: (a: EthInput, b: EthInput) => ethToString(Decimal.min(toD(a), toD(b))),
  cmp: (a: EthInput, b: EthInput) => toD(a).comparedTo(toD(b)),
  eq: (a: EthInput, b: EthInput) => toD(a).equals(toD(b)),
  isZero: (a: EthInput) => toD(a).isZero(),
  round: (a: EthInput, dp: number) => ethToString(toD(a).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)),
}

/**
 * Display formatting, following the layout ("1.19 ETH", "0.016 ETH",
 * "26.846 ETH"): dot decimals, at least 2 and at most `maxDecimals`
 * fractional digits. Formatting never feeds back into calculations.
 */
export function formatEth(v: EthInput, opts: { maxDecimals?: number; unit?: boolean } = {}) {
  const { maxDecimals = 6, unit = true } = opts
  const d = toD(v).toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP)
  const decimals = Math.max(2, Math.min(maxDecimals, d.decimalPlaces()))
  const s = d.toFixed(decimals)
  return unit ? `${s} ETH` : s
}
