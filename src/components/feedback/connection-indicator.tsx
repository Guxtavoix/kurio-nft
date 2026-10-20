import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRealtimeStatus } from '@/realtime/hooks'

/**
 * Visible + announced status when the realtime connection is lost. Shown
 * only after a short grace period to avoid flashing on quick reconnects.
 */
export function ConnectionIndicator() {
  const status = useRealtimeStatus()
  const [show, setShow] = useState(false)
  const down = status === 'reconnecting' || status === 'offline'

  useEffect(() => {
    if (!down) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(t)
  }, [down])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center md:bottom-6">
      {show && (
        <p
          className="bg-surface-dark text-fg border-line-soft flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg"
          data-testid="realtime-offline"
        >
          <WifiOff className="text-accent-text size-4" aria-hidden />
          Reconectando ao tempo real… os dados podem estar desatualizados.
        </p>
      )}
    </div>
  )
}
