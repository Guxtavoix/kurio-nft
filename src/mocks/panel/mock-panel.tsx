import { FlaskConical, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { mockControl } from '../control'
import { LATENCY_PROFILES, PRESETS, type LatencyProfile, type ScenarioConfig } from '../scenarios'

/**
 * Demo-only control panel for the simulated backend (part of the mocks
 * layer, loaded lazily only when mocks are enabled). It changes the mock
 * server state; the app observes changes through REST and Socket.IO.
 * Opened with the flask button or Alt+Shift+M.
 */
export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<ScenarioConfig>(mockControl.getScenario())
  const [nftId, setNftId] = useState('emerald-ape-042')
  const [price, setPrice] = useState('1.49')
  const [log, setLog] = useState<string>('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'm') setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const refresh = () => setCfg(mockControl.getScenario())
  const run = (label: string, fn: () => unknown) => {
    try {
      fn()
      setLog(`✓ ${label}`)
    } catch (e) {
      setLog(`✗ ${label}: ${(e as Error).message}`)
    }
    refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-surface-dark text-accent-text border-line-soft fixed right-3 bottom-28 z-50 grid size-10 place-items-center rounded-full border shadow-lg md:bottom-4"
        aria-label="Abrir painel de cenários simulados"
        data-testid="mock-panel-open"
      >
        <FlaskConical className="size-5" aria-hidden />
      </button>
    )
  }

  const btn = 'bg-surface-dark border-line-soft hover:border-brand rounded border px-2 py-1 text-left text-xs'
  return (
    <aside
      aria-label="Painel de cenários simulados"
      className="bg-surface-card border-line-soft text-fg fixed right-3 bottom-28 z-50 flex max-h-[70dvh] w-[320px] flex-col gap-3 overflow-y-auto rounded-lg border p-4 text-xs shadow-2xl md:bottom-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-accent-text text-sm font-bold">Cenários simulados (MSW)</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        Preset
        <select
          className="bg-surface-dark rounded p-1"
          defaultValue=""
          onChange={(e) => e.target.value && run(`preset ${e.target.value}`, () => mockControl.setScenario(e.target.value))}
        >
          <option value="">— escolher —</option>
          {Object.keys(PRESETS).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Latência
        <select
          className="bg-surface-dark rounded p-1"
          value={cfg.latency}
          onChange={(e) => run('latência', () => mockControl.setScenario({ ...cfg, latency: e.target.value as LatencyProfile }))}
        >
          {LATENCY_PROFILES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>

      <fieldset className="grid grid-cols-2 gap-1">
        <legend className="mb-1">Alternar</legend>
        {(['offline', 'catalogEmpty', 'outOfOrder', 'paymentDeclined', 'walletReject'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={cfg[k]} onChange={(e) => run(k, () => mockControl.setScenario({ ...cfg, [k]: e.target.checked }))} />
            {k}
          </label>
        ))}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-1">
        <legend className="mb-1">Próxima requisição</legend>
        <button className={btn} onClick={() => run('falha catálogo', () => mockControl.setScenario({ ...cfg, catalogFailures: 1 }))}>Catálogo 500</button>
        <button className={btn} onClick={() => run('falha favorito', () => mockControl.setScenario({ ...cfg, favoriteFailures: 1 }))}>Favorito 500</button>
        <button className={btn} onClick={() => run('preço muda', () => mockControl.setScenario({ ...cfg, priceChangeOnCheckout: true }))}>Preço muda no checkout</button>
        <button className={btn} onClick={() => run('esgota', () => mockControl.setScenario({ ...cfg, soldOutOnCheckout: true }))}>Esgota no checkout</button>
        <button className={btn} onClick={() => run('timeout pedido', () => mockControl.setScenario({ ...cfg, orderTimeout: true }))}>Timeout do pedido</button>
        <button className={btn} onClick={() => run('queda socket', () => mockControl.setScenario({ ...cfg, dropSocketOnOrder: 6000 }))}>Socket cai no pedido</button>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">Evento nft.updated</legend>
        <input className="bg-surface-dark rounded p-1" value={nftId} onChange={(e) => setNftId(e.target.value)} aria-label="ID do NFT" />
        <div className="flex gap-1">
          <input className="bg-surface-dark w-20 rounded p-1" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Novo preço" />
          <button className={btn} onClick={() => run('preço', () => mockControl.updateNft(nftId, { priceEth: price }))}>Mudar preço</button>
          <button className={btn} onClick={() => run('esgotar', () => mockControl.updateNft(nftId, { available: 0 }))}>Esgotar</button>
        </div>
        <div className="flex gap-1">
          <button className={btn} onClick={() => run('duplicado', () => mockControl.replayLast('nft.updated'))}>Reenviar último</button>
          <button className={btn} onClick={() => run('antigo', () => mockControl.sendStaleNftEvent(nftId))}>Evento antigo</button>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-1">
        <legend className="mb-1">Sessão e conexão</legend>
        <button className={btn} onClick={() => run('sessões expiradas', () => mockControl.expireSessions())}>Expirar sessão</button>
        <button className={btn} onClick={() => run('socket derrubado', () => mockControl.dropSockets(5000))}>Derrubar socket (5s)</button>
      </fieldset>

      <button
        type="button"
        className="bg-brand text-ink rounded p-2 font-bold"
        onClick={() => {
          mockControl.reset()
          localStorage.clear()
          sessionStorage.clear()
          location.assign('/')
        }}
      >
        Resetar cenário e dados
      </button>
      <p role="status" className="text-text-secondary min-h-4">
        {log}
      </p>
    </aside>
  )
}
