# Kurio — Marketplace de NFTs

Implementação do desafio frontend da Jungle Gaming: marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop e mobile, seguindo o layout do Figma.

- **Demo:** https://kurio-nft-puce.vercel.app
- **Repositório:** https://github.com/Guxtavoix/kurio-nft
- **Arquitetura e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Lighthouse:** [lighthouse/SUMMARY.md](lighthouse/SUMMARY.md)

Toda a API (REST + Socket.IO) é simulada na camada de rede com **MSW** — inclusive no build publicado. Nada de dados fictícios nos componentes, hooks ou no cliente Axios.

## Stack

React 19 · TypeScript · Vite · TanStack Router (file-based) · TanStack Query · Axios · Socket.IO (`socket.io-client`) · Tailwind CSS v4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · Zod (contratos) · decimal.js (valores ETH) · Playwright · Lighthouse.

## Requisitos

- Node.js ≥ 20 (testado com 24.13) e npm ≥ 10.
- Para os testes: `npx playwright install chromium` (uma vez).

## Setup

```bash
npm ci
npm run dev
```

Abra http://localhost:5173. O MSW registra o service worker (`public/mockServiceWorker.js`) automaticamente.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (REST + Socket.IO) |
| `npm run dev:no-mocks` | Desenvolvimento sem mocks (`VITE_ENABLE_MOCKS=false`) |
| `npm run build` | Verificação de tipos + build otimizado (mocks incluídos) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | Verificação de tipos (app + testes) |
| `npm run lint` | oxlint (inclui regras de a11y) |
| `npm run test:e2e` | Playwright (build + preview, desktop e mobile, inclui regressão visual) |
| `npm run test:e2e:ui` | Playwright em modo UI |
| `npm run test:e2e:update` | Regera as baselines visuais |
| `npm run test:report` | Abre o relatório HTML (`playwright-report/`) |
| `npm run lighthouse` | Auditoria Lighthouse (precisa de `npm run build` antes) |
| `npm run images` | Regera as variações WebP das artes do Figma |

## Variáveis de ambiente

Veja `.env.example`.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). `false` aponta para um backend real. |
| `VITE_MOCK_SCENARIO` | _(vazio)_ | Cenário inicial dos mocks (lista abaixo). |
| `VITE_API_URL` | `/api` | Base da API REST. |
| `VITE_SOCKET_URL` | mesma origem | Origem do Socket.IO (path `/realtime/`). |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| Ana Sato | `ana@kurio.test` | `kurio2026` | Tem carteira principal (MetaMask/Ethereum) e 2 favoritos |
| Bruno Lima | `bruno@kurio.test` | `nomad2026` | Sem carteiras (exercita o cadastro de carteira) |

Senhas ficam como hash SHA-256 com salt no banco simulado. Cupons: `KURIO10` (10%), `GENESIS25` (25%), `VERAO2025` (expirado); qualquer outro é inválido.

## Cenários simulados

Três formas de escolher (da maior para a menor prioridade):

1. **Painel de cenários** (botão de frasco no canto inferior direito, ou `Alt+Shift+M`) — disponível no build de demonstração.
2. **URL:** `?scenario=<nome>` no primeiro carregamento (ex.: `/?scenario=slow`). Vale para a aba atual (sessionStorage).
3. **Env:** `VITE_MOCK_SCENARIO=<nome>`.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência realista (180–400 ms, determinística) |
| `fast` | Sem latência; pedidos liquidam em 0,8 s (usado nos testes) |
| `slow` | 2,2 s por requisição (mostra os skeletons) |
| `variable` | Latência variável 0,1–2,5 s (seed fixa → reproduzível) |
| `offline` | Toda chamada REST falha por rede; o socket recusa conexão |
| `catalog-empty` | Catálogo sempre vazio |
| `catalog-error` | Catálogo responde 500 três vezes (1ª tentativa + 2 retries) e depois recupera |
| `detail-error` | Detalhe responde 503 três vezes e depois recupera |
| `out-of-order` | Requisições do catálogo alternam lenta/rápida (respostas fora de ordem) |
| `favorites-fail` | A próxima mutation de favorito falha com 500 (rollback otimista) |
| `price-change` | No próximo envio de pedido, o preço do 1º item muda antes da validação (`QUOTE_STALE`) |
| `sold-out` | No próximo envio, a edição do 1º item esgota |
| `order-timeout` | O próximo pedido é criado, mas a resposta nunca chega (recuperação por idempotência) |
| `payment-declined` | Pedidos são recusados pela "carteira" |
| `wallet-reject` | A conexão da carteira é recusada |
| `socket-drop` | Ao criar o pedido, o socket cai e fica 6 s sem reconectar |
| `short-session` | Sessões expiram em 1 minuto |

**Reset:** botão "Resetar cenário e dados" no painel (restaura o seed do banco, o cenário padrão e limpa a sessão). Em código/teste: `window.__kurioMock.reset()`.

## Como reproduzir os fluxos de falha

Use o painel (ou os comandos `window.__kurioMock.*` no console):

