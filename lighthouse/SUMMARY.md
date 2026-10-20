# Lighthouse — resumo (medianas de 3 execuções)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | 66 | 100 | 100 | 100 | 5398 ms | 0.026 | 211 ms |
| home | desktop | 96 | 100 | 100 | 100 | 1131 ms | 0.005 | 17 ms |
| detail | mobile | 70 | 100 | 100 | 100 | 5221 ms | 0 | 102 ms |
| detail | desktop | 97 | 100 | 100 | 100 | 1131 ms | 0 | 0 ms |

## Ambiente
- Data: 2026-10-20T19:50:49.350Z
- Lighthouse: 13.5.0
- Navegador: chromium (Playwright 1.64.1)
- Node: v24.13.0
- SO: Windows_NT 10.0.26200 x64
- CPU: AMD Ryzen 5 8600G w/ Radeon 760M Graphics      
- Condições: vite preview (build otimizado), mocks MSW no cenário padrão (latência "realistic"), Chrome headless; mobile = throttling simulado padrão do Lighthouse (Moto G Power, 4G lento); desktop = preset desktop.

Relatórios completos (HTML/JSON) em `lighthouse/reports/`.
