# Arquitetura

## Visão geral

```
UI (rotas + componentes)
  └─ hooks de feature (TanStack Query)        ← estado remoto, cache, mutations
       └─ api/endpoints.ts (Axios + zod)      ← transporte tipado, validação de contrato
            └─ rede ── MSW (service worker) ── mocks/handlers (REST)
  └─ realtime/client.ts (socket.io-client)    ← eventos aplicados no cache do Query
            └─ WebSocket ── MSW ws.link + @mswjs/socket.io-binding ── mocks/realtime.ts
mocks/db (estado único, persistido) ← lido/escrito tanto pelo REST quanto pelo Socket.IO
```

- **Contratos tipados de ponta a ponta:** `src/api/contracts/*` (zod) define requisições, respostas, erros e eventos. Os tipos TS são inferidos dos schemas e usados pelos handlers MSW, pelo cliente e pela UI. Toda resposta é validada (`parse`) — uma divergência vira `ApiError{kind:'contract'}` em vez de quebrar a tela.
- **Um único tipo de erro** (`ApiError`): `http | network | timeout | canceled | contract`, com `code`, `fieldErrors` e `details`. Formulários mapeiam `fieldErrors` da API para os campos.
- **Sem dados fictícios fora de `src/mocks`.** Componentes, hooks e o cliente Axios não têm fallback de negócio; o painel de cenários faz parte da camada de mocks e só altera o "servidor".
- **Primeiro paint não espera a rede:** a UI renderiza imediatamente (skeletons) e cada requisição Axios aguarda `networkReady` (resolvido quando o worker do MSW está ativo).

## Rotas (TanStack Router)

| Rota | Tela | Observações |
| --- | --- | --- |
| `/` | Início | Busca/filtros/ordenação/aba/página em `validateSearch` (zod com `.catch`) |
| `/nft/$nftId` | Detalhe | 404 próprio para NFT inexistente |
| `/carrinho` | Carrinho | Visitante ou autenticado |
| `/entrar`, `/cadastro` | Login / Cadastro | Modal sobre o início (desktop), tela cheia (mobile); `?redirect=` |
| `/_private/pagamento` | Pagamento | Protegida |
| `/_private/pedido/$orderId` | Confirmação | Protegida; pendente/confirmado/recusado |
| `/_private/perfil`, `/carteiras`, `/favoritos` | Conta | Protegidas |
| `/em-breve/$secao` | Fora do escopo | Informa claramente que nada foi feito |
| `*` | 404 | `defaultNotFoundComponent` |

A rota pathless `_private` faz o guard em `beforeLoad` e redireciona para `/entrar?redirect=<href>` (com `motivo=expirada` quando aplicável). `safeRedirect` aceita apenas caminhos relativos do mesmo domínio.

## Contratos REST

Base `/api`. Erros sempre no formato `{ error: { code, message, fieldErrors?, details? }, requestId }`.

