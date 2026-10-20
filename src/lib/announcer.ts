/**
 * Screen-reader announcements (aria-live) for things that change without a
 * direct user action: realtime price updates, reconnection, order status.
 * Rendered by <LiveAnnouncer />.
 */
export type Politeness = 'polite' | 'assertive'
type Listener = (message: string, politeness: Politeness) => void

const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite') {
  for (const l of listeners) l(message, politeness)
}

export function onAnnounce(l: Listener) {
  listeners.add(l)
  return () => void listeners.delete(l)
}
