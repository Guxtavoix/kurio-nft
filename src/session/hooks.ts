import { useSyncExternalStore } from 'react'
import { currentOwner, sessionStore, type SessionState } from './store'

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Cache owner for private queries; changes on login/logout. */
export function useOwner() {
  useSession()
  return currentOwner()
}

export function useAuthUser() {
  const s = useSession()
  return s.status === 'authenticated' ? s.user : null
}