| Recurso | Método e rota | Corpo / resposta | Erros relevantes |
| --- | --- | --- | --- |
| Cadastro | `POST /auth/register` | `RegisterRequest` → `Session` (201) | 422 `VALIDATION_ERROR`, 409 `CONFLICT` (e-mail/usuário) |
| Login | `POST /auth/login` | `LoginRequest` → `Session` | 401 `UNAUTHENTICATED` |
| Sessão | `GET /auth/session` | → `SessionInfo` | 401 `SESSION_EXPIRED` / `UNAUTHENTICATED` |
| Logout | `POST /auth/logout` | 204 | — |
| Catálogo | `GET /nfts?q&tab&categories&networks&minPrice&maxPrice&sort&page&pageSize` | → `NftListResponse` (itens, paginação e facetas) | 422, 500 |
| Destaques | `GET /nfts/featured` | → `FeaturedResponse` | — |
| Detalhe | `GET /nfts/:id` | → `NftDetail` | 404 `NOT_FOUND`, 503 `UNAVAILABLE` |
| Relacionados | `GET /nfts/:id/related` | → `{ items: NftSummary[] }` | 404 |
| Favoritos | `GET /me/favorites` · `PUT/DELETE /me/favorites/:nftId` | → `FavoritesResponse` · 204 | 401, 404, 500 |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:lineId` | → `Cart` | 409 `AVAILABILITY_CONFLICT` (com `available`/`maxPerOrder`) |
| Preços | `POST /cart/acknowledge` | → `Cart` (aceita os preços atuais) | — |
| Cupom | `PUT /cart/coupon` · `DELETE /cart/coupon` | `{code}` → `Cart` | 422 `COUPON_INVALID` / `COUPON_EXPIRED` |
| Cotação | `GET /cart/quote?network=` | → `Quote` (subtotal, desconto, taxa, total, `issues`, `purchasable`, `expiresAt`) | — |
| Pedido | `POST /orders` + header `Idempotency-Key` | `CreateOrderRequest` → `Order` (201 novo / 200 repetição) | 409 `QUOTE_STALE` (com nova cotação em `details.quote`), 409 `IDEMPOTENCY_CONFLICT`, 409 `WALLET_NOT_CONNECTED` |
| Pedido | `GET /orders/:id` · `GET /orders?status=pending` | → `Order` · `{items}` | 404 (inclusive pedido de outro usuário) |
| Perfil | `GET/PATCH /me/profile` · `PUT/DELETE /me/avatar` · `POST /me/password` | → `Profile` · 204 | 422, 409 |
| Carteiras | `GET /me/wallets` · `PUT /me/wallets/primary` · `PUT /me/wallets/secondary` | → `WalletsResponse` | 422 |
| Conexão | `POST /me/wallets/:id/connect` · `DELETE /me/wallet-connections/:id` | `{network, provider}` → `WalletConnection` | 400 `WALLET_REJECTED`, 422 rede diferente |

Autenticação por `Authorization: Bearer <token>`. O carrinho do visitante é identificado por `X-Cart-Id` (id opaco gerado no cliente); requisições autenticadas usam sempre o carrinho do usuário, nunca um id de visitante.

### Valores em ETH

Trafegam como **strings decimais** (`EthAmount`, até 18 casas). Os cálculos usam `decimal.js` (`src/lib/eth.ts`) no servidor simulado; o cliente **não recalcula totais** — exibe a cotação da API. Formatação: ponto decimal, mínimo 2 e máximo 6 casas (`1.19 ETH`, `0.016 ETH`, `26.846 ETH`), como no layout. O slider de preço usa números apenas na UI e envia strings para a API.

## Eventos Socket.IO

Transporte: `socket.io-client` (WebSocket, `path: /realtime/`, `auth: { token }`). Todo evento tem `eventId` (dedupe), `resource {type,id}`, `version` (ordem) e `occurredAt`.

| Evento | Destino | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | todos os sockets | `priceEth`, `compareAtPriceEth`, `soldOut`, `editions[{id,priceEth,available}]` | Atualiza detalhe, listas, destaques e relacionados no cache; invalida carrinho e cotação; anuncia (aria-live) se o NFT está no carrinho |
| `order.updated` | só sockets autenticados como o dono | `status`, `txHash`, `explorerUrl`, `declineReason` + `userId` | Atualiza o pedido; ao confirmar, invalida carrinho/cotação |

Regras do cliente (`src/realtime/client.ts`):

- **Duplicatas:** conjunto LRU de `eventId` (500) — o efeito é aplicado uma única vez.
- **Ordem:** só aplica se `version` > maior versão conhecida (do socket **ou** do dado REST em cache). Eventos antigos não regridem o estado. Pedidos em estado terminal nunca voltam a `pending`.
- **Isolamento:** eventos de pedido com `userId` diferente do usuário atual são descartados; eventos recebidos por um socket que não é mais o ativo são ignorados.
- **Ciclo de vida:** login/logout/troca de usuário destroem o socket anterior (`removeAllListeners` + `disconnect`) e criam outro autenticado como a nova identidade.
- **Reconexão:** ao reconectar, invalida as queries **ativas** do catálogo e as privadas (`refetchType: 'active'`), reconciliando com o REST. Enquanto desconectado, o pedido pendente faz polling (3 s) como fallback; com socket conectado, 15 s.

### Mock de Socket.IO e limitações

`mocks/realtime.ts` usa `ws.link` do MSW + `@mswjs/socket.io-binding` (que codifica/decodifica os pacotes Engine.IO/Socket.IO). Limitações do binding e como foram tratadas:

- Só o namespace padrão; sem rooms/acks/broadcast. → O mock mantém o próprio registro de conexões e filtra destino por usuário.
- O handshake (`0{…}` / `40`) é falsificado pelo binding, sem autenticação. → O mock lê o pacote `CONNECT` bruto (`40{"token":…}`) para associar o socket ao usuário.
- Não há heartbeat do servidor. → O mock envia ping (`2`) a cada 20 s; sem isso o cliente cai por `ping timeout`.
- Só transporte WebSocket (sem long-polling).
- O MSW reescreve o path padrão `/socket.io/` para `/`, o que colidiria com o WebSocket de HMR do Vite → usamos `path: /realtime/`.
- O `engine.io-client` captura `globalThis.WebSocket` no import → o cliente realtime é importado dinamicamente **depois** de o MSW iniciar.
- Desconexões simuladas fecham o WebSocket (`client.close()`); recusas de reconexão por N ms simulam indisponibilidade.

## Mocks (MSW)

- `mocks/db/store.ts`: um único objeto de estado (catálogo, usuários, sessões, carrinhos, favoritos, carteiras, conexões, cotações, pedidos, chaves de idempotência), persistido em `localStorage` (sobrevive a refresh). `resetDb()` restaura exatamente o seed.
- `mocks/fixtures`: 48 NFTs determinísticos (os 9 do Figma + gerados com seed fixa), 4 edições por NFT (1/1, 1/10, 1/50, aberta) com preço e estoque próprios, 2 usuários, cupons.
- `mocks/handlers`: REST; `route()` aplica latência do cenário, modo offline e converte erros em respostas no formato da API.
- `mocks/domain`: regras (catálogo/facetas, carrinho/cotação, liquidação de pedidos). Mudanças de estoque/preço disparam `nft.updated`; liquidação dispara `order.updated` — REST e eventos sempre refletem o mesmo estado.
- **Idempotência:** `Idempotency-Key` + hash do corpo. Mesma chave e corpo → mesmo pedido (200). Mesma chave com corpo diferente → 409 `IDEMPOTENCY_CONFLICT`.
- **Revalidação no pedido:** o servidor recalcula a cotação do carrinho e compara com a cotação enviada (fingerprint de linhas, preços, desconto, taxa e total) e com a validade; qualquer diferença → 409 `QUOTE_STALE` com a nova cotação.
- **Pedidos:** reservam estoque ao serem criados, liquidam após `orderSettleMs` (timer re-armado ao recarregar; liquidação "preguiçosa" em leituras vencidas); confirmados removem do carrinho **apenas** os itens e quantidades comprados; recusados devolvem o estoque.
- **Cenários** (`mocks/scenarios.ts`): configuráveis, reproduzíveis (PRNG com seed) e consumíveis ("próxima requisição falha"). API de controle em `window.__kurioMock` (usada pelo Playwright e pelo painel).

## Sessão

- Token opaco + usuário público em `localStorage` (`kurio:session`); nunca senhas. Revalidado em `GET /auth/session` no boot.
- Expiração: o interceptor do Axios encerra a sessão local ao receber `SESSION_EXPIRED`/`UNAUTHENTICATED` para o token enviado; um verificador local também encerra quando `expiresAt` passa.
- `session/lifecycle.ts`, a cada troca de identidade: cancela e **remove todo o cache privado** (`['private', …]`), troca o socket e, se a sessão expirou numa rota privada, leva ao login com `redirect` + `motivo=expirada`.
- O checkout salva um rascunho por usuário em `sessionStorage`; após relogar, o formulário é restaurado.
- Abas sincronizadas via evento `storage` (logout em uma aba encerra nas outras).

## Carrinho

- Estado de servidor (TanStack Query, chave `['private', owner, 'cart']`, onde `owner` = `user:<id>` ou `guest:<cartId>`).
- Cada mutation devolve o carrinho completo, que substitui o cache; a cotação é invalidada. Em erro, o carrinho é refeito do servidor.
- A disponibilidade é validada no servidor (`AVAILABILITY_CONFLICT`); o stepper limita a `min(disponível, máximo por pedido)`.
- Cada linha guarda `acknowledgedPriceEth`. Se o preço atual difere, a linha fica `price_changed`, o resumo já mostra o novo valor e o checkout fica bloqueado até "Aceitar novos preços" (`POST /cart/acknowledge`). Linhas `insufficient`/`sold_out` também bloqueiam.
- Ao autenticar (login/cadastro), o carrinho do visitante é mesclado no do usuário respeitando os limites.

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
| --- | --- | --- | --- |
| Lista do catálogo | `['nfts','list', params]` | 30 s | `keepPreviousData`; params normalizados (arrays ordenados) |
| Destaques / relacionados | `['nfts','featured']` / `['nfts','related',id]` | 60 s | |
| Detalhe | `['nfts','detail',id]` | 30 s | patch por `nft.updated` |
| Carrinho / cotação | `['private',owner,'cart' / 'quote',network]` | 15 s / 10 s | invalidados por mutations e eventos |
| Favoritos / perfil / carteiras | `['private',owner,…]` | 60 s / 30 s | |
| Pedido | `['private',owner,'order',id]` | — | polling só enquanto pendente |

- **Retries:** apenas falhas transitórias (rede, timeout, 5xx, 429), até 2, backoff exponencial (0,8 s → 4 s). 4xx nunca. Mutations não têm retry automático — o pedido usa retry explícito com a mesma chave de idempotência (até 2 tentativas extras em timeout/rede).
- **Cancelamento/obsolescência:** o `AbortSignal` do Query é repassado ao Axios; mudar filtros cancela a requisição anterior e, como cada combinação tem sua chave, uma resposta atrasada nunca sobrescreve a lista atual (teste `out-of-order`).
- `refetchOnWindowFocus` (dados velhos) e `refetchOnReconnect`.
- **Atualização otimista:** favoritos — muda na hora, faz rollback para o snapshot anterior se a API falhar e avisa o usuário.
- Loaders das rotas fazem `prefetchQuery` sem bloquear a navegação (sem cascata).

## Pagamento e pedido

1. Dados do colecionador (validação zod; erros da API nos campos). Carteiras cadastradas preenchem rede/endereço/tipo; "Usar outra carteira?" valida e salva como carteira secundária antes de usar.
2. "Carteira e rede": escolha do aplicativo (WalletConnect/MetaMask/Coinbase) e **conexão simulada** (`connect` → conectada, recusada, desconectar). A conexão pertence à sessão e é descartada na troca de usuário.
3. "Confirmar compra" revalida a cotação na API e abre a **revisão** (diálogo com foco preso). Se os valores mudarem enquanto o diálogo está aberto (evento) ou no envio (`QUOTE_STALE`), a revisão mostra os novos valores e exige nova confirmação ("Aceitar novos valores").
4. Envio com `Idempotency-Key` persistida por tentativa (sessionStorage): cliques repetidos reutilizam a mesma promessa; timeout (8 s, timer controlável pelo relógio do teste) e falhas de rede reenviam com a mesma chave → o mesmo pedido.
5. `/pedido/:id`: pendente (recuperável após refresh/reconexão), confirmado (recibo a partir do **snapshot** do pedido — mudanças posteriores no catálogo não afetam) ou recusado (itens preservados no carrinho). O recibo só aparece para pedido confirmado pela simulação. Hash de transação e link do explorer são simulados.

## Acessibilidade

- Skip link; foco visível global (`:focus-visible` com a cor de destaque); navegação por teclado em todos os controles.
- Diálogos e drawers do Radix/shadcn: foco preso, `Esc` fecha, foco volta ao gatilho.
- Formulários: `label` associado, `aria-invalid`, `aria-describedby` com a mensagem; foco no primeiro campo inválido. As mensagens de erro não deslocam o layout (posicionadas no espaço abaixo do campo) — um deslocamento entre `mousedown` e `mouseup` faria o clique no botão de envio se perder.
- Checkboxes/radios nativos sobrepostos ao visual customizado (semântica e teclado nativos).
- Regiões `aria-live` (polite/assertive) para mutations, mudanças em tempo real, reconexão e status do pedido; toasts também anunciados.
- Imagens de NFT com `alt` descritivo; decorativas com `alt=""`. Estados não dependem só de cor (texto "Esgotado", "Preço alterado", ícones + texto).
- Alvos de toque ≥ 24 px (pontos de carrossel com área de toque ampliada).
- `prefers-reduced-motion`: shimmer estático, autoplay do carrossel desligado, transições anuladas.
- Sem overflow horizontal em 390 px; textos em `rem`/px reflowam com zoom.

## Performance e Lighthouse

Resultados (medianas de 3 execuções, build otimizado, mocks no cenário padrão) em [lighthouse/SUMMARY.md](lighthouse/SUMMARY.md):

| Página | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 66 | 100 | 100 | 100 | 5,4 s | 0,026 | 211 ms |
| Início | desktop | 96 | 100 | 100 | 100 | 1,1 s | 0,005 | 17 ms |
| Detalhe | mobile | 70 | 100 | 100 | 100 | 5,2 s | 0 | 102 ms |
| Detalhe | desktop | 97 | 100 | 100 | 100 | 1,1 s | 0 | 0 ms |

**O que foi feito:** imagens do Figma convertidas para WebP em 4 larguras com `srcset/sizes` e dimensões fixas (sem CLS); preload da arte LCP com `imagesrcset`; fontes self-hosted (subset latin, `font-display: swap`); code splitting por rota; primeiro paint sem esperar a rede; `content-visibility: auto` nas seções abaixo da dobra; skeletons com as mesmas dimensões do conteúdo (inclusive a altura reservada para abas/relacionados no detalhe).

**Por que Performance mobile fica abaixo de 90:** o perfil mobile simula CPU 4× mais lenta e 4G lento. O LCP no mobile é a primeira imagem de card do catálogo, que depende de dados — e, nesta entrega, os dados vêm da camada MSW que roda **no próprio navegador**: antes da primeira resposta é preciso baixar/executar o chunk de mocks (~145 KB gzip: MSW, interceptors, parsers Socket.IO e fixtures) e registrar o service worker na primeira visita. Isso acrescenta ~2 s simulados ao caminho crítico, além do JS da aplicação (~95 KB gzip de React/Router/Query). O desafio exige que a auditoria rode com mocks e funcionalidades reais, sem simplificações para a pontuação, então essa camada foi mantida. Com um backend real (`VITE_ENABLE_MOCKS=false`) esse chunk e o registro do worker saem do caminho crítico. Próximos passos possíveis: SSR/pré-renderização do shell, `zod/mini` nos contratos e carregar a camada de mocks em paralelo ao HTML via `modulepreload`.

## Decisões de UX

- Login e cadastro são **rotas** (`/entrar`, `/cadastro`) exibidas como modal sobre o início (fiel ao layout) e em tela cheia no mobile; acesso direto e refresh funcionam.
- "COMPRAR" no detalhe adiciona ao carrinho e leva ao carrinho; no mobile há também o botão de adicionar sem sair da página.
- Filtros de coleção/rede aplicam na hora; faixa de preço aplica em "Aplicar". Chips mostram filtros ativos com remoção individual e "Limpar filtros".
- O resumo do carrinho calcula a taxa em Ethereum (taxa estimada); no pagamento a rede escolhida define a taxa.
- Ações fora do escopo (newsletter, login social, esqueci a senha, redes sociais, criadores, ajuda etc.) levam a uma página "fora do escopo da demonstração" ou mostram aviso honesto — nunca simulam sucesso.
- Painel de cenários visível no build de demonstração (botão flutuante) para o avaliador reproduzir falhas.

## Desvios do Figma e substituições de assets

- **Assets:** as 4 artes originais vieram do Figma (exportadas em `assets-src/figma`) e foram convertidas para WebP. Os 48 NFTs reutilizam essas 4 artes (o arquivo não tem outras). Ícones SVG baixados do Figma: header, busca, carrinho, entrar/sair, setas, estrelas, zoom, +/−, lixeira, coração, compartilhar, menu da conta, olho de senha, fechar, Google/Facebook, redes sociais e "thank you". **Substituídos por `lucide-react`** (sem equivalente exportável/legível): ícones da barra inferior mobile, ícone de filtro mobile, alerta/vazio/erro, conexão/offline e spinner.
- **Barra inferior mobile:** o botão central (ícone de "scan") leva ao catálogo, pois não há leitor de código no escopo.
- **Header autenticado:** o layout só mostra "Entrar"; autenticado, o botão vira o menu da conta (avatar + nome).
- **Preço anterior** ("2.29 ETH") segue o layout (cor secundária, sem risco) e é anunciado como "Preço anterior" para leitores de tela.
- **Linhas do carrinho (desktop):** a edição aparece no mobile como no layout; no desktop é anunciada só para leitores de tela, preservando a altura de 70 px.
- **Formulários:** espaçamento entre campos dos modais de autenticação passou de 12 para 20 px para acomodar a mensagem de erro sem deslocar o layout; cor de erro `#ff9a85` (não existe no arquivo) escolhida para contraste ≥ 4,5:1.
- **Pagamento:** acrescentados "Carteira cadastrada" (cartões das carteiras salvas, como no frame mobile), o botão "Conectar carteira" com estados e a revisão do pedido antes do envio — exigências do enunciado que não estão desenhadas.
- **Confirmação:** data no formato local `20 de out. de 2026`; aviso de que a transação é simulada.
- Estados não desenhados (skeletons, vazio, erro, 404, pendente, recusado, toasts) seguem tokens e tipografia do arquivo.

## Limitações conhecidas

- Persistência dos mocks é por navegador (`localStorage`); não há sincronização entre dispositivos.
- Liquidação de pedidos depende de timers no navegador; com a aba fechada, o pedido é liquidado na próxima leitura (liquidação "preguiçosa").
- Socket.IO simulado: só WebSocket e namespace padrão (ver acima).
- Valores e hashes de transação são simulados; links de explorer apontam para redes de teste e não existem de fato.