- **Preço/disponibilidade em tempo real:** coloque um NFT no carrinho; no painel, em *Evento nft.updated*, informe o id (ex.: `emerald-ape-042`) e clique *Mudar preço* ou *Esgotar*. O carrinho anuncia a mudança, atualiza o resumo e bloqueia o checkout até aceitar os novos preços.
- **Cotação desatualizada no checkout:** abra a revisão do pedido e dispare *Mudar preço*, ou use *Preço muda no checkout* antes de confirmar.
- **Pagamento recusado:** marque `paymentDeclined`, finalize a compra → tela de recusa; os itens continuam no carrinho.
- **Clique repetido / timeout:** *Timeout do pedido* antes de confirmar → após 8 s o cliente reenvia com a mesma `Idempotency-Key` e recupera o mesmo pedido.
- **Queda de conexão com pedido pendente:** *Socket cai no pedido* antes de confirmar → aviso "Reconectando…", recarregue a página: o pedido pendente é recuperado e confirmado sem nova compra.
- **Eventos duplicados/antigos:** *Reenviar último* e *Evento antigo* → ignorados (dedupe por `eventId`, ordem por `version`).
- **Sessão expirada:** *Expirar sessão* → a próxima ação privada leva ao login com o destino preservado (o rascunho do checkout é restaurado).
- **Falhas e lentidão:** presets `slow`, `catalog-error`, `detail-error`, `offline` + botões *Tentar novamente*.

## Testes (Playwright)

```bash
npx playwright install chromium   # uma vez
npm run test:e2e
npm run test:report
```

- Rodam contra o **build otimizado** (`vite preview`) com os mesmos mocks do deploy.
- Projetos: `desktop-chromium` (1440×900) e `mobile-chromium` (390×844). Testes de interações exclusivas de desktop têm a tag `@desktop-only`.
- Cada teste usa um contexto novo (storage vazio → banco simulado no seed).
- Relatório HTML em `playwright-report/`; traces, vídeo e screenshot apenas nas falhas (`test-results/`).
- Regressão visual: `e2e/13-visual.spec.ts`, baselines em `e2e/__screenshots__/` (início, detalhe, carrinho, pagamento, nos dois viewports).

| Spec | Cobertura |
| --- | --- |
| `01-catalog` | Busca, filtros combinados, ordenação, paginação, histórico/refresh, vazio, fora de ordem |
| `02-nft-detail` | Acesso direto, 404 de NFT e de rota, edição indisponível, limite de quantidade, erro + retry |
| `03-auth` | Cadastro (validação + conflito), login, retorno ao fluxo, expiração, logout e troca de usuário |
| `04-favorites` | Persistência, falha da mutation com rollback e nova tentativa |
| `05-cart` | Quantidades, remoção, cupom (válido/inválido/expirado), refresh e merge ao autenticar |
| `06-purchase` | Catálogo → detalhe → carrinho → login → pagamento → recibo confirmado |
| `07-payment-failures` | Recusa, cliques repetidos, timeout com recuperação do mesmo pedido, carteira recusada |
| `08-account` | Perfil, avatar, senha e carteiras com erros de validação e da API |
| `09-realtime-checkout` | Preço/disponibilidade via Socket.IO no carrinho e na revisão; `QUOTE_STALE`; edição esgotada |
| `10-realtime-resilience` | Eventos duplicados/antigos, evento de outro usuário, queda de socket e retomada de pedido |
| `11-a11y-keyboard` | Skip link, teclado, foco preso em diálogo, erros associados aos campos |
| `12-loading-errors` | Skeletons com rede lenta, falha + nova tentativa, offline |
| `13-visual` | Regressão visual |

Os testes de tempo real passam pelo `socket.io-client` real (eventos emitidos pelo servidor Socket.IO simulado no MSW) e os de REST pelos handlers MSW. O teste de timeout controla o relógio com `page.clock`.

## Lighthouse

```bash
npm run build
npm run lighthouse
```

Mede início e detalhe, em mobile e desktop, 3 vezes cada, e grava `lighthouse/reports/*.html|json`, `lighthouse/summary.json` e `lighthouse/SUMMARY.md` (medianas, LCP/CLS/TBT, versões e ambiente). A análise dos resultados está em [ARCHITECTURE.md → Performance](ARCHITECTURE.md#performance-e-lighthouse).

## Deploy (Vercel)

`vercel.json` configura o build (`npm run build` → `dist`), o rewrite de SPA (acesso direto e refresh em qualquer rota) e cache dos assets. Os mocks ficam ativos no build publicado.

```bash
npx vercel --prod
```

## Estrutura

```
src/
  api/          contratos (zod), Axios, endpoints, chaves e política do Query
  realtime/     cliente Socket.IO (dedupe, versão, reconciliação)
  session/      sessão do cliente e ciclo de vida (limpeza de cache/socket)
  features/     catalog, cart, favorites, auth, account, checkout (hooks + telas)
  components/   layout, feedback, ui (shadcn adaptado), nft
  routes/       rotas file-based do TanStack Router
  mocks/        MSW: db + fixtures, handlers REST, Socket.IO, cenários, painel
e2e/            testes Playwright + baselines visuais
scripts/        otimização de imagens, download de assets do Figma, Lighthouse
assets-src/     imagens originais exportadas do Figma
```
