import { REGIONS } from './mapData.generated'
import { RACE_BY_ID, POWER_BY_ID, RACES, POWERS } from './abilities'
import {
  LOST_TRIBE,
  type Ability,
  type AbilityContext,
  type Combo,
  type FactionState,
  type GameState,
  type RegionData,
  type RegionState,
} from './types'

export const REGION_BY_ID: Record<string, RegionData> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
)
export { REGIONS }

export const DIE_FACES = [0, 0, 0, 1, 2, 3]
export const TRAY_SIZE = 6
export const ROUNDS_BY_PLAYERS: Record<number, number> = { 2: 10, 3: 10, 4: 9, 5: 8 }

export interface BoardDef { id: string; name: string; landmasses: string[]; desc: string }

export const BOARDS: BoardDef[] = [
  { id: 'kalimdor', name: 'Kalimdor', landmasses: ['kalimdor', 'teldrassil', 'theramore', 'maelstrom'], desc: 'Tablero compacto \u00b7 ideal 2 jugadores' },
  { id: 'eastern', name: 'Reinos del Este', landmasses: ['eastern-kingdoms', 'quel-danas', 'tolbarad', 'maelstrom'], desc: 'Tablero medio \u00b7 ideal 3 jugadores' },
  { id: 'azeroth', name: 'Azeroth completo', landmasses: Array.from(new Set(REGIONS.map((r) => r.landmass))), desc: 'Mundo entero \u00b7 ideal 4-5 jugadores' },
]

export function defaultBoardFor(players: number): string {
  if (players <= 2) return 'kalimdor'
  if (players === 3) return 'eastern'
  return 'azeroth'
}

/** regions that are part of the board currently in play */
export function boardRegions(state: GameState): RegionData[] {
  return REGIONS.filter((r) => state.landmasses.includes(r.landmass))
}

