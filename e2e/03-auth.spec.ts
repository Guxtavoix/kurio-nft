import { expect, test } from '@playwright/test'
import { addToCart, loginUI, mock, openApp, USERS } from './support/app'

test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso', async ({ page }) => {
    await openApp(page, '/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog.getByText('Mínimo de 3 caracteres')).toBeVisible()
    await expect(dialog.getByText('Informe o e-mail')).toBeVisible()

    await dialog.getByPlaceholder('Nome de usuário').fill('novo.colecionador')
    await dialog.getByPlaceholder('Digite seu e-mail').fill(USERS.ana.email) // already registered
    await dialog.getByPlaceholder('Senha', { exact: true }).fill('senha1234')
    await dialog.getByPlaceholder('Confirmar senha').fill('senha9999')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog.getByText('As senhas não coincidem')).toBeVisible()

    await dialog.getByPlaceholder('Confirmar senha').fill('senha1234')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(dialog.getByPlaceholder('Digite seu e-mail')).toHaveAttribute('aria-invalid', 'true')

    await dialog.getByPlaceholder('Digite seu e-mail').fill('novo@kurio.test')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Conta criada com sucesso!')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('login inválido, retorno ao fluxo anterior e sessão após refresh', async ({ page }) => {
    await openApp(page, '/perfil')
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await dialog.getByPlaceholder('Senha').fill('errada123')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByText('E-mail ou senha incorretos').first()).toBeVisible()

    await dialog.getByPlaceholder('Senha').fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil(\?|$)/)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('expiração durante a navegação leva ao login preservando o destino', async ({ page }) => {
    await openApp(page, '/entrar?redirect=%2Fperfil%2Fcarteiras')
    await loginUI(page, USERS.ana)
    await expect(page).toHaveURL(/\/perfil\/carteiras/)
    await mock(page, 'expireSessions')
    await page.getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
    await loginUI(page, USERS.ana)
    await expect(page).toHaveURL(/\/perfil/)
  })

  test('logout e troca de usuário limpam dados privados @desktop-only', async ({ page }) => {
    await openApp(page, '/entrar')
    await loginUI(page, USERS.ana)
    await addToCart(page, 'emerald-ape-042')
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName('Carrinho, 1 item')
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card')).toHaveCount(2)

    await page.getByTestId('account-menu').click()
    await page.getByTestId('logout').click()
    // On a private page → back to login; the visitor sees no private data.
    await expect(page).toHaveURL(/\/entrar/)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName('Carrinho, 0 itens')

    await openApp(page, '/entrar?redirect=%2Fperfil%2Ffavoritos')
    await loginUI(page, USERS.bruno)
    await expect(page.getByRole('heading', { name: 'Nenhum favorito ainda' })).toBeVisible()
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName('Carrinho, 0 itens')
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
  })
})
