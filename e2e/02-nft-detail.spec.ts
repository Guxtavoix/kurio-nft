import { expect, test } from '@playwright/test'
import { mock, openApp } from './support/app'

test.describe('Detalhe do NFT', () => {
  test('acesso direto por URL carrega galeria, edições e preço', async ({ page }) => {
    await openApp(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('detail-price')).toHaveText('1.19 ETH')
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('ID do token:').first()).toBeVisible()
  })

  test('NFT inexistente mostra 404 próprio', async ({ page }) => {
    await openApp(page, '/nft/nao-existe-123')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible()
  })

  test('rota inexistente mostra página 404', async ({ page }) => {
    await openApp(page, '/qualquer/coisa')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ page }) => {
    await openApp(page, '/nft/emerald-ape-042')
    // Make the 1/10 edition sell out through the mock server (emits nft.updated).
    await mock(page, 'updateNft', 'emerald-ape-042', { editionId: 'emerald-ape-042--1-10', available: 0 })
    const edition110 = page.getByRole('radio', { name: /Edição 1\/10/ })
    await expect(edition110).toHaveAccessibleName(/esgotada/)
    await edition110.click()
    await expect(page.getByTestId('edition-availability')).toContainText('Edição indisponível')
    await expect(page.getByRole('group', { name: /^Quantidade/ }).first().getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()

    // 1/1 edition: max one per order.
    await page.getByRole('radio', { name: /Edição 1\/50/ }).click()
    const qty = page.getByRole('group', { name: /^Quantidade/ }).first()
    for (let i = 0; i < 12; i++) {
      const plus = qty.getByRole('button', { name: 'Aumentar quantidade' })
      if (await plus.isDisabled()) break
      await plus.click()
    }
    await expect(qty.getByTestId('quantity-value')).toHaveText('10')
    await expect(page.getByTestId('quantity-limit')).toContainText('Limite de 10')
  })

  test('erro transitório no detalhe com nova tentativa', async ({ page }) => {
    await openApp(page, '/', { scenario: 'fast' })
    await mock(page, 'setScenario', { latency: 'none', orderSettleMs: 800, detailFailures: 3 })
    await page.goto('/nft/sage-nomad-009')
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar este NFT' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
  })
})
