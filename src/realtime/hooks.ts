import { useSyncExternalStore } from 'react'
import type { ConnectionStatus, RealtimeClient } from './client'

let client: RealtimeClient | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** The client is created after the network layer is ready (see main.tsx). */
export function registerRealtime(c: RealtimeClient) {
  client = c
  c.onStatus(notify)
  notify()
}
export const getRealtime = () => client

/** External store over the socket status (for UI and polling fallbacks). */
export const realtimeStatus = {
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
  get: (): ConnectionStatus => client?.getStatus() ?? 'idle',
}

export function useRealtimeStatus() {
  return useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get)
}
