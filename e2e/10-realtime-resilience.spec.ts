import { expect, test } from '@playwright/test'
import { addToCart, connectAndReview, loginAPI, mock, openApp, USERS, waitSocket } from './support/app'

test.describe('Eventos duplicados/antigos, desconexão e retomada', () => {
  test('evento duplicado não reaplica efeito e evento antigo não regride o estado @desktop-only', async ({ page }) => {
    await openApp(page, '/')
    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
    await mock(page, 'updateNft', 'emerald-ape-042', { priceEth: '2.5' })
    await expect(card.getByTestId('nft-card-price')).toHaveText('2.50 ETH')

    await mock(page, 'replayLast', 'nft.updated') // duplicate (same eventId)
    await mock(page, 'sendStaleNftEvent', 'emerald-ape-042', '0.01') // older version
    await page.waitForTimeout(300)
    await expect(card.getByTestId('nft-card-price')).toHaveText('2.50 ETH')

    // REST stays consistent with the events.
    await page.reload()
    await expect(page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' }).getByTestId('nft-card-price')).toHaveText('2.50 ETH')
  })

  test('evento de pedido de outro usuário é ignorado', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'sage-nomad-009')
    await page.goto('/pagamento')
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 60_000 })
    await connectAndReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const [order] = await mock<{ id: string }[]>(page, 'orders')

    // Logout + Bruno logs in; Ana's order events must not reach Bruno.
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }))
    await page.evaluate(() => localStorage.removeItem('kurio:session'))
    await loginAPI(page, USERS.bruno)
    await page.goto(`/pedido/${order!.id}`)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    await mock(page, 'leakOrderEventTo', order!.id)
    await page.waitForTimeout(300)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
  })

  test('queda de conexão com pedido pendente: reconecta/recarrega e recupera sem nova compra', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'cosmic-bloom-118')
    await page.goto('/pagamento')
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 3000, dropSocketOnOrder: 2500 })
    await connectAndReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('realtime-offline')).toBeVisible({ timeout: 5000 })

    // Reload while pending: state recovered from REST, no second order.
    await page.reload()
    await expect(page.getByTestId('order-pending').or(page.getByTestId('order-receipt'))).toBeVisible()
    await waitSocket(page)
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
    expect(await mock<unknown[]>(page, 'orders')).toHaveLength(1)

    // Terminal: going back to checkout shows no pending order banner.
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})
