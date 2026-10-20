import { expect, test } from '@playwright/test'
import { addToCart, openApp } from './support/app'

test.describe('Carregamento lento, falhas e recuperação', () => {
  test('skeletons no catálogo e no detalhe durante carregamento lento', async ({ page }) => {
    await openApp(page, '/', { scenario: 'slow', waitSocket: false })
    await expect(page.getByLabel('Carregando NFTs')).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })

    await page.goto('/nft/sage-nomad-009')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible({ timeout: 10_000 })
  })

  test('skeleton no resumo do carrinho', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'emerald-ape-042')
    await page.evaluate(() =>
      (window as unknown as { __kurioMock: { setScenario(s: string): void } }).__kurioMock.setScenario('slow'),
    )
    await page.goto('/carrinho')
    await expect(page.getByLabel('Carregando carrinho')).toBeVisible()
    await expect(page.getByTestId('summary')).toHaveAttribute('aria-busy', 'true', { timeout: 10_000 })
    await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH', { timeout: 10_000 })
  })

  test('falha no catálogo mostra erro e recupera com nova tentativa', async ({ page }) => {
    await openApp(page, '/', { scenario: 'catalog-error', waitSocket: false })
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('sem conexão: erro de rede e recuperação quando volta', async ({ page }) => {
    await openApp(page, '/', { scenario: { latency: 'none', offline: true }, waitSocket: false })
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar este NFT' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Sem conexão. Verifique sua internet e tente novamente.')).toBeVisible()
    await page.evaluate(() =>
      (window as unknown as { __kurioMock: { setScenario(s: string): void } }).__kurioMock.setScenario('fast'),
    )
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})
