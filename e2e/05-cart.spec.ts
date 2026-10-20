import { expect, test } from '@playwright/test'
import { addToCart, loginAPI, openApp, USERS } from './support/app'

test.describe('Carrinho', () => {
  test('quantidades, remoção e resumo coerente com a API', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'emerald-ape-042', 2)
    await addToCart(page, 'golden-beat-207')
    await page.goto('/carrinho')
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(2)
    // 2 × 1.19 + 0.99 = 3.37; fee 0.016 → 3.386
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.37 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('3.386 ETH')

    const emerald = lines.filter({ hasText: 'Emerald Ape #042' })
    await emerald.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(emerald.getByTestId('quantity-value')).toHaveText('3')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('4.56 ETH')

    await lines.filter({ hasText: 'Golden Beat #207' }).getByRole('button', { name: /Remover Golden Beat/ }).first().click()
    await expect(lines).toHaveCount(1)
    await expect(page.getByTestId('summary-total')).toHaveText('3.586 ETH')
  })

  test('cupom válido, inválido e expirado', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'violet-nomad-314')
    await page.goto('/carrinho')
    const input = page.getByTestId('coupon-input')
    await input.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Código promocional inválido.')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    await input.fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este código promocional expirou.')).toBeVisible()

    await input.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    // 10% of 1.39 = 0.139 → total 1.39 - 0.139 + 0.016 = 1.267
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.139')
    await expect(page.getByTestId('summary-total')).toHaveText('1.267 ETH')

    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 00.00')
  })

  test('persiste após refresh e itens do visitante são preservados ao autenticar', async ({ page }) => {
    await openApp(page, '/')
    await addToCart(page, 'cosmic-bloom-118')
    await page.goto('/carrinho')
    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await loginAPI(page, USERS.bruno)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line').filter({ hasText: 'Cosmic Bloom #118' })).toHaveCount(1)
  })
})