/* ------------------------------------------------------------------ rng */
export function nextRandom(state: GameState): number {
  // mulberry32
  state.rng = (state.rng + 0x6d2b79f5) >>> 0
  let t = state.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(state: GameState, arr: T[]) => arr[Math.floor(nextRandom(state) * arr.length)]

/* -------------------------------------------------------------- helpers */
export function abilitiesOf(f: FactionState): Ability[] {
  const list = [RACE_BY_ID[f.raceId], POWER_BY_ID[f.powerId]].filter(Boolean)
  return f.inDecline ? list.filter((a) => a.activeInDecline) : list
}

export function regionsOf(state: GameState, uid: string): RegionData[] {
  return boardRegions(state).filter((r) => state.regions[r.id].owner === uid)
}

export function ctxOf(state: GameState, f: FactionState): AbilityContext {
  return { state, faction: f, owned: regionsOf(state, f.uid) }
}

export function factionLabel(f: FactionState): string {
  const race = RACE_BY_ID[f.raceId]?.name ?? f.raceId
  const power = POWER_BY_ID[f.powerId]?.name ?? f.powerId
  return `${race} ${power}`
}

export function ownerPlayer(state: GameState, uid: string | null): number | null {
  if (!uid || uid === LOST_TRIBE) return null
  return state.factions[uid]?.playerId ?? null
}

/** total tokens a faction has left in its supply + board */
export function factionTokenTotal(state: GameState, f: FactionState): number {
  return f.hand + regionsOf(state, f.uid).reduce((s, r) => s + state.regions[r.id].tokens, 0)
}

/* ------------------------------------------------------- defense & cost */
export function defenseOf(state: GameState, regionId: string): number {
  const region = REGION_BY_ID[regionId]
  const st = state.regions[regionId]
  let d = st.tokens + st.fortress + (region.mountain ? 1 : 0)
  if (st.owner && st.owner !== LOST_TRIBE) {
    const f = state.factions[st.owner]
    for (const a of abilitiesOf(f)) d += a.defenseBonus?.(ctxOf(state, f), region) ?? 0
  }
  return d
}

export interface CostInfo {
  cost: number
  reachable: boolean
  reason?: string
  viaSea: boolean
}

export function conquestCost(state: GameState, regionId: string): CostInfo {
  const region = REGION_BY_ID[regionId]
  const st = state.regions[regionId]
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return { cost: 99, reachable: false, reason: 'Sin raza activa', viaSea: false }
  const f = state.factions[uid]
  const ctx = ctxOf(state, f)

  if (st.hero) return { cost: 99, reachable: false, reason: 'Protegida por un héroe', viaSea: false }
  if (st.owner === uid) return { cost: 99, reachable: false, reason: 'Ya la ocupas', viaSea: false }
  if (st.owner && st.owner !== LOST_TRIBE) {
    const enemy = state.factions[st.owner]
    if (enemy.playerId === player.id) {
      return { cost: 99, reachable: false, reason: 'Es tu raza en declive', viaSea: false }
    }
    if (state.players[enemy.playerId].peaceWith === player.id) {
      return { cost: 99, reachable: false, reason: 'Tratado diplomático', viaSea: false }
    }
  }

  const owned = ctx.owned
  const adjacent = owned.some((r) => r.neighbors.includes(regionId))
  const ignores = abilitiesOf(f).some((a) => a.ignoresAdjacency?.(ctx, region))
  const seaEntry = region.coastal
  let reachable = adjacent || ignores || seaEntry
  // the very first conquest of a race must start from the sea or a flying power
  if (owned.length === 0) reachable = seaEntry || ignores

  const viaSea = !adjacent && !ignores && seaEntry

  let cost = 2 + defenseOf(state, regionId)
  for (const a of abilitiesOf(f)) cost += a.conquestCost?.(ctx, region) ?? 0
  if (viaSea) {
    const freeSea = f.raceId === 'murlocs' || f.powerId === 'seafaring'
    if (!freeSea) cost += 1
  }
  cost = Math.max(1, cost)

  return {
    cost,
    reachable,
    reason: reachable ? undefined : owned.length === 0 ? 'Empieza por una región costera' : 'No es adyacente',
    viaSea,
  }
}

/* ------------------------------------------------------------- creation */
function shuffle<T>(state: GameState, arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface PlayerConfig {
  name: string
  isBot: boolean
}

export function createGame(configs: PlayerConfig[], seed = Date.now(), boardId?: string): GameState {
  const board = BOARDS.find((b) => b.id === (boardId ?? defaultBoardFor(configs.length)))!
  const state: GameState = {
    rng: seed >>> 0,
    boardId: board.id,
    landmasses: board.landmasses,
    players: configs.map((c, i) => ({
      id: i, name: c.name, isBot: c.isBot, coins: 5, activeUid: null, declineUid: null, peaceWith: null,
    })),
    factions: {},
    regions: {},
    tray: [],
    deck: [],
    current: 0,
    round: 1,
    maxRounds: ROUNDS_BY_PLAYERS[configs.length] ?? 9,
    phase: 'pick',
    turn: emptyTurn(),
    log: [],
    winner: null,
  }

  for (const r of REGIONS) {
    const st: RegionState = { owner: null, tokens: 0, fortress: 0, hero: false }
    if (!board.landmasses.includes(r.landmass)) { state.regions[r.id] = st; continue }
    if (r.lostTribe) {
      st.owner = LOST_TRIBE
      st.tokens = 1
    }
    state.regions[r.id] = st
  }

  const races = shuffle(state, RACES.map((r) => r.id))
  const powers = shuffle(state, POWERS.map((p) => p.id))
  const n = Math.min(races.length, powers.length)
  const deck: Combo[] = []
  for (let i = 0; i < n; i++) deck.push({ raceId: races[i], powerId: powers[i], bonusCoins: 0 })
  state.deck = deck
  refillTray(state)
  log(state, -1, `Partida iniciada · ${board.name} · ${state.maxRounds} rondas · ${configs.length} jugadores`)
  return state
}

function emptyTurn() {
  return {
    conquered: [], conqueredOccupied: [], diceUsed: 0, diceLast: null,
    usedFlight: false, declaredDecline: false, firstConquestDone: false, pendingReturns: {},
  }
}

function refillTray(state: GameState) {
  while (state.tray.length < TRAY_SIZE && state.deck.length) state.tray.push(state.deck.shift()!)
}

export function log(state: GameState, playerId: number, text: string) {
  state.log.unshift({ round: state.round, playerId, text })
  if (state.log.length > 200) state.log.pop()
}

/* --------------------------------------------------------------- phases */
export function comboTokens(c: Combo): number {
  return (RACE_BY_ID[c.raceId]?.tokens ?? 0) + (POWER_BY_ID[c.powerId]?.tokens ?? 0)
}

export function selectCombo(state: GameState, index: number): GameState {
  const player = state.players[state.current]
  if (state.phase !== 'pick') return state
  const combo = state.tray[index]
  if (!combo) return state
  const price = index // coins placed on the combos above it
  if (player.coins < price) return state

  player.coins -= price
  for (let i = 0; i < index; i++) state.tray[i].bonusCoins += 1
  player.coins += combo.bonusCoins

  const uid = `${player.id}-${combo.raceId}-${state.round}`
  const faction: FactionState = {
    uid, playerId: player.id, raceId: combo.raceId, powerId: combo.powerId,
    inDecline: false, hand: comboTokens(combo),
    markers: POWER_BY_ID[combo.powerId]?.markers ?? 0,
  }
  state.factions[uid] = faction
  player.activeUid = uid
  if (combo.powerId === 'wealthy') player.coins += 7

  state.tray.splice(index, 1)
  refillTray(state)
  state.phase = 'conquer'
  log(state, player.id, `elige ${factionLabel(faction)} (${faction.hand} fichas)`)
  return state
}

/** picks up all but one token per occupied region into the hand */
export function gatherTokens(state: GameState) {
  const player = state.players[state.current]
  if (!player.activeUid) return
  const f = state.factions[player.activeUid]
  for (const r of regionsOf(state, f.uid)) {
    const st = state.regions[r.id]
    if (st.tokens > 1) {
      f.hand += st.tokens - 1
      st.tokens = 1
    }
  }
}

export function beginTurn(state: GameState) {
  state.turn = emptyTurn()
  const player = state.players[state.current]
  player.peaceWith = null
  if (!player.activeUid) {
    state.phase = 'pick'
  } else {
    state.phase = 'conquer'
    gatherTokens(state)
  }
}

export interface ConquerResult {
  ok: boolean
  message: string
  rolled?: number
}

export function conquer(state: GameState, regionId: string, useDie = false): ConquerResult {
  if (state.phase !== 'conquer') return { ok: false, message: 'No es la fase de conquista' }
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return { ok: false, message: 'Sin raza activa' }
  const f = state.factions[uid]
  const info = conquestCost(state, regionId)
  if (!info.reachable) return { ok: false, message: info.reason ?? 'Inalcanzable' }

  let rolled: number | undefined
  if (f.hand < info.cost) {
    const maxDice = 1 + (abilitiesOf(f).find((a) => a.extraDice)?.extraDice ?? 0)
    if (!useDie) return { ok: false, message: `Necesitas ${info.cost} fichas y tienes ${f.hand}` }
    if (state.turn.diceUsed >= maxDice) return { ok: false, message: 'Ya has usado el dado de refuerzo' }
    if (f.hand < 1) return { ok: false, message: 'Necesitas al menos 1 ficha para lanzar el dado' }
    rolled = pick(state, DIE_FACES)
    state.turn.diceUsed += 1
    state.turn.diceLast = rolled
    if (f.hand + rolled < info.cost) {
      const used = f.hand
      // failed assault: all remaining tokens stay in hand but the conquest ends
      log(state, player.id, `¡El dado saca ${rolled}! Asalto a ${REGION_BY_ID[regionId].name} fallido (${used}+${rolled} < ${info.cost})`)
      return { ok: false, message: `Dado ${rolled}: insuficiente (${used}+${rolled} de ${info.cost})`, rolled }
    }
  }

  const st = state.regions[regionId]
  const spend = Math.min(f.hand, info.cost)
  f.hand -= spend

  // defender loses one token, gets the rest back
  if (st.owner && st.owner !== LOST_TRIBE) {
    const enemy = state.factions[st.owner]
    const back = Math.max(0, st.tokens - 1)
    if (!enemy.inDecline) {
      state.turn.pendingReturns[enemy.uid] = (state.turn.pendingReturns[enemy.uid] ?? 0) + back
    }
    state.turn.conqueredOccupied.push(regionId)
    log(state, player.id, `expulsa a ${factionLabel(enemy)} de ${REGION_BY_ID[regionId].name}`)
  } else if (st.owner === LOST_TRIBE) {
    log(state, player.id, `somete a la tribu perdida de ${REGION_BY_ID[regionId].name}`)
  } else {
    log(state, player.id, `conquista ${REGION_BY_ID[regionId].name}${info.viaSea ? ' (desembarco)' : ''}`)
  }

  st.owner = uid
  st.tokens = spend
  st.fortress = 0
  st.hero = false
  state.turn.conquered.push(regionId)
  state.turn.firstConquestDone = true
  return { ok: true, message: 'Conquista realizada', rolled }
}

export function canDeclineNow(state: GameState): boolean {
  const player = state.players[state.current]
  if (!player.activeUid) return false
  const f = state.factions[player.activeUid]
  if (state.turn.conquered.length === 0) return true
  return abilitiesOf(f).some((a) => a.declineAfterConquest)
}

export function goIntoDecline(state: GameState): GameState {
  const player = state.players[state.current]
  if (!player.activeUid) return state
  const f = state.factions[player.activeUid]

  // the previous declined race disappears completely
  if (player.declineUid) {
    const old = state.factions[player.declineUid]
    for (const r of regionsOf(state, old.uid)) {
      state.regions[r.id] = { owner: null, tokens: 0, fortress: 0, hero: false }
    }
    delete state.factions[old.uid]
    log(state, player.id, `${factionLabel(old)} desaparece del mundo`)
  }

  const keepsAll = abilitiesOf({ ...f, inDecline: false }).some((a) => a.keepsTokensInDecline)
  for (const r of regionsOf(state, f.uid)) {
    const st = state.regions[r.id]
    if (!keepsAll) st.tokens = 1
    st.hero = false
  }
  f.hand = 0
  f.inDecline = true
  player.declineUid = f.uid
  player.activeUid = null
  state.turn.declaredDecline = true
  log(state, player.id, `${factionLabel(f)} entra en DECLIVE`)
  return state
}

export function startRedeploy(state: GameState): GameState {
  if (state.phase !== 'conquer') return state
  state.phase = 'redeploy'
  return state
}

export function placeToken(state: GameState, regionId: string, delta: number): GameState {
  const player = state.players[state.current]
  if (state.phase !== 'redeploy' || !player.activeUid) return state
  const f = state.factions[player.activeUid]
  const st = state.regions[regionId]
  if (st.owner !== f.uid) return state
  if (delta > 0 && f.hand > 0) {
    f.hand -= 1
    st.tokens += 1
  } else if (delta < 0 && st.tokens > 1) {
    st.tokens -= 1
    f.hand += 1
  }
  return state
}

export function autoRedeploy(state: GameState): GameState {
  const player = state.players[state.current]
  if (!player.activeUid) return state
  const f = state.factions[player.activeUid]
  const owned = regionsOf(state, f.uid)
  if (!owned.length) return state
  // reinforce the most exposed regions first (most foreign neighbours)
  const risk = (r: RegionData) =>
    r.neighbors.filter((n) => {
      const o = state.regions[n].owner
      return o && o !== f.uid && ownerPlayer(state, o) !== player.id
    }).length + (r.coastal ? 0.5 : 0)
  const sorted = [...owned].sort((a, b) => risk(b) - risk(a))
  let i = 0
  while (f.hand > 0) {
    const r = sorted[i % sorted.length]
    state.regions[r.id].tokens += 1
    f.hand -= 1
    i++
  }
  return state
}

export function placeMarker(state: GameState, regionId: string): GameState {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return state
  const f = state.factions[uid]
  if (f.markers <= 0) return state
  const st = state.regions[regionId]
  if (st.owner !== uid) return state
  if (f.powerId === 'heroic') {
    if (st.hero) return state
    st.hero = true
  } else if (f.powerId === 'fortified') {
    if (st.fortress > 0) return state
    st.fortress += 1
  } else return state
  f.markers -= 1
  log(state, player.id, `coloca ${f.powerId === 'heroic' ? 'un héroe' : 'una fortaleza'} en ${REGION_BY_ID[regionId].name}`)
  return state
}

export function scoreFor(state: GameState, playerId: number): { total: number; detail: string[] } {
  const player = state.players[playerId]
  const detail: string[] = []
  let total = 0
  for (const uid of [player.activeUid, player.declineUid]) {
    if (!uid) continue
    const f = state.factions[uid]
    const ctx = ctxOf(state, f)
    const base = ctx.owned.length
    total += base
    if (base) detail.push(`${factionLabel(f)}${f.inDecline ? ' (declive)' : ''}: ${base}`)
    for (const a of abilitiesOf(f)) {
      const bonus = a.scoreBonus?.(ctx) ?? 0
      if (bonus) {
        total += bonus
        detail.push(`  ${a.name}: +${bonus}`)
      }
    }
    const forts = ctx.owned.reduce((s, r) => s + state.regions[r.id].fortress, 0)
    if (forts) {
      total += forts
      detail.push(`  Fortalezas: +${forts}`)
    }
  }
  return { total, detail }
}

export function endTurn(state: GameState): GameState {
  const player = state.players[state.current]

  // leftover tokens of the active race go on the board automatically
  if (player.activeUid && state.phase !== 'gameover') autoRedeploy(state)

  // opponents get their routed tokens back on the board
  for (const [uid, n] of Object.entries(state.turn.pendingReturns)) {
    const f = state.factions[uid]
    if (!f || n <= 0) continue
    const owned = regionsOf(state, uid)
    if (!owned.length) continue
    for (let i = 0; i < n; i++) state.regions[owned[i % owned.length].id].tokens += 1
  }

  const { total, detail } = scoreFor(state, player.id)
  player.coins += total
  log(state, player.id, `puntúa ${total} monedas (${detail.join(' · ') || 'sin regiones'})`)

  // next player
  state.current = (state.current + 1) % state.players.length
  if (state.current === 0) state.round += 1
  if (state.round > state.maxRounds) {
    state.phase = 'gameover'
    const best = Math.max(...state.players.map((p) => p.coins))
    state.winner = state.players.findIndex((p) => p.coins === best)
    log(state, -1, `Fin de la partida · gana ${state.players[state.winner].name} con ${best} monedas`)
    return state
  }
  beginTurn(state)
  return state
}

/** legal conquest targets for the current player */
export function legalTargets(state: GameState): { id: string; cost: number; viaSea: boolean }[] {
  const out: { id: string; cost: number; viaSea: boolean }[] = []
  for (const r of boardRegions(state)) {
    const info = conquestCost(state, r.id)
    if (info.reachable) out.push({ id: r.id, cost: info.cost, viaSea: info.viaSea })
  }
  return out
}
