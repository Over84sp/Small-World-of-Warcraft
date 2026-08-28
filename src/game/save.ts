import type { GameState } from './types'

const KEY = 'swa:save:v1'
/** bump when GameState changes shape so old saves are discarded instead of crashing */
const SCHEMA = 4

interface Envelope {
  schema: number
  savedAt: number
  state: GameState
}

export interface SaveInfo {
  savedAt: number
  round: number
  maxRounds: number
  boardId: string
  players: { name: string; coins: number; isBot: boolean }[]
  current: number
}

export function saveGame(state: GameState): void {
  try {
    const env: Envelope = { schema: SCHEMA, savedAt: Date.now(), state }
    localStorage.setItem(KEY, JSON.stringify(env))
  } catch {
    // private mode or quota exceeded — the game still works, just without saves
  }
}

function read(): Envelope | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope
    if (env.schema !== SCHEMA || !env.state?.players?.length) {
      localStorage.removeItem(KEY)
      return null
    }
    return env
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function loadGame(): GameState | null {
  return read()?.state ?? null
}

export function savedInfo(): SaveInfo | null {
  const env = read()
  if (!env) return null
  const s = env.state
  return {
    savedAt: env.savedAt,
    round: Math.min(s.round, s.maxRounds),
    maxRounds: s.maxRounds,
    boardId: s.boardId,
    current: s.current,
    players: s.players.map((p) => ({ name: p.name, coins: p.coins, isBot: p.isBot })),
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function describeWhen(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'hace unos segundos'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}
