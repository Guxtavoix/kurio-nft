import { expect, test } from '@playwright/test'
import { connectAndReview, loginUI, openApp, USERS } from './support/app'

test.describe('Compra completa', () => {
  test('do catálogo ao recibo confirmado, com snapshot e carrinho limpo', async ({ page }) => {
    await openApp(page, '/')
    // Catalog → detail
    await page.getByTestId('catalog-grid').getByRole('link', { name: 'Sage Nomad #009' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768
    if (isMobile) await page.getByRole('button', { name: 'Comprar NFT' }).click()
    else await page.getByTestId('buy-button').click()
    await expect(page).toHaveURL(/\/carrinho/)

    // Cart → checkout requires login → back to checkout
    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await loginUI(page, USERS.ana)
    await expect(page).toHaveURL(/\/pagamento/)

    // Validation of required fields
    await page.getByLabel('Código de indicação').fill('')
    await page.getByTestId('open-review').click()
    await expect(page.getByText('Mínimo de 4 caracteres')).toBeVisible()
    await expect(page.getByLabel('Código de indicação')).toBeFocused()
    await page.getByLabel('Código de indicação').fill('KURIO-ANA')

    await connectAndReview(page)
    const review = page.getByTestId('review-dialog')
    await expect(review).toContainText('Sage Nomad #009')
    await expect(review).toContainText('1.706 ETH') // 1.69 + 0.016
    await review.getByTestId('confirm-order').click()

    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const receipt = page.getByTestId('order-receipt')
    await expect(receipt).toBeVisible({ timeout: 10_000 })
    await expect(receipt).toContainText('Seus NFTs agora estão na sua carteira')
    await expect(page.getByTestId('receipt-total')).toHaveText('1.706 ETH')
    await expect(page.getByTestId('receipt-tx')).toHaveText(/^0x[0-9A-F]{4}…[0-9A-F]{4}$/)
    await expect(receipt.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', /etherscan\.io\/tx\/0x/)

    // Purchased items left the cart.
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})
