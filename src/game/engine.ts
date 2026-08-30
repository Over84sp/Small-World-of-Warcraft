import { REGIONS } from './mapData.generated'
import { RACE_BY_ID, POWER_BY_ID, RACES, POWERS, RACE_SIDE, isEnemyRegion } from './abilities'
import { LEGENDARY_DEFS, LEGENDARY_BY_ID, computeLegendaryBonus } from './legendary'
import {
  LOST_TRIBE,
  type Side,
  type Ability,
  type AbilityContext,
  type Combo,
  type FactionState,
  type GameState,
  type RegionData,
  type RegionState,
  type LegendaryTile,
} from './types'

export const REGION_BY_ID: Record<string, RegionData> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
)
export { REGIONS }

export const DIE_FACES = [0, 0, 0, 1, 2, 3]
export const TRAY_SIZE = 6
export const ROUNDS_BY_PLAYERS: Record<number, number> = { 2: 10, 3: 10, 4: 9, 5: 8 }

export interface BoardDef { id: string; name: string; landmasses: string[]; desc: string; size?: 'S' | 'M' | 'L' }

export const ISLANDS: BoardDef[] = [
  { id: 'small_a', name: 'Isla Pequeña A', landmasses: ['small_a'], desc: '7 regiones', size: 'S' },
  { id: 'small_b', name: 'Isla Pequeña B', landmasses: ['small_b'], desc: '7 regiones', size: 'S' },
  { id: 'medium_a', name: 'Isla Mediana A', landmasses: ['medium_a'], desc: '9 regiones', size: 'M' },
  { id: 'medium_b', name: 'Isla Mediana B', landmasses: ['medium_b'], desc: '9 regiones', size: 'M' },
  { id: 'large_a', name: 'Isla Grande A', landmasses: ['large_a'], desc: '11 regiones', size: 'L' },
  { id: 'large_b', name: 'Isla Grande B', landmasses: ['large_b'], desc: '11 regiones', size: 'L' },
]

// Configuraciones oficiales por número de jugadores (S7 M9 L11)
export const BOARDS: BoardDef[] = [
  { id: '2p', name: '2 jugadores: 1 grande + 1 pequeña', landmasses: [], desc: '18 regiones · 10 rondas' },
  { id: '3p', name: '3 jugadores: 1 grande +1 mediana +1 pequeña', landmasses: [], desc: '27 regiones · 10 rondas' },
  { id: '4p', name: '4 jugadores: 1 grande +2 medianas +1 pequeña', landmasses: [], desc: '36 regiones · 9 rondas' },
  { id: '5p', name: '5 jugadores: 2 grandes +1 mediana +2 pequeñas', landmasses: [], desc: '45 regiones · 8 rondas' },
  { id: '6p', name: '6 jugadores: todas las islas', landmasses: ['small_a', 'small_b', 'medium_a', 'medium_b', 'large_a', 'large_b'], desc: '54 regiones · experimental' },
  { id: 'official', name: 'Oficial aleatorio', landmasses: [], desc: 'Selección aleatoria según jugadores' },
]

function selectOfficialIslands(playerCount: number, rng: () => number): string[] {
  const small = ['small_a', 'small_b']
  const medium = ['medium_a', 'medium_b']
  const large = ['large_a', 'large_b']
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]
  if (playerCount <= 2) {
    return [pick(large), pick(small)]
  }
  if (playerCount === 3) {
    return [pick(large), pick(medium), pick(small)]
  }
  if (playerCount === 4) {
    return [pick(large), ...medium, pick(small)]
  }
  if (playerCount >= 5) {
    if (playerCount === 5) {
      return [...large, pick(medium), ...small]
    }
    return [...small, ...medium, ...large]
  }
  return [...small, ...medium, ...large].slice(0, playerCount * 9)
}

export function defaultBoardFor(players: number): string {
  if (players <= 2) return '2p'
  if (players === 3) return '3p'
  if (players === 4) return '4p'
  return '5p'
}

/** regions that are part of the board currently in play */
const boardRegionsCache = new Map<string, RegionData[]>()

/** shelf bin-packing: lays out each landmass's own footprint edge-to-edge
 *  so islands read as one archipelago instead of scattered specks of land */
function packLandmasses(ids: string[]): Map<string, { dx: number; dy: number }> {
  const boxes = ids.map((id) => {
    const regs = REGIONS.filter((r) => r.landmass === id)
    const xs = regs.flatMap((r) => r.polygon.map((p) => p[0]))
    const ys = regs.flatMap((r) => r.polygon.map((p) => p[1]))
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    return { id, x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }
  })
  boxes.sort((a, b) => b.h - a.h)
  const gap = 70
  const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)))
  const maxRowWidth = Math.max(...boxes.map((b) => b.w)) * cols + gap * cols
  let cursorX = 0
  let cursorY = 0
  let rowH = 0
  const offsets = new Map<string, { dx: number; dy: number }>()
  for (const b of boxes) {
    if (cursorX > 0 && cursorX + b.w > maxRowWidth) {
      cursorX = 0
      cursorY += rowH + gap
      rowH = 0
    }
    offsets.set(b.id, { dx: cursorX - b.x0, dy: cursorY - b.y0 })
    cursorX += b.w + gap
    rowH = Math.max(rowH, b.h)
  }
  return offsets
}

