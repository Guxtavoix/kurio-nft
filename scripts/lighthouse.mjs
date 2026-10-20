// Lighthouse audit: home + NFT detail, mobile + desktop, 3 runs each.
// Uses the optimized build served by `vite preview` with the default mock
// scenario (no artificial changes for the audit). Outputs:
//   lighthouse/reports/<page>-<profile>-run<N>.report.{html,json}
//   lighthouse/summary.json + lighthouse/SUMMARY.md (medians, LCP/CLS/TBT)
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PORT = 4174
const BASE = `http://localhost:${PORT}`
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'detail', path: '/nft/emerald-ape-042' },
]
const PROFILES = ['mobile', 'desktop']
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = 'lighthouse'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function waitFor(url, ms = 30_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`server did not start: ${url}`)
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
})
const results = []
let chrome
try {
  await waitFor(BASE)
  await mkdir(path.join(OUT, 'reports'), { recursive: true })
  // Chromium from Playwright, exposed over CDP for Lighthouse.
  const CDP_PORT = 9223
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${CDP_PORT}`, '--disable-gpu'],
  })
  chrome = { port: CDP_PORT, kill: () => browser.close() }

  for (const page of PAGES) {
    for (const profile of PROFILES) {
      for (let run = 1; run <= RUNS; run++) {
        const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: CATEGORIES }
        const config = profile === 'desktop' ? desktopConfig : undefined
        const res = await lighthouse(`${BASE}${page.path}`, flags, config)
        const [html, json] = res.report
        const base = path.join(OUT, 'reports', `${page.name}-${profile}-run${run}.report`)
        await writeFile(`${base}.html`, html)
        await writeFile(`${base}.json`, json)
        const lhr = res.lhr
        const entry = {
          page: page.name,
          profile,
          run,
          scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
          lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
          cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
          tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
        }
        results.push(entry)
        console.log(`${page.name} ${profile} #${run}`, entry.scores, `LCP ${entry.lcpMs}ms CLS ${entry.cls} TBT ${entry.tbtMs}ms`)
      }
    }
  }
} finally {
  await chrome?.kill()
  server.kill()
}

const groups = []
for (const page of PAGES) {
  for (const profile of PROFILES) {
    const rs = results.filter((r) => r.page === page.name && r.profile === profile)
    groups.push({
      page: page.name,
      profile,
      runs: rs.length,
      median: {
        ...Object.fromEntries(CATEGORIES.map((c) => [c, median(rs.map((r) => r.scores[c]))])),
        lcpMs: median(rs.map((r) => r.lcpMs)),
        cls: median(rs.map((r) => r.cls)),
        tbtMs: median(rs.map((r) => r.tbtMs)),
      },
    })
  }
}

const env = {
  date: new Date().toISOString(),
  lighthouse: require('lighthouse/package.json').version,
  chromium: chromium.name() + ' (Playwright ' + require('@playwright/test/package.json').version + ')',
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  conditions:
    'vite preview (build otimizado), mocks MSW no cenário padrão (latência "realistic"), Chrome headless; mobile = throttling simulado padrão do Lighthouse (Moto G Power, 4G lento); desktop = preset desktop.',
}
await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ env, groups, results }, null, 2))

const rows = groups
  .map(
    (g) =>
      `| ${g.page} | ${g.profile} | ${g.median.performance} | ${g.median.accessibility} | ${g.median['best-practices']} | ${g.median.seo} | ${g.median.lcpMs} ms | ${g.median.cls} | ${g.median.tbtMs} ms |`,
  )
  .join('\n')
const md = `# Lighthouse — resumo (medianas de ${RUNS} execuções)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Ambiente
- Data: ${env.date}
- Lighthouse: ${env.lighthouse}
- Navegador: ${env.chromium}
- Node: ${env.node}
- SO: ${env.os}
- CPU: ${env.cpu}
- Condições: ${env.conditions}

Relatórios completos (HTML/JSON) em \`lighthouse/reports/\`.
`
await writeFile(path.join(OUT, 'SUMMARY.md'), md)
console.log(md)
