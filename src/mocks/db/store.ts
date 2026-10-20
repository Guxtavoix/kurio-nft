import { buildNftFixtures } from '../fixtures/nfts'
import { SEED_FAVORITES, SEED_USERS, SEED_WALLETS } from '../fixtures/users'
import type { DbState } from './types'

/**
 * In-memory database for the mock API, persisted to localStorage so the demo
 * survives a page refresh. Both the REST handlers and the Socket.IO mock read
 * and write this same object, which keeps REST responses and realtime events
 * consistent. `resetDb()` restores the seed exactly.
 */
const STORAGE_KEY = 'kurio:mock-db'
const SCHEMA = 1

export function seedState(): DbState {
  return {
    schema: SCHEMA,
    nfts: buildNftFixtures(),
    users: structuredClone(SEED_USERS),
    sessions: [],
    carts: [],
    favorites: structuredClone(SEED_FAVORITES),
    wallets: structuredClone(SEED_WALLETS),
    walletConnections: [],
    quotes: [],
    orders: [],
    idempotency: [],
    eventSeq: 0,
  }
}

function load(): DbState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA) return parsed
    }
  } catch {
    // Corrupted or unavailable storage → fall back to the seed.
  }
  return seedState()
}

export const db: DbState = load()

let saveScheduled = false
/** Persist after the current task; batches multiple writes of one request. */
export function persist() {
  if (saveScheduled) return
  saveScheduled = true
  queueMicrotask(() => {
    saveScheduled = false
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch {
      // Quota exceeded or storage disabled: keep running in memory.
    }
  })
}

export function resetDb() {
  Object.assign(db, seedState())
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // ignore
  }
}

export function nextEventId() {
  db.eventSeq += 1
  persist()
  return `evt_${String(db.eventSeq).padStart(6, '0')}`
}
