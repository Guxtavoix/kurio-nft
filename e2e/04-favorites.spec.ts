import { expect, test } from '@playwright/test'
import { loginAPI, mock, openApp, USERS } from './support/app'

test.describe('Favoritos', () => {
  test('visitante é levado ao login; autenticado favorita e persiste após refresh', async ({ page }) => {
    await openApp(page, '/nft/ivory-baron-088')
    await page.getByTestId('favorite-toggle').filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    await loginAPI(page, USERS.ana)
    await page.goto('/nft/ivory-baron-088')
    const toggle = page.getByTestId('favorite-toggle').filter({ visible: true }).first()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('favorite-toggle').filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Ivory Baron #088')
  })

  test('falha na mutation faz rollback do estado otimista e permite nova tentativa', async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
    await page.goto('/nft/golden-signal-160')
    const toggle = page.getByTestId('favorite-toggle').filter({ visible: true }).first()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await mock(page, 'setScenario', { latency: 'slow', favoriteFailures: 1 })
    await toggle.click()
    // Optimistic: flips immediately…
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // …and rolls back when the server fails.
    await expect(page.getByText(/Não foi possível favoritar/)).toBeVisible({ timeout: 10_000 })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await mock(page, 'setScenario', 'fast')
    // Dismiss the error toast (on mobile it sits over the top bar).
    await page.getByRole('button', { name: /fechar|close/i }).filter({ visible: true }).first().click()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('favorite-toggle').filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
  })
})
