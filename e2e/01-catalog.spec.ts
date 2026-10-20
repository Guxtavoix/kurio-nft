import { expect, test } from '@playwright/test'
import { openApp } from './support/app'

test.describe('Catálogo: busca, filtros, ordenação, paginação e histórico', () => {
  test('busca + filtros combinados + ordenação compõem a URL e a API', async ({ page }) => {
    await openApp(page, '/')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByTestId('result-count')).toHaveText('48 NFTs encontrados')

    // Requests carry the filters as query params (REST via MSW).
    const listRequest = (pred: (u: URL) => boolean) =>
      page.waitForRequest((r) => r.url().includes('/api/nfts?') && pred(new URL(r.url())))

    const isMobile = (page.viewportSize()?.width ?? 1440) < 1024
    const filters = async () => {
      if (isMobile) {
        await page.getByRole('button', { name: /^Filtros/ }).click()
        return page.getByRole('dialog')
      }
      return page.getByTestId('catalog-filters')
    }

    let f = await filters()
    let req = listRequest((u) => u.searchParams.get('categories') === 'musica')
    await f.getByLabel(/Música/).check()
    await req
    req = listRequest((u) => u.searchParams.get('networks') === 'ethereum' && u.searchParams.get('categories') === 'musica')
    await f.getByLabel(/Ethereum/).check()
    await req
    if (isMobile) await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/categories=.*musica/)
    await expect(page).toHaveURL(/networks=.*ethereum/)
    const cards = grid.getByTestId('nft-card')
    await expect(cards.first()).toBeVisible()
    await expect(cards.filter({ hasText: 'Golden Signal #160' })).toHaveCount(1)

    // Search (matches name, collection or token id) combined with a filter.
    req = listRequest((u) => u.searchParams.get('q') === 'signal' && u.searchParams.get('categories') === 'musica')
    await page.goto('/?q=signal&categories=%5B%22musica%22%5D&scenario=fast')
    await req
    await expect(cards.first()).toBeVisible()
    for (const name of await cards.locator('h3').allTextContents()) expect(name.toLowerCase()).toContain('signal')
  })

  test('ordenação por preço e paginação; mudança de filtro reinicia a página @desktop-only', async ({ page }) => {
    await openApp(page, '/')
    await page.getByTestId('sort-select').click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    const prices = async () =>
      (await page.getByTestId('nft-card-price').allTextContents()).map((t) => Number(t.replace(' ETH', '')))
    await expect.poll(async () => {
      const p = await prices()
      return p.every((v, i) => i === 0 || p[i - 1]! <= v)
    }).toBe(true)

    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Changing a filter resets pagination.
    await page.getByTestId('catalog-filters').getByLabel(/Polygon/).check()
    await expect(page).not.toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  })

  test('estado sobrevive a refresh e é restaurado pelo histórico @desktop-only', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('#catalog-results')).toHaveAttribute('aria-busy', 'false')
    const page2First = await page.getByTestId('nft-card').first().locator('h3').textContent()

    await page.reload()
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('nft-card').first().locator('h3')).toHaveText(page2First!)

    await page.goBack()
    await expect(page).not.toHaveURL(/page=2/)
    await expect(page).toHaveURL(/tab=trending/)
    await page.goBack()
    await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
    await page.goForward()
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('aria-selected', 'true')
  })

  test('resultado vazio e respostas fora de ordem não sobrescrevem o filtro atual @desktop-only', async ({ page }) => {
    await openApp(page, '/', { scenario: 'out-of-order' })
    const filters = page.getByTestId('catalog-filters')
    // First (slow) request: Música. Second (fast) request: Música + Fotografia.
    await filters.getByLabel(/Música/).check()
    await filters.getByLabel(/Fotografia/).check()
    await expect(page).toHaveURL(/fotografia/)
    // Wait past the slow response; the grid must still reflect both filters.
    await page.waitForTimeout(2300)
    await expect(page.getByTestId('active-filters').or(page.getByLabel('Filtros ativos'))).toContainText('Fotografia')
    const count = await page.getByTestId('result-count').textContent()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('result-count')).toHaveText(count!)

    await page.goto('/?q=nao-existe-nada&scenario=fast')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
  })

  test('faixa de preço digitada nos campos mínimo/máximo, com validação', async ({ page }) => {
    await openApp(page, '/')
    const isMobile = (page.viewportSize()?.width ?? 1440) < 1024
    if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
    const scope = isMobile ? page.getByRole('dialog') : page.getByTestId('catalog-filters')

    // Collections are listed alphabetically.
    const labels = await scope.getByRole('group', { name: 'Coleções' }).locator('label').allInnerTexts()
    const names = labels.map((l) => l.replace(/\(\d+\)[\s\S]*/, '').trim())
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))

    await scope.getByTestId('price-min').fill('3')
    await scope.getByTestId('price-max').fill('1')
    await scope.getByRole('button', { name: 'Aplicar' }).click()
    await expect(scope.getByText('O mínimo não pode ser maior que o máximo')).toBeVisible()

    await scope.getByTestId('price-min').fill('1,5')
    await scope.getByTestId('price-max').fill('4')
    await scope.getByTestId('price-max').press('Enter')
    await expect(page).toHaveURL(/minPrice=%221\.50%22|minPrice=1\.50/)
    await expect(page).toHaveURL(/maxPrice=%224\.00%22|maxPrice=4\.00/)
    if (isMobile) await page.keyboard.press('Escape')
    const prices = (await page.getByTestId('nft-card-price').allTextContents()).map((t) => Number(t.replace(' ETH', '')))
    expect(prices.length).toBeGreaterThan(0)
    for (const p of prices) expect(p >= 1.5 && p <= 4).toBe(true)
  })
})
