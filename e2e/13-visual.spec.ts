import { expect, test, type Page } from '@playwright/test'
import { addToCart, connectAndReview, loginAPI, openApp, USERS } from './support/app'

/**
 * Visual regression with versioned baselines (e2e/__screenshots__). Data is
 * the deterministic seed; latency is disabled; the demo-only mock panel and
 * toasts are hidden; the hero carousel autoplay is off (reduced motion).
 */
test.use({ colorScheme: 'dark', reducedMotion: 'reduce' })

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `[data-testid="mock-panel-open"], [data-sonner-toaster] { display: none !important; }`,
  })
  await page.evaluate(() => document.fonts.ready)
  // Full-page captures include below-the-fold lazy images: load them all.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager')))
  await page.waitForFunction(() => [...document.images].every((i) => i.complete))
}

test.describe('Regressão visual', () => {
  test('início', async ({ page }) => {
    await openApp(page, '/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe', async ({ page }) => {
    await openApp(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'emerald-ape-042', 2)
    await addToCart(page, 'violet-nomad-314', 6)
    await addToCart(page, 'ivory-baron-088', 9)
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await addToCart(page, 'emerald-ape-042', 2)
    await page.goto('/pagamento')
    await expect(page.getByTestId('summary-total')).toHaveText('2.396 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
    await connectAndReview(page)
    await expect(page.getByTestId('review-dialog')).toHaveScreenshot('pagamento-revisao.png')
  })
})
