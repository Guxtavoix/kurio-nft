import { expect, type Page } from '@playwright/test'

/** Demo credentials from src/mocks/fixtures/users.ts (fictitious). */
export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'kurio2026', name: 'Ana Sato' },
  bruno: { email: 'bruno@kurio.test', password: 'nomad2026', name: 'Bruno Lima' },
} as const

type Scenario = string | Record<string, unknown>

/**
 * Opens a route and waits until the app booted (MSW worker + socket client).
 * Default scenario is "fast" (no artificial latency) for deterministic tests;
 * time-sensitive tests pass their own.
 */
export async function openApp(page: Page, path = '/', opts: { scenario?: Scenario; waitSocket?: boolean } = {}) {
  const scenario = opts.scenario ?? 'fast'
  const qs = typeof scenario === 'string' ? `${path.includes('?') ? '&' : '?'}scenario=${scenario}` : ''
  await page.goto(`${path}${qs}`)
  await page.waitForFunction(() => !!(window as unknown as { __kurioRealtime?: unknown }).__kurioRealtime)
  if (typeof scenario !== 'string') await setScenario(page, scenario)
  if (opts.waitSocket !== false) await waitSocket(page)
}

export async function waitSocket(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __kurioRealtime?: { status(): string } }).__kurioRealtime?.status() === 'connected',
    undefined,
    { timeout: 10_000 },
  )
}

/** Calls the mock control API (network-layer simulation, not app internals). */
export async function mock<T = unknown>(page: Page, method: string, ...args: unknown[]) {
  await page.waitForFunction(() => !!(window as unknown as { __kurioMock?: unknown }).__kurioMock)
  return page.evaluate(
    ([m, a]) => {
      const ctl = (window as unknown as { __kurioMock: Record<string, (...x: unknown[]) => unknown> }).__kurioMock
      return ctl[m as string]!(...(a as unknown[])) as unknown
    },
    [method, args] as const,
  ) as Promise<T>
}

export const setScenario = (page: Page, s: Scenario) => mock(page, 'setScenario', s)

/** Logs in through the real UI. */
export async function loginUI(page: Page, user: { email: string; password: string }, from = '/entrar') {
  if (!page.url().includes('/entrar')) await openApp(page, from)
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('contato@email.com').fill(user.email)
  await dialog.getByPlaceholder('Senha').fill(user.password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** Faster login for tests that are not about auth: same API, then reload. */
export async function loginAPI(page: Page, user: { email: string; password: string }) {
  await page.evaluate(async ({ email, password }) => {
    const guestCartId = localStorage.getItem('kurio:guest-cart') ?? undefined
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, guestCartId }),
    })
    if (!res.ok) throw new Error(`login failed ${res.status}`)
    localStorage.setItem('kurio:session', JSON.stringify(await res.json()))
    localStorage.removeItem('kurio:guest-cart')
  }, user)
  await page.reload()
  await page.waitForFunction(() => !!(window as unknown as { __kurioRealtime?: unknown }).__kurioRealtime)
  await waitSocket(page)
}

/** From /pagamento (user with a saved wallet): connect + open review. */
export async function connectAndReview(page: Page) {
  await page.getByTestId('connect-wallet').click()
  await expect(page.getByTestId('wallet-connection')).toContainText('Conectada')
  await page.getByTestId('open-review').click()
  await expect(page.getByTestId('review-dialog')).toBeVisible()
}

/** Adds an NFT to the cart through the detail page UI. */
export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768
  const qtyGroup = page.getByRole('group', { name: /^Quantidade/ }).first()
  for (let i = 1; i < quantity; i++) await qtyGroup.getByRole('button', { name: 'Aumentar quantidade' }).click()
  if (isMobile) await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  else {
    await page.getByTestId('buy-button').click()
    await page.waitForURL('**/carrinho')
  }
  await expect(page.getByText(/adicionado ao carrinho/)).toBeVisible()
}
