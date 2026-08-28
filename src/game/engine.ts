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
  /** region of your own banner: 1 token cheaper */
  homeland: boolean
  /** region of the enemy banner: pays plunder when conquered */
  plunder: boolean
}

export function conquestCost(state: GameState, regionId: string): CostInfo {
  const region = REGION_BY_ID[regionId]
  const st = state.regions[regionId]
  const player = state.players[state.current]
  const uid = player.activeUid
  if (!uid) return { cost: 99, reachable: false, reason: 'Sin raza activa', viaSea: false, homeland: false, plunder: false }
  const f = state.factions[uid]
  const ctx = ctxOf(state, f)

  if (state.turn.assaultFailed) {
    return { cost: 99, reachable: false, reason: 'El asalto fallido ha terminado tus conquistas', viaSea: false, homeland: false, plunder: false }
  }
  if (st.hero) return { cost: 99, reachable: false, reason: 'Protegida por un héroe', viaSea: false, homeland: false, plunder: false }
  if (st.owner === uid) return { cost: 99, reachable: false, reason: 'Ya la ocupas', viaSea: false, homeland: false, plunder: false }
  if (st.owner && st.owner !== LOST_TRIBE) {
    const enemy = state.factions[st.owner]
    if (enemy.playerId === player.id) {
      return { cost: 99, reachable: false, reason: 'Es tu raza en declive', viaSea: false, homeland: false, plunder: false }
    }
    if (state.players[enemy.playerId].peaceWith === player.id) {
      return { cost: 99, reachable: false, reason: 'Tratado diplomático', viaSea: false, homeland: false, plunder: false }
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
  // liberating your own homeland is easier: the locals join you
  const homeland = region.faction && region.faction === sideOf(f)
  if (homeland) cost -= 1
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
    homeland: !!homeland,
    plunder: isEnemyRegion(sideOf(f), region),
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
    legendary: [],
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

  // ---- legendary places & artifacts: one per player, face-down on the board
  {
    const boardRegs = REGIONS.filter((r) => board.landmasses.includes(r.landmass))
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
  if (state.turn.assaultFailed) {
    return { ok: false, message: 'Tu asalto fracasó: la fase de conquista ha terminado' }
  }
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
      // a failed assault really does end the conquest phase — that is what makes
      // the reinforcement die a gamble rather than a free extra roll
      state.turn.assaultFailed = true
      log(state, player.id, `¡El dado saca ${rolled}! Asalto a ${REGION_BY_ID[regionId].name} fallido (${used}+${rolled} < ${info.cost}). Fin de sus conquistas.`)
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
    if (!state.turn.attacked.includes(enemy.playerId)) state.turn.attacked.push(enemy.playerId)
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

  return { total, detail }
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
export function legalTargets(state: GameState): { id: string; cost: number; viaSea: boolean }[] {
  const out: { id: string; cost: number; viaSea: boolean }[] = []
  for (const r of boardRegions(state)) {
    const info = conquestCost(state, r.id)
    if (info.reachable) out.push({ id: r.id, cost: info.cost, viaSea: info.viaSea })
  }
  return out
}
