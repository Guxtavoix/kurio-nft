import { expect, test } from '@playwright/test'
import { loginAPI, openApp, USERS } from './support/app'

// 1×1 PNG (fictitious avatar).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Perfil e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/')
    await loginAPI(page, USERS.ana)
  })

  test('edição de perfil com erros de validação e da API; persiste após refresh', async ({ page }) => {
    await page.goto('/perfil')
    const form = page.getByTestId('profile-form')
    await form.getByLabel('Nome de exibição').fill('A')
    await form.getByLabel('E-mail').fill('invalido')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Mínimo de 2 caracteres')).toBeVisible()
    await expect(form.getByText('E-mail inválido')).toBeVisible()
    await expect(form.getByLabel('Nome de exibição')).toBeFocused()

    // Conflict from the API (e-mail of another user)
    await form.getByLabel('Nome de exibição').fill('Ana S.')
    await form.getByLabel('E-mail').fill(USERS.bruno.email)
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Este e-mail já está em uso')).toBeVisible()

    await form.getByLabel('E-mail').fill('ana.nova@kurio.test')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByRole('status').filter({ hasText: 'Dados do perfil salvos.' })).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('profile-form').getByLabel('Nome de exibição')).toHaveValue('Ana S.')
    await expect(page.getByTestId('profile-form').getByLabel('E-mail')).toHaveValue('ana.nova@kurio.test')
  })

  test('avatar: alterar e remover', async ({ page }) => {
    await page.goto('/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('avatar-preview').getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-preview').getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-preview').getByRole('img', { name: 'Sem avatar' })).toBeVisible()
  })

  test('alteração de senha: senha atual incorreta, confirmação e sucesso', async ({ page }) => {
    await page.goto('/perfil')
    const form = page.getByTestId('profile-form')
    await form.getByLabel('Senha atual').fill('errada000')
    await form.getByLabel('Nova senha', { exact: true }).fill('novaSenha1')
    await form.getByLabel('Confirmar nova senha').fill('outra0000')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('As senhas não coincidem')).toBeVisible()

    await form.getByLabel('Confirmar nova senha').fill('novaSenha1')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Senha atual incorreta').first()).toBeVisible()

    await form.getByLabel('Senha atual').fill(USERS.ana.password)
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByRole('status').filter({ hasText: 'Senha alterada.' })).toBeVisible()

    // New password works
    const ok = await page.evaluate(async () => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ana@kurio.test', password: 'novaSenha1' }),
      })
      return r.ok
    })
    expect(ok).toBe(true)
  })

  test('carteiras principal e secundária com validação', async ({ page }) => {
    await page.goto('/perfil/carteiras')
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Cofre principal')
    await page.getByRole('button', { name: 'Editar' }).first().click()
    const primary = page.getByTestId('primary-wallet-form')
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText(/Endereço inválido/)).toBeVisible()
    await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await primary.getByLabel('Apelido da carteira').fill('Cofre editado')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Cofre editado')

    // Secondary
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByTestId('secondary-wallet-form')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByRole('alert').filter({ hasText: 'Selecione uma rede' })).toBeVisible()
    await secondary.getByLabel('Nome de exibição').fill('Ana Reserva')
    await secondary.getByLabel('Apelido da carteira').fill('Reserva')
    await secondary.getByLabel('Rede').selectOption('polygon')
    await secondary.getByLabel('Nome do perfil').fill('ana.reserva')
    await secondary.getByLabel('Endereço da carteira').fill('0x2222222222222222222222222222222222222222')
    await secondary.getByLabel('Tipo de carteira').selectOption('coinbase')
    await secondary.getByLabel('Código de indicação').fill('ANA-2')
    await secondary.getByLabel('E-mail').fill('reserva@kurio.test')
    await secondary.getByLabel('Nome ENS').fill('anareserva')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-secondary')).toContainText('Reserva')
    await page.reload()
    await expect(page.getByTestId('wallet-summary-secondary')).toContainText('Polygon')
  })
})
