import { expect, test } from '@playwright/test'
import { addToCart, connectAndReview, loginAPI, mock, openApp, USERS } from './support/app'

test.describe('Tempo real no carrinho e checkout (Socket.IO)', () => {
  test('alteração de preço no carrinho: aviso, resumo atualizado e bloqueio até aceitar', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH')

    // Server-side change → nft.updated over socket.io-client.
    await mock(page, 'updateNft', 'emerald-ape-042', { priceEth: '1.5' })
    await expect(page.getByTestId('live-assertive')).toContainText('Emerald Ape #042 foi atualizado')
    await expect(page.getByTestId('price-changed-banner')).toBeVisible()
    await expect(page.getByTestId('line-status')).toContainText('Preço alterado: era 1.19 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('1.516 ETH')
    await expect(page.getByTestId('checkout-button')).toBeDisabled()

    await page.getByRole('button', { name: 'Aceitar novos preços' }).click()
    await expect(page.getByTestId('price-changed-banner')).toBeHidden()
    await expect(page.getByTestId('checkout-button')).toBeEnabled()
  })

  test('checkout impede confirmar com cotação desatualizada (evento durante a revisão)', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'violet-nomad-314')
    await page.goto('/pagamento')
    await connectAndReview(page)
    const review = page.getByTestId('review-dialog')
    await expect(review).toContainText('1.406 ETH')

    await mock(page, 'updateNft', 'violet-nomad-314', { priceEth: '1.6' })
    await expect(page.getByTestId('review-changed')).toBeVisible()
    // New values must be explicitly accepted before confirming.
    await expect(review.getByTestId('confirm-order')).toHaveCount(0)
    await review.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(review).toContainText('1.616 ETH')
    await review.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.616 ETH')
  })

  test('preço alterado no instante do envio: servidor recusa (QUOTE_STALE) e exige nova confirmação', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'ivory-baron-088')
    await page.goto('/pagamento')
    await connectAndReview(page)
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 800, priceChangeOnCheckout: true })
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('review-changed')).toContainText('mudaram')
    expect(await mock<unknown[]>(page, 'orders')).toHaveLength(0)
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 10_000 })
  })

  test('edição esgota durante a compra', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'golden-beat-207')
    await page.goto('/pagamento')
    await connectAndReview(page)
    await mock(page, 'setScenario', { latency: 'none', soldOutOnCheckout: true })
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('review-changed')).toContainText('esgotou')
    expect(await mock<unknown[]>(page, 'orders')).toHaveLength(0)
  })
})
