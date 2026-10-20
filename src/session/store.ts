import type { Session, User } from '@/api/contracts'
import type { Owner } from '@/api/query-keys'

/**
 * Client session state (outside React so the Axios client and the socket can
 * read it synchronously). Persisted in localStorage → survives refresh; the
 * token is revalidated against GET /api/auth/session on boot.
 *
 * Only the opaque token and public profile are stored — never passwords.
 */
export type SessionState =
  | { status: 'anonymous'; reason?: 'logout' | 'expired' }
  | { status: 'authenticated'; token: string; user: User; expiresAt: string }

const KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

type Listener = (next: SessionState, prev: SessionState) => void
const listeners = new Set<Listener>()

function read(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Session
      if (s.token && s.user && s.expiresAt) return { status: 'authenticated', ...s }
    }
  } catch {
    // ignore corrupted storage
  }
  return { status: 'anonymous' }
}

let state: SessionState = read()

function write(next: SessionState) {
  const prev = state
  state = next
  try {
    if (next.status === 'authenticated') {
      localStorage.setItem(KEY, JSON.stringify({ token: next.token, user: next.user, expiresAt: next.expiresAt }))
    } else {
      localStorage.removeItem(KEY)
    }
  } catch {
    // storage unavailable: session stays in memory only
  }
  for (const l of listeners) l(next, prev)
}

export const sessionStore = {
  get: () => state,
  token: () => (state.status === 'authenticated' ? state.token : null),
  userId: () => (state.status === 'authenticated' ? state.user.id : null),
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  signIn(session: Session) {
    write({ status: 'authenticated', ...session })
  },
  updateUser(user: User) {
    if (state.status === 'authenticated') write({ ...state, user })
  },
  signOut(reason: 'logout' | 'expired' = 'logout') {
    if (state.status === 'anonymous' && state.reason === reason) return
    write({ status: 'anonymous', reason })
  },
}

// Keep tabs in sync: logging out in one tab logs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    const next = read()
    const prevId = sessionStore.userId()
    const nextId = next.status === 'authenticated' ? next.user.id : null
    if (prevId !== nextId) write(next.status === 'anonymous' ? { status: 'anonymous', reason: 'logout' } : next)
  })
}

/** Opaque id for the visitor's server-side cart (merged on login). */
export function guestCartId(): string {
  try {
    let id = localStorage.getItem(GUEST_CART_KEY)
    if (!id) {
      const bytes = crypto.getRandomValues(new Uint8Array(12))
      id = `guest_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
      localStorage.setItem(GUEST_CART_KEY, id)
    }
    return id
  } catch {
    return 'guest_memoryonly0000'
  }
}

/** Cache owner for private queries: the user, or the visitor's cart. */
export function currentOwner(): Owner {
  const s = sessionStore.get()
  return s.status === 'authenticated' ? `user:${s.user.id}` : `guest:${guestCartId()}`
}

/** After a successful merge the guest cart is gone server-side. */
export function rotateGuestCartId() {
  try {
    localStorage.removeItem(GUEST_CART_KEY)
  } catch {
    // ignore
  }
}
