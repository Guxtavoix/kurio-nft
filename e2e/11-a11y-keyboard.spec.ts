import { expect, test } from '@playwright/test'
import { openApp } from './support/app'

test.describe('Teclado, foco e validação', () => {
  test('skip link e navegação por teclado até um NFT @desktop-only', async ({ page }) => {
    await openApp(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // Tab until the first NFT card link has focus, then open it.
    const link = page.getByTestId('catalog-grid').getByRole('link').first()
    for (let i = 0; i < 60 && !(await link.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('diálogo prende o foco e devolve ao fechar (zoom da imagem) @desktop-only', async ({ page }) => {
    await openApp(page, '/nft/emerald-ape-042')
    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('formulário de login: erros associados aos campos e foco no primeiro inválido', async ({ page }) => {
    await openApp(page, '/entrar')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByPlaceholder('contato@email.com')).toBeFocused()
    await dialog.getByPlaceholder('contato@email.com').fill('email-invalido')
    await page.keyboard.press('Enter')
    const email = dialog.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('E-mail inválido')
    await expect(email).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('filtros operáveis por teclado @desktop-only', async ({ page }) => {
    await openApp(page, '/')
    const music = page.getByTestId('catalog-filters').getByLabel(/Música/)
    await music.focus()
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/musica/)
    await expect(music).toBeChecked()
  })
})
