/**
 * Configurable, reproducible network conditions and business scenarios for
 * the mock API. Selected by (highest priority first):
 *   1. `window.__kurioMock.setScenario(...)` (Playwright / mock panel)
 *   2. `?scenario=<name>` query param on first load
 *   3. `VITE_MOCK_SCENARIO` env var
 * The active config is stored in sessionStorage so it survives reloads of the
 * same tab (needed for "refresh during a pending order" flows).
 */

export const LATENCY_PROFILES = ['none', 'fast', 'realistic', 'slow', 'variable'] as const
export type LatencyProfile = (typeof LATENCY_PROFILES)[number]

export type ScenarioConfig = {
  latency: LatencyProfile
  /** Every REST call fails with a network error; sockets refuse to connect. */
  offline: boolean
  /** Catalog list answers an empty page regardless of filters. */
  catalogEmpty: boolean
  /** Catalog endpoints answer HTTP 500 this many times, then recover. */
  catalogFailures: number
  /** NFT detail endpoint answers HTTP 503 this many times, then recovers. */
  detailFailures: number
  /** Earlier catalog requests resolve after later ones (out-of-order). */
  outOfOrder: boolean
  /** Favorite mutations fail with HTTP 500 this many times. */
  favoriteFailures: number
  /** Next order creation: price of first line changes right before it. */
  priceChangeOnCheckout: boolean
  /** Next order creation: first line's edition sells out right before it. */
  soldOutOnCheckout: boolean
  /** Next order creation: order is created but the response never arrives. */
  orderTimeout: boolean
  /** Orders settle as declined instead of confirmed. */
  paymentDeclined: boolean
  /** Wallet connection is rejected by the (simulated) wallet. */
  walletReject: boolean
  /** Sockets are dropped right after an order is created, reconnect blocked for N ms. */
  dropSocketOnOrder: number
  /** Time an order stays pending before settling (ms). */
  orderSettleMs: number
  /** Session lifetime (ms). */
  sessionTtlMs: number
}

export const DEFAULT_SCENARIO: ScenarioConfig = {
  latency: 'realistic',
  offline: false,
  catalogEmpty: false,
  catalogFailures: 0,
  detailFailures: 0,
  outOfOrder: false,
  favoriteFailures: 0,
  priceChangeOnCheckout: false,
  soldOutOnCheckout: false,
  orderTimeout: false,
  paymentDeclined: false,
  walletReject: false,
  dropSocketOnOrder: 0,
  orderSettleMs: 4000,
  sessionTtlMs: 30 * 60 * 1000,
}

/** Named presets, documented in the README. */
export const PRESETS: Record<string, Partial<ScenarioConfig>> = {
  default: {},
  fast: { latency: 'none', orderSettleMs: 800 },
  slow: { latency: 'slow' },
  variable: { latency: 'variable' },
  offline: { offline: true },
  'catalog-empty': { catalogEmpty: true },
  // 3 = first attempt + the 2 automatic retries → the error UI is shown.
  'catalog-error': { catalogFailures: 3 },
  'detail-error': { detailFailures: 3 },
  'out-of-order': { outOfOrder: true },
  'favorites-fail': { favoriteFailures: 1 },
  'price-change': { priceChangeOnCheckout: true },
  'sold-out': { soldOutOnCheckout: true },
  'order-timeout': { orderTimeout: true },
  'payment-declined': { paymentDeclined: true },
  'wallet-reject': { walletReject: true },
  'socket-drop': { dropSocketOnOrder: 6000 },
  'short-session': { sessionTtlMs: 60 * 1000 },
}

const STORAGE_KEY = 'kurio:mock-scenario'

function initial(): ScenarioConfig {
  try {
    const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('scenario')
    if (fromUrl && PRESETS[fromUrl]) {
      const cfg = { ...DEFAULT_SCENARIO, ...PRESETS[fromUrl] }
      globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(cfg))
      return cfg
    }
    const stored = globalThis.sessionStorage?.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_SCENARIO, ...(JSON.parse(stored) as Partial<ScenarioConfig>) }
  } catch {
    // ignore
  }
  const fromEnv = import.meta.env.VITE_MOCK_SCENARIO as string | undefined
  return { ...DEFAULT_SCENARIO, ...(fromEnv ? PRESETS[fromEnv] : {}) }
}

export const scenario: ScenarioConfig = initial()

function save() {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(scenario))
  } catch {
    // ignore
  }
}

export function setScenario(next: string | Partial<ScenarioConfig>) {
  const patch = typeof next === 'string' ? PRESETS[next] : next
  if (!patch) throw new Error(`Cenário desconhecido: ${String(next)}`)
  Object.assign(scenario, DEFAULT_SCENARIO, patch)
  save()
}

export function patchScenario(patch: Partial<ScenarioConfig>) {
  Object.assign(scenario, patch)
  save()
}

/** Consume a one-shot counter flag (e.g. catalogFailures). */
export function consume(flag: 'catalogFailures' | 'detailFailures' | 'favoriteFailures'): boolean {
  if (scenario[flag] > 0) {
    scenario[flag] -= 1
    save()
    return true
  }
  return false
}

export function consumeBool(
  flag: 'priceChangeOnCheckout' | 'soldOutOnCheckout' | 'orderTimeout',
): boolean {
  if (scenario[flag]) {
    scenario[flag] = false
    save()
    return true
  }
  return false
}
