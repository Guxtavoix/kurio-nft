import { expect, test, type Page } from '@playwright/test'
import { addToCart, connectAndReview, loginAPI, mock, openApp, USERS } from './support/app'

async function toCheckout(page: Page, scenario: string | Record<string, unknown> = 'fast') {
  await openApp(page, '/', { scenario })
  await loginAPI(page, USERS.ana)
  await addToCart(page, 'ivory-baron-088')
  await page.goto('/pagamento')
  await expect(page.getByTestId('checkout-form')).toBeVisible()
}

const ordersOf = (page: Page) => mock<{ id: string; status: string }[]>(page, 'orders')

test.describe('Falhas de pagamento e idempotência', () => {
  test('pagamento recusado preserva os itens do carrinho', async ({ page }) => {
    await toCheckout(page, 'payment-declined')
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 800, paymentDeclined: true })
    await connectAndReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('alert')).toContainText('Pagamento recusado pela carteira')
    await page.getByRole('button', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-line').filter({ hasText: 'Ivory Baron #088' })).toHaveCount(1)
  })

  test('cliques repetidos geram um único pedido', async ({ page }) => {
    await toCheckout(page, { latency: 'slow', orderSettleMs: 800 })
    await connectAndReview(page)
    const confirm = page.getByTestId('confirm-order')
    await confirm.click()
    await confirm.click({ force: true }).catch(() => undefined)
    await confirm.click({ force: true }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 15_000 })
    expect((await ordersOf(page)).length).toBe(1)
  })

  test('timeout após criação do pedido recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    await page.clock.install()
    await toCheckout(page)
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 800, orderTimeout: true })
    await connectAndReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('confirm-order')).toContainText('Enviando pedido')
    // Client timeout (8s) → automatic retry with the same Idempotency-Key.
    await page.clock.runFor(9_000)
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 10_000 })
    const orders = await ordersOf(page)
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0]!.id)
    await page.clock.runFor(2_000)
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 10_000 })
  })

  test('carteira recusa a conexão e o usuário consegue tentar novamente', async ({ page }) => {
    await toCheckout(page)
    await mock(page, 'setScenario', { latency: 'none', walletReject: true })
    await page.getByTestId('connect-wallet').click()
    await expect(page.getByText(/A conexão foi recusada na carteira/)).toBeVisible()
    await mock(page, 'setScenario', 'fast')
    await page.getByTestId('connect-wallet').click()
    await expect(page.getByTestId('wallet-connection')).toContainText('Conectada')
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByTestId('connect-wallet')).toBeVisible()
  })
})