export function boardRegions(state: GameState): RegionData[] {
  const ids = state.landmasses
  const key = ids.join(',')
  const cached = boardRegionsCache.get(key)
  if (cached) return cached

  let result: RegionData[]
  if (ids.length <= 1) {
    result = REGIONS.filter((r) => ids.includes(r.landmass))
  } else {
    const offsets = packLandmasses(ids)
    result = REGIONS.filter((r) => ids.includes(r.landmass)).map((r) => {
      const off = offsets.get(r.landmass)!
      return {
        ...r,
        polygon: r.polygon.map(([x, y]) => [x + off.dx, y + off.dy] as [number, number]),
        center: [r.center[0] + off.dx, r.center[1] + off.dy] as [number, number],
      }
    })
  }
  boardRegionsCache.set(key, result)
  return result
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

/** the banner a faction fights under */
export function sideOf(f: FactionState): Side {
  return RACE_SIDE[f.raceId] ?? 'neutral'
}

/** enemy-banner regions taken this turn, i.e. the plunder bonus */
export function plunderThisTurn(state: GameState, f: FactionState): string[] {
  if (f.inDecline) return []
  const side = sideOf(f)
  return state.turn.conquered.filter((id) => isEnemyRegion(side, REGION_BY_ID[id]))
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
  let d = st.tokens + st.fortress + (region.mountain ? 1 : 0) + (st.wisp ?? 0)
  if (st.hero) d += 1 // the Champion token counts as 1 race token when defending
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
  /** region of your own banner: 1 token cheaper */
  homeland: boolean
  /** region of the enemy banner: pays plunder when conquered */
  plunder: boolean
  /** gnomes: this conquest uses the once-per-turn aerial assault */
  airstrike: boolean
  /** ethereals: this conquest uses their once-per-turn legendary discount */
  ethereal: boolean
  /** Champion power: could take this adjacent region for a single token */
  champion: boolean
}

export function conquestCost(state: GameState, regionId: string): CostInfo {
  const region = REGION_BY_ID[regionId]
  const st = state.regions[regionId]
  const player = state.players[state.current]
  const uid = player.activeUid
  const blank = { airstrike: false, ethereal: false, champion: false }
  if (!uid) return { cost: 99, reachable: false, reason: 'Sin raza activa', viaSea: false, homeland: false, plunder: false, ...blank }
  const f = state.factions[uid]
  const ctx = ctxOf(state, f)

  if (state.turn.assaultFailed) {
    return { cost: 99, reachable: false, reason: 'El asalto fallido ha terminado tus conquistas', viaSea: false, homeland: false, plunder: false, ...blank }
  }
  if (st.tower) return { cost: 99, reachable: false, reason: 'Protegida por una Torre de Vigía', viaSea: false, homeland: false, plunder: false, ...blank }
  if (st.owner === uid) return { cost: 99, reachable: false, reason: 'Ya la ocupas', viaSea: false, homeland: false, plunder: false, ...blank }
  if (st.owner && st.owner !== LOST_TRIBE) {
    const enemy = state.factions[st.owner]
    if (enemy.playerId === player.id) {
      return { cost: 99, reachable: false, reason: 'Es tu raza en declive', viaSea: false, homeland: false, plunder: false, ...blank }
    }
    if (state.players[enemy.playerId].peaceWith === player.id) {
      return { cost: 99, reachable: false, reason: 'Tratado diplomático', viaSea: false, homeland: false, plunder: false, ...blank }
    }
  }

  const owned = ctx.owned
  const adjacent = owned.some((r) => r.neighbors.includes(regionId))
  const ignores = abilitiesOf(f).some((a) => a.ignoresAdjacency?.(ctx, region))
  // gnomes: once per turn they may strike any region, adjacency or not
  const airstrike = !state.turn.airstrikeUsed && abilitiesOf(f).some((a) => a.airstrike)
  const seaEntry = region.coastal
  let reachable = adjacent || ignores || seaEntry || airstrike
  // the very first conquest of a race must start from the sea or a flying power
  if (owned.length === 0) reachable = seaEntry || ignores || airstrike

  const viaSea = !adjacent && !ignores && seaEntry
  const usesAirstrike = !adjacent && !ignores && !seaEntry && airstrike
  // the Champion may take any adjacent region for a single token, once per turn
  const champion = !state.turn.championUsed && abilitiesOf(f).some((a) => a.champion) &&
    adjacent && f.hand >= 1

  let cost = 2 + defenseOf(state, regionId)
  for (const a of abilitiesOf(f)) cost += a.conquestCost?.(ctx, region) ?? 0
  // liberating your own homeland is easier: the locals join you
  const homeland = region.faction && region.faction === sideOf(f)
  if (homeland) cost -= 1
  if (viaSea) {
    const freeSea = f.powerId === 'sailing'
    if (!freeSea) cost += 1
  }
  // worgen in wolf form pay 1 token less on every conquest this turn
  if (state.turn.worgenForm === 'werewolf') cost -= 1
  // ethereals: once per turn, legendary regions cost 2 less
  const ethereal = f.raceId === 'ethereals' && !state.turn.etherealUsed && !!legendaryAt(state, regionId)
  if (ethereal) cost -= 2
  cost = Math.max(1, cost)
  // tauren must garrison every region they take with at least 2 tokens
  if (f.raceId === 'tauren') cost = Math.max(cost, 2)

  return {
    cost,
    reachable,
    reason: reachable ? undefined : owned.length === 0 ? 'Empieza por una región costera' : 'No es adyacente',
    viaSea,
    homeland: !!homeland,
    plunder: isEnemyRegion(sideOf(f), region),
    airstrike: usesAirstrike,
    ethereal,
    champion,
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
  const requestedId = boardId ?? defaultBoardFor(configs.length)
  let board = BOARDS.find((b) => b.id === requestedId)
  let landmasses: string[]
  // si es una isla suelta (small_a etc) usamos esa isla
  const singleIsland = ISLANDS.find((i) => i.id === requestedId)
  if (singleIsland) {
    board = { id: singleIsland.id, name: singleIsland.name, landmasses: singleIsland.landmasses, desc: singleIsland.desc, size: singleIsland.size }
    landmasses = singleIsland.landmasses
  } else if (requestedId === '6p') {
    landmasses = ['small_a', 'small_b', 'medium_a', 'medium_b', 'large_a', 'large_b']
    board = BOARDS.find((b) => b.id === '6p')!
  } else {
    // oficial: selección aleatoria según jugadores, usando rng temporal para no consumir el del estado
    let tmpRng = seed >>> 0
    const tmpNext = () => {
      tmpRng = (tmpRng + 0x6d2b79f5) >>> 0
      let t = tmpRng
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    landmasses = selectOfficialIslands(configs.length, tmpNext)
    board = BOARDS.find((b) => b.id === requestedId) ?? { id: requestedId, name: `Oficial ${configs.length}j`, landmasses, desc: `${landmasses.length} islas` }
  }
  const state: GameState = {
    rng: seed >>> 0,
    boardId: board.id,
    landmasses,
    players: configs.map((c, i) => ({
      id: i, name: c.name, isBot: c.isBot, coins: 5, activeUid: null, declineUid: null, peaceWith: null, harmony: 0,
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
    legendary: [],
  }

  for (const r of REGIONS) {
    const st: RegionState = { owner: null, tokens: 0, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false, tower: false }
    if (!landmasses.includes(r.landmass)) { state.regions[r.id] = st; continue }
    if (r.lostTribe) {
      st.owner = LOST_TRIBE
      st.tokens = 1
    }
    state.regions[r.id] = st
  }

  // ---- legendary places & artifacts: one per player, face-down on the board
  {
    const boardRegs = REGIONS.filter((r) => landmasses.includes(r.landmass))
    const shuffledDefs = shuffle(state, LEGENDARY_DEFS)
    const count = Math.min(configs.length, shuffledDefs.length, boardRegs.length)
    const chosenDefs = shuffledDefs.slice(0, count)
    const shuffledRegs = shuffle(state, boardRegs)
    let regIdx = 0
    const tiles: LegendaryTile[] = []
    for (const def of chosenDefs) {
      // find a suitable region, respecting mustBeCoastal
      let attempts = 0
      let region: RegionData | undefined
      while (attempts < 50) {
        const cand = shuffledRegs[regIdx % shuffledRegs.length]
        regIdx++
        attempts++
        if (!cand) break
        if (tiles.some((t) => t.regionId === cand.id)) continue
        if (def.mustBeCoastal && !cand.coastal) continue
        region = cand
        break
      }
      // fallback: if coastal required but none found, force to a coastal region
      if (!region) {
        const coastal = boardRegs.filter((r) => r.coastal)
        const pool = coastal.length ? coastal : boardRegs
        region = pool.find((r) => !tiles.some((t) => t.regionId === r.id)) ?? pool[0]
      }
      if (region) {
        tiles.push({ defId: def.id, regionId: region.id, revealed: false, isArtifact: def.isArtifact })
      }
    }
    // well_of_eternity special: if somehow inland, move to coastal
    for (const t of tiles) {
      const def = LEGENDARY_BY_ID[t.defId]
      if (def?.mustBeCoastal) {
        const r = REGION_BY_ID[t.regionId]
        if (r && !r.coastal) {
          const coastal = boardRegs.filter((c) => c.coastal && !tiles.some((ot) => ot.regionId === c.id))
          if (coastal.length) t.regionId = pick(state, coastal).id
        }
      }
    }
    state.legendary = tiles
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
    assaultFailed: false, attacked: [],
    worgenForm: null, draeneiSaved: false, etherealUsed: false, airstrikeUsed: false,
    souls: 0, pandarenStruck: [], moPlaced: 0,
    championUsed: false, intimidated: 0, defenders: {},
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
    wispWalls: combo.raceId === 'nightelves' ? 9 : 0,
    bombs: combo.raceId === 'goblins' ? 12 : 0,
    beasts: 0,
  }
  state.factions[uid] = faction
  player.activeUid = uid

  state.tray.splice(index, 1)
  refillTray(state)
  state.phase = 'conquer'
  log(state, player.id, `elige ${factionLabel(faction)} (${faction.hand} fichas)`)
  return state
}

/** minimum tokens a race must keep in each region it occupies (tauren: 2) */
export function minPerRegion(state: GameState, uid: string): number {
  const f = state.factions[uid]
  return f?.raceId === 'tauren' ? 2 : 1
}

/** picks up all but one token per occupied region into the hand */
export function gatherTokens(state: GameState) {
  const player = state.players[state.current]
  if (!player.activeUid) return
  const f = state.factions[player.activeUid]
  const min = minPerRegion(state, f.uid)
  for (const r of regionsOf(state, f.uid)) {
    const st = state.regions[r.id]
    if (st.tokens > min) {
      f.hand += st.tokens - min
      st.tokens = min
    }
    // wisp walls defend empty ground: drop the wall if the race abandoned the region
    if (st.tokens === 0) st.wisp = 0
  }
}

export function beginTurn(state: GameState) {
  state.turn = emptyTurn()
  const player = state.players[state.current]
  player.peaceWith = null
  resolveBombs(state)
  if (!player.activeUid) {
    state.phase = 'pick'
  } else {
    state.phase = 'conquer'
    gatherTokens(state)
    const f = state.factions[player.activeUid]
    // Beast Master: 1 beast token per hill region held (max 5); they fight as race tokens
    if (f.powerId === 'beastmaster' && !f.inDecline) {
      const hills = regionsOf(state, f.uid).filter((r) => r.terrain === 'hills').length
      const beasts = Math.min(5, hills)
      f.beasts = beasts
      f.hand += beasts
      if (beasts > 0) log(state, player.id, `🐾 ${beasts} bestia${beasts > 1 ? 's' : ''} se une${beasts > 1 ? 'n' : ''} a la manada (+${beasts} fichas)`)
    } else {
      f.beasts = 0
    }
  }
}

/**
 * goblin bombs placed last turn blow up (50%) at the start of the goblin
 * player's turn if the region is still occupied by a race
 */
function resolveBombs(state: GameState) {
  const bombed = Object.entries(state.regions).filter(([, st]) => st.bomb)
  if (!bombed.length) return
  const player = state.players[state.current]
  const isGoblinOwner = [player.activeUid, player.declineUid]
    .some((uid) => uid && state.factions[uid]?.raceId === 'goblins')
  if (!isGoblinOwner) return // not the goblin player's turn: bombs keep ticking
  for (const [rid, st] of bombed) {
    st.bomb = false
    const ownerFaction = st.owner && st.owner !== LOST_TRIBE ? state.factions[st.owner] : null
    if (!ownerFaction) continue // empty or murloc-held: the bomb is retrieved
    if (nextRandom(state) < 0.5) {
      if (!ownerFaction.inDecline) {
        ownerFaction.hand += Math.max(0, st.tokens - 1)
      }
      const label = factionLabel(ownerFaction)
      state.regions[rid] = { ...st, owner: null, tokens: 0, wisp: 0, hero: false, fortress: 0, tower: false }
      log(state, player.id, `💥 La bomba EXPLOTA en ${REGION_BY_ID[rid].name}: ${label} pierde todas sus fichas de la región`)
    } else {
      log(state, player.id, `💣 Bomba fallida en ${REGION_BY_ID[rid].name}: no pasa nada`)
    }
  }
}

export interface ConquerResult {
  ok: boolean
  message: string
  rolled?: number
}

export function conquer(state: GameState, regionId: string, useDie = false, useChampion = false): ConquerResult {
  if (state.phase !== 'conquer') return { ok: false, message: 'No es la fase de conquista' }
  if (state.turn.assaultFailed) {
    return { ok: false, message: 'Tu asalto fracasó: la fase de conquista ha terminado' }
  }
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return { ok: false, message: 'Sin raza activa' }
  const f = state.factions[uid]
  const info = conquestCost(state, regionId)
  if (!info.reachable) return { ok: false, message: info.reason ?? 'Inalcanzable' }
  if (useChampion && !info.champion) return { ok: false, message: 'El Campeón no puede cargar ahí (o ya lo has usado este turno)' }

  // the Champion fights alone: one token covers any number of defenders
  const effCost = useChampion ? 1 : info.cost

  let rolled: number | undefined
  if (f.hand < effCost && !useChampion) {
    const maxDice = 1 + (abilitiesOf(f).find((a) => a.extraDice)?.extraDice ?? 0)
    if (!useDie) return { ok: false, message: `Necesitas ${effCost} fichas y tienes ${f.hand}` }
    if (state.turn.diceUsed >= maxDice) return { ok: false, message: 'Ya has usado el dado de refuerzo' }
    if (f.hand < 1) return { ok: false, message: 'Necesitas al menos 1 ficha para lanzar el dado' }
    rolled = pick(state, DIE_FACES)
    state.turn.diceUsed += 1
    state.turn.diceLast = rolled
    if (f.hand + rolled < effCost) {
      const used = f.hand
      // a failed assault really does end the conquest phase — that is what makes
      // the reinforcement die a gamble rather than a free extra roll
      state.turn.assaultFailed = true
      log(state, player.id, `¡El dado saca ${rolled}! Asalto a ${REGION_BY_ID[regionId].name} fallido (${used}+${rolled} < ${effCost}). Fin de sus conquistas.`)
      return { ok: false, message: `Dado ${rolled}: insuficiente (${used}+${rolled} de ${effCost})`, rolled }
    }
  }

  const st = state.regions[regionId]
  // the Enraged power feeds on the defenders that stood their ground
  if (st.tokens >= 2) state.turn.defenders[regionId] = st.tokens
  const spend = useChampion ? 0 : Math.min(f.hand, effCost)
  f.hand -= spend

  // a captured champion is ransomed back: the loser pays 1 coin and takes him home
  const capturedFrom = st.hero && st.owner && st.owner !== LOST_TRIBE
    ? state.factions[st.owner]
    : null
  if (capturedFrom) {
    const loser = state.players[capturedFrom.playerId]
    const ransom = Math.min(1, loser.coins)
    loser.coins -= ransom
    player.coins += ransom
    log(state, loser.id, `🗡 Rescata a su Campeón pagando ${ransom} moneda a ${player.name}`)
  }

  // Marshdweller: attacking their swamps bleeds 1 coin for the defender
  if (st.owner && st.owner !== LOST_TRIBE) {
    const defF = state.factions[st.owner]
    if (POWER_BY_ID[defF.powerId]?.marshdweller && REGION_BY_ID[regionId].terrain === 'swamp') {
      const tax = Math.min(1, player.coins)
      player.coins -= tax
      state.players[defF.playerId].coins += tax
      log(state, defF.playerId, `🌿 ${player.name} paga ${tax} moneda por pisar el Marjal de ${factionLabel(defF)}`)
    }
  }

  // defender loses one token, gets the rest back
  if (st.owner && st.owner !== LOST_TRIBE) {
    const enemy = state.factions[st.owner]
    let back = Math.max(0, st.tokens - 1)
    // draenei: the first token they would lose each turn is redeployed instead
    if (enemy.raceId === 'draenei' && !enemy.inDecline && !state.turn.draeneiSaved) {
      state.turn.draeneiSaved = true
      back += 1
      log(state, enemy.playerId, `✨ Los Draenei reorganizan la primera ficha perdida del turno`)
    }
    if (!enemy.inDecline) {
      state.turn.pendingReturns[enemy.uid] = (state.turn.pendingReturns[enemy.uid] ?? 0) + back
    }
    state.turn.conqueredOccupied.push(regionId)
    if (!state.turn.attacked.includes(enemy.playerId)) state.turn.attacked.push(enemy.playerId)
    // pandaren harmony: conquering an active pandaren region costs 2 coins to anyone holding harmony
    if (enemy.raceId === 'pandaren' && !enemy.inDecline && player.harmony > 0) {
      const pay = Math.min(2, player.coins)
      if (pay > 0) {
        player.harmony -= 1
        player.coins -= pay
        state.players[enemy.playerId].coins += pay
        log(state, player.id, `🕊 Paga ${pay} moneda${pay > 1 ? 's' : ''} de Armonía a los Pandaren por conquistar su región`)
      }
    }
    if (enemy.raceId === 'pandaren' && !enemy.inDecline && !state.turn.pandarenStruck.includes(player.id)) {
      state.turn.pandarenStruck.push(player.id)
    }
    // forsaken salvage: every enemy token discarded feeds their dark magic
    if (f.raceId === 'forsaken') state.turn.souls += 1
    log(state, player.id, `expulsa a ${factionLabel(enemy)} de ${REGION_BY_ID[regionId].name}`)
  } else if (st.owner === LOST_TRIBE) {
    if (f.raceId === 'forsaken') state.turn.souls += 1
    log(state, player.id, `somete a los Múrlocs de ${REGION_BY_ID[regionId].name}`)
  } else {
    log(state, player.id, `conquista ${REGION_BY_ID[regionId].name}${info.viaSea ? ' (desembarco)' : ''}${info.airstrike ? ' (asalto aéreo)' : ''}${useChampion ? ' (carga el Campeón)' : ''}`)
  }

  st.owner = uid
  st.tokens = spend
  st.fortress = 0
  st.hero = useChampion
  st.wisp = 0
  state.turn.conquered.push(regionId)
  state.turn.firstConquestDone = true
  if (info.airstrike) state.turn.airstrikeUsed = true
  if (info.ethereal) state.turn.etherealUsed = true
  if (useChampion) state.turn.championUsed = true

  // night elves: every forest they take gets a wisp wall while they have tokens for it
  if (f.raceId === 'nightelves' && REGION_BY_ID[regionId].terrain === 'forest' && f.wispWalls > 0 && st.wisp === 0) {
    st.wisp = 1
    f.wispWalls -= 1
    log(state, player.id, `✨ Coloca un Muro Wisp en ${REGION_BY_ID[regionId].name} (+1 defensa)`)
  }

  // human military objectives: whoever takes the marked region cashes the bounty
  if (st.mo) {
    st.mo = false
    const humans = state.players.find((p) => p.activeUid && state.factions[p.activeUid]?.raceId === 'humans' && !state.factions[p.activeUid].inDecline)
    player.coins += 2
    if (humans && humans.id !== player.id) humans.coins += 2
    log(state, player.id, `🎯 Objetivo militar conquistado: +2 monedas${humans && humans.id !== player.id ? ` (y +2 para los Humanos)` : ''}`)
  }

  // reveal legendary tile if present face-down
  const leg = state.legendary.find((t) => t.regionId === regionId && !t.revealed)
  if (leg) {
    leg.revealed = true
    const def = LEGENDARY_BY_ID[leg.defId]
    if (def) {
      log(state, player.id, `¡Revela ${def.isArtifact ? 'Artefacto' : 'Lugar legendario'} ${def.name} en ${REGION_BY_ID[regionId].name}! ${def.effectDesc}`)
    }
  }

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
      state.regions[r.id] = { owner: null, tokens: 0, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false, tower: false }
    }
    delete state.factions[old.uid]
    log(state, player.id, `${factionLabel(old)} desaparece del mundo`)
  }

  const keepsAll = abilitiesOf({ ...f, inDecline: false }).some((a) => a.keepsTokensInDecline)
  const min = minPerRegion(state, f.uid) // tauren leave 2 per region in decline
  for (const r of regionsOf(state, f.uid)) {
    const st = state.regions[r.id]
    if (!keepsAll) st.tokens = min
    st.hero = false
    st.tower = false // the watchtower falls when the race abandons the field
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
  const min = minPerRegion(state, f.uid)
  if (delta > 0 && f.hand > 0) {
    f.hand -= 1
    st.tokens += 1
  } else if (delta < 0 && st.tokens > min) {
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
  if (st.fortress > 0) return state
  st.fortress += 1
  f.markers -= 1
  log(state, player.id, `🏗 levanta una Fortaleza en ${REGION_BY_ID[regionId].name} (+1 defensa)`)
  return state
}

/* ------------------------------------------- official race actions (block 1) */

/** worgen choose their form at the start of the turn; null = human by default */
export function setWorgenForm(state: GameState, form: 'human' | 'werewolf'): GameState {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid || state.factions[uid].raceId !== 'worgen') return state
  if (state.turn.worgenForm) return state
  state.turn.worgenForm = form
  log(state, player.id, form === 'werewolf'
    ? '\u{1F43A} adopta la forma de Huargo: conquistar cuesta 1 ficha menos este turno (\u22121 moneda al puntuar)'
    : '\u{1F9D1} adopta forma humana: +2 monedas al puntuar')
  return state
}

/** forsaken: pay 1 coin per discarded enemy token to get a forsaken token back */
export function salvageSouls(state: GameState, count: number): GameState {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid || state.phase !== 'redeploy') return state
  const f = state.factions[uid]
  if (f.raceId !== 'forsaken') return state
  const n = Math.max(0, Math.min(count, state.turn.souls, player.coins))
  if (n === 0) return state
  state.turn.souls -= n
  player.coins -= n
  f.hand += n
  log(state, player.id, `\u{1F47B} Salva ${n} alma${n > 1 ? 's' : ''} pagando ${n} moneda${n > 1 ? 's' : ''}: +${n} Renegado${n > 1 ? 's' : ''} en mano`)
  return state
}

/**
 * Intimidating: move 1 token of an adjacent enemy region to another region
 * held by that same faction (or discard it if it has nowhere to go).
 */
export function intimidate(state: GameState, regionId: string): boolean {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return false
  const f = state.factions[uid]
  if (!abilitiesOf(f).some((a) => a.intimidating)) return false
  if (state.turn.intimidated >= 3) return false
  const st = state.regions[regionId]
  if (!st.owner || st.owner === LOST_TRIBE || st.owner === uid) return false
  const enemy = state.factions[st.owner]
  if (enemy.inDecline || enemy.playerId === player.id) return false
  if (st.tokens < 1) return false
  const adjacent = regionsOf(state, uid).some((r) => r.neighbors.includes(regionId))
  if (!adjacent) return false
  // pick where the bullied token goes: the enemy's biggest other region
  const others = regionsOf(state, enemy.uid).filter((r) => r.id !== regionId)
  const dest = others.sort((a, b) => state.regions[b.id].tokens - state.regions[a.id].tokens)[0]
  st.tokens -= 1
  state.turn.intimidated += 1
  if (dest) {
    state.regions[dest.id].tokens += 1
    log(state, player.id, `😠 Intimida a ${factionLabel(enemy)}: 1 ficha se retira de ${REGION_BY_ID[regionId].name} hacia ${dest.name} (${state.turn.intimidated}/3)`)
  } else {
    enemy.hand += 1
    log(state, player.id, `😠 Intimida a ${factionLabel(enemy)}: 1 ficha de ${REGION_BY_ID[regionId].name} se bate en retirada a su reserva (${state.turn.intimidated}/3)`)
  }
  return true
}

/**
 * Portal Mage: swap every token (except mountains and legendary markers)
 * between two magic regions. Dormant until the map gains magic terrain.
 */
export function portalSwap(state: GameState, regionA: string, regionB: string): boolean {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return false
  const f = state.factions[uid]
  if (!abilitiesOf(f).some((a) => a.portalmage)) return false
  const a = state.regions[regionA]
  const b = state.regions[regionB]
  if (!a || !b) return false
  if (REGION_BY_ID[regionA].terrain !== 'magic' || REGION_BY_ID[regionB].terrain !== 'magic') return false
  const swap = (x: typeof a, y: typeof b) => {
    const tokens = x.tokens
    x.tokens = y.tokens
    y.tokens = tokens
    const owner = x.owner
    x.owner = y.owner
    y.owner = owner
    const wisp = x.wisp
    x.wisp = y.wisp
    y.wisp = wisp
  }
  swap(a, b)
  log(state, player.id, `🌀 Portal entre ${REGION_BY_ID[regionA].name} y ${REGION_BY_ID[regionB].name}: las guarniciones se intercambian`)
  return true
}

/** goblins: glue a bomb to an adjacent region held by another player's active race */
export function placeBomb(state: GameState, regionId: string): boolean {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid || (state.phase !== 'redeploy' && state.phase !== 'conquer')) return false
  const f = state.factions[uid]
  if (f.raceId !== 'goblins' || f.bombs <= 0 || f.inDecline) return false
  const st = state.regions[regionId]
  if (st.bomb) return false
  if (!st.owner || st.owner === LOST_TRIBE || st.owner === uid) return false
  const target = state.factions[st.owner]
  if (target.inDecline || target.playerId === player.id) return false
  const adjacent = regionsOf(state, uid).some((r) => r.neighbors.includes(regionId))
  if (!adjacent) return false
  st.bomb = true
  f.bombs -= 1
  log(state, player.id, `\u{1F4A3} Pega una bomba en ${REGION_BY_ID[regionId].name} (${factionLabel(target)}): explotar\u00e1 al empezar su pr\u00f3ximo turno si sigue ocupada`)
  return true
}

/** humans: mark a region they don't control as a military objective (2 per turn) */
export function placeObjective(state: GameState, regionId: string): boolean {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid || state.phase !== 'redeploy') return false
  const f = state.factions[uid]
  if (f.raceId !== 'humans' || f.inDecline || state.turn.moPlaced >= 2) return false
  const st = state.regions[regionId]
  if (st.owner === uid || st.mo) return false
  st.mo = true
  state.turn.moPlaced += 1
  log(state, player.id, `\u{1F3AF} Marca ${REGION_BY_ID[regionId].name} como objetivo militar (${state.turn.moPlaced}/2)`)
  return true
}

/** how contested a region is: foreign neighbours + coastal exposure */
function trafficOf(state: GameState, regionId: string): number {
  const r = REGION_BY_ID[regionId]
  let t = r.neighbors.filter((n) => {
    const o = state.regions[n].owner
    return o && o !== LOST_TRIBE
  }).length
  if (r.coastal) t += 1
  return t
}

/** bots & fallbacks: place pending race markers without user input */
function autoRaceMarkers(state: GameState) {
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return
  const f = state.factions[uid]
  if (f.inDecline) return

  // humans: unplaced objectives go on the busiest foreign ground
  if (f.raceId === 'humans') {
    const candidates = boardRegions(state)
      .filter((r) => state.regions[r.id].owner !== uid && !state.regions[r.id].mo)
      .sort((a, b) => trafficOf(state, b.id) - trafficOf(state, a.id))
    while (state.turn.moPlaced < 2 && candidates.length) {
      const r = candidates.shift()!
      placeObjective(state, r.id)
    }
  }

  // goblins: bots bomb the adjacent enemy region with the most tokens
  if (f.raceId === 'goblins' && player.isBot && f.bombs > 0) {
    const placed = Object.values(state.regions).some((st) => st.bomb)
    if (!placed) {
      const target = boardRegions(state)
        .filter((r) => {
          const st = state.regions[r.id]
          if (!st.owner || st.owner === LOST_TRIBE || st.owner === uid) return false
          const enemy = state.factions[st.owner]
          return !enemy.inDecline && enemy.playerId !== player.id &&
            state.regions[r.id].tokens > 0 &&
            regionsOf(state, uid).some((mine) => mine.neighbors.includes(r.id))
        })
        .sort((a, b) => state.regions[b.id].tokens - state.regions[a.id].tokens)[0]
      if (target) placeBomb(state, target.id)
    }
  }

  // forsaken bots salvage every soul they can afford above a 2-coin buffer
  if (f.raceId === 'forsaken' && player.isBot) {
    salvageSouls(state, Math.max(0, player.coins - 2))
  }

  // garrisoned: every region they hold gets a fortress while the pool lasts
  if (f.powerId === 'garrisoned') {
    for (const r of regionsOf(state, uid)) {
      const st = state.regions[r.id]
      if (st.fortress === 0 && f.markers > 0) {
        st.fortress += 1
        f.markers -= 1
      }
    }
  }

  // defensive: one watchtower per turn on a field region they surround
  if (f.powerId === 'defensive') {
    const spot = regionsOf(state, uid).find((r) => {
      if (r.terrain !== 'fields' || state.regions[r.id].tower) return false
      const nbs = r.neighbors
      if (!nbs.length) return false
      const mine = nbs.filter((n) => state.regions[n].owner === uid).length
      return mine * 2 > nbs.length
    })
    if (spot) {
      state.regions[spot.id].tower = true
      log(state, player.id, `🗼 Erige una Torre de Vigía en ${spot.name}: imposible de conquistar`)
    }
  }

  // intimidating bots bully the strongest adjacent enemy region
  if (f.powerId === 'intimidating' && player.isBot) {
    const targets = boardRegions(state)
      .filter((r) => {
        const st = state.regions[r.id]
        if (!st.owner || st.owner === LOST_TRIBE || st.owner === uid) return false
        const enemy = state.factions[st.owner]
        return !enemy.inDecline && enemy.playerId !== player.id && st.tokens >= 1 &&
          regionsOf(state, uid).some((mine) => mine.neighbors.includes(r.id))
      })
      .sort((a, b) => state.regions[b.id].tokens - state.regions[a.id].tokens)
    while (state.turn.intimidated < 3 && targets.length) {
      const t = targets.shift()!
      if (state.regions[t.id].tokens >= 1) intimidate(state, t.id)
    }
  }
}

/** opponents the Diplomat may sign peace with this turn */
export function diplomacyOptions(state: GameState): number[] {
  const player = state.players[state.current]
  if (!player.activeUid) return []
  if (state.factions[player.activeUid].powerId !== 'diplomat') return []
  return state.players
    .filter((p) => p.id !== player.id && !state.turn.attacked.includes(p.id))
    .map((p) => p.id)
}

export function needsDiplomacy(state: GameState): boolean {
  const player = state.players[state.current]
  return player.peaceWith === null && diplomacyOptions(state).length > 0
}

export function setPeace(state: GameState, targetId: number): GameState {
  if (!diplomacyOptions(state).includes(targetId)) return state
  const player = state.players[state.current]
  player.peaceWith = targetId
  log(state, player.id, `firma la paz con ${state.players[targetId].name}: no podrá atacarle hasta su próximo turno`)
  return state
}

export function scoreFor(state: GameState, playerId: number): { total: number; detail: string[] } {
  const player = state.players[playerId]
  const detail: string[] = []
  let total = 0
  // track if player has battlefield (double faction)
  let hasDoubleFaction = false
  let plunderExtra = 0

  // collect owned region ids for legendary checks
  const ownedRegionIds = new Set<string>()
  for (const uid of [player.activeUid, player.declineUid]) {
    if (!uid) continue
    for (const r of regionsOf(state, uid)) ownedRegionIds.add(r.id)
  }

  // pre-scan legendary tiles owned and revealed
  const ownedLegendary = state.legendary.filter((t) => t.revealed && ownedRegionIds.has(t.regionId))
  for (const tile of ownedLegendary) {
    const def = LEGENDARY_BY_ID[tile.defId]
    if (def?.effect.kind === 'double_faction') hasDoubleFaction = true
  }

  for (const uid of [player.activeUid, player.declineUid]) {
    if (!uid) continue
    const f = state.factions[uid]
    const ctx = ctxOf(state, f)
    const base = ctx.owned.length
    total += base
    if (base) detail.push(`${factionLabel(f)}${f.inDecline ? ' (declive)' : ''}: ${base}`)

    // faction plunder
    let plunder = plunderThisTurn(state, f).length
    if (plunder && hasDoubleFaction) {
      // Campo de Batalla doubles it
      plunderExtra += plunder // extra equal to base
      detail.push(`  Botín de facción x2 (Campo de Batalla): +${plunder} extra`)
    }
    if (plunder) {
      total += plunder
      detail.push(`  Botín de facción: +${plunder}`)
    }

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

  if (plunderExtra) total += plunderExtra

  // Enraged: coins per defender token that stood in the regions taken this turn
  const activeF = player.activeUid ? state.factions[player.activeUid] : null
  if (activeF && !activeF.inDecline && POWER_BY_ID[activeF.powerId]?.enraged) {
    let rage = 0
    for (const rid of state.turn.conquered) {
      const defenders = state.turn.defenders[rid] ?? 0
      if (defenders >= 2) rage += defenders
    }
    if (rage) {
      total += rage
      detail.push(`  Enfurecida: +${rage}`)
    }
  }

  // worgen: the form chosen this turn shifts the score
  if (player.activeUid && state.factions[player.activeUid].raceId === 'worgen' && !state.factions[player.activeUid].inDecline) {
    if (state.turn.worgenForm === 'werewolf') {
      total -= 1
      detail.push('  \u{1F43A} Forma Huargo: \u22121')
    } else {
      total += 2
      detail.push('  \u{1F9D1} Forma humana: +2')
    }
  }

  // legendary bonuses (excluding double_faction which already handled)
  for (const tile of ownedLegendary) {
    const def = LEGENDARY_BY_ID[tile.defId]
    if (!def) continue
    if (def.effect.kind === 'double_faction') continue
    let bonus = 0
    // per_plunder needs special handling: only for current player and only for active turn
    if (def.effect.kind === 'per_plunder') {
      if (state.current === playerId) {
        // count enemy-faction regions conquered this turn that are still owned? Use plunderThisTurn for active faction
        const activeUid = player.activeUid
        if (activeUid) {
          const activeF = state.factions[activeUid]
          if (activeF) {
            bonus = plunderThisTurn(state, activeF).length
          }
        }
      }
    } else {
      bonus = computeLegendaryBonus(state, playerId, tile.regionId, def, REGION_BY_ID)
    }
    if (bonus) {
      total += bonus
      const icon = def.isArtifact ? '🔮' : '★'
      detail.push(`  ${icon} ${def.name}: +${bonus}`)
    } else if (def.effect.kind === 'flat' && def.effect.value === 0) {
      // no bonus, but still show?
    } else if (bonus === 0 && def.effect.kind !== 'flat') {
      // show 0 bonus for clarity? Only for flat we always show
      // For per_* that yields 0, we skip to avoid noise, but for tutorial we want visibility
      // We'll show if tile is battlefield (already handled) or if bonus is 0 but tile is relevant, skip
    } else if (def.effect.kind === 'flat') {
      // flat 0? shouldn't happen
      total += bonus
      detail.push(`  ${def.isArtifact ? '🔮' : '★'} ${def.name}: +${bonus}`)
    }
  }

  // also show legendary tiles that give 0 but are owned, for transparency (optional)
  // For flat bonuses that are 0? No.

  return { total: Math.max(0, total), detail }
}

export function legendaryAt(state: GameState, regionId: string) {
  return state.legendary.find((t) => t.regionId === regionId) ?? null
}

export function legendaryDefOf(tile: { defId: string } | null) {
  if (!tile) return null
  return LEGENDARY_BY_ID[tile.defId] ?? null
}

export function endTurn(state: GameState): GameState {
  const player = state.players[state.current]

  // worgen that never picked a form stay human (+2 coins)
  const activeUid = player.activeUid
  if (activeUid && state.factions[activeUid].raceId === 'worgen' && !state.turn.worgenForm) {
    setWorgenForm(state, 'human')
  }

  // place pending race markers (human objectives, bot bombs, bot soul salvage)
  autoRaceMarkers(state)

  // pandaren hand out harmony to every rival that did not strike them this turn
  if (activeUid && !state.factions[activeUid].inDecline && state.factions[activeUid].raceId === 'pandaren') {
    let given = 0
    for (const p of state.players) {
      if (p.id === player.id) continue
      if (state.turn.pandarenStruck.includes(p.id)) continue
      if (p.harmony > 0) continue // one token per player at a time (4 in the pool)
      p.harmony = 1
      given++
    }
    if (given) log(state, player.id, `🕊 Regala Armonía a ${given} rival${given > 1 ? 'es' : ''}: atacar Pandaren les costará 2 monedas`)
  }

  // never let the turn dead-end on an unmade diplomatic choice
  if (needsDiplomacy(state)) {
    const opts = diplomacyOptions(state)
    const richest = opts.reduce((a, b) => (state.players[a].coins >= state.players[b].coins ? a : b))
    setPeace(state, richest)
  }

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
export function legalTargets(state: GameState): { id: string; cost: number; viaSea: boolean; champion: boolean }[] {
  const out: { id: string; cost: number; viaSea: boolean; champion: boolean }[] = []
  for (const r of boardRegions(state)) {
    const info = conquestCost(state, r.id)
    if (info.reachable) out.push({ id: r.id, cost: info.cost, viaSea: info.viaSea, champion: info.champion })
  }
  return out
}
