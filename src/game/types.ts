export type Terrain = 'fields' | 'forest' | 'hills' | 'mountains' | 'swamp' | 'wasteland'

export interface RegionData {
  id: string
  name: string
  terrain: Terrain
  landmass: string
  faction?: string
  landmark?: string
  lostTribe?: boolean
  mountain: boolean
  coastal: boolean
  polygon: [number, number][]
  center: [number, number]
  neighbors: string[]
}

export const LOST_TRIBE = 'lost-tribe'

export interface RegionState {
  /** faction uid, LOST_TRIBE, or null when empty */
  owner: string | null
  tokens: number
  /** fortresses / watchtowers add permanent defense */
  fortress: number
  hero: boolean
}

export interface FactionState {
  uid: string
  playerId: number
  raceId: string
  powerId: string
  inDecline: boolean
  /** tokens held off-board during the conquest phase */
  hand: number
  /** hero / fortress markers still available */
  markers: number
}

export interface PlayerState {
  id: number
  name: string
  isBot: boolean
  coins: number
  /** uid of the active faction, if any */
  activeUid: string | null
  declineUid: string | null
  /** set by the Diplomat power */
  peaceWith: number | null
}

export interface Combo {
  raceId: string
  powerId: string
  bonusCoins: number
}

export type Phase = 'pick' | 'conquer' | 'redeploy' | 'gameover'

export interface TurnState {
  conquered: string[]
  /** regions taken this turn that belonged to an opponent */
  conqueredOccupied: string[]
  diceUsed: number
  diceLast: number | null
  usedFlight: boolean
  declaredDecline: boolean
  firstConquestDone: boolean
  /** a failed reinforcement roll ends the conquest phase for the turn */
  assaultFailed: boolean
  /** players attacked this turn — the Diplomat may not make peace with them */
  attacked: number[]
  /** tokens owed back to opponents after this turn */
  pendingReturns: Record<string, number>
}

export interface LogEntry {
  round: number
  playerId: number
  text: string
}

export interface GameState {
  rng: number
  boardId: string
  landmasses: string[]
  players: PlayerState[]
  factions: Record<string, FactionState>
  regions: Record<string, RegionState>
  tray: Combo[]
  deck: Combo[]
  current: number
  round: number
  maxRounds: number
  phase: Phase
  turn: TurnState
  log: LogEntry[]
  winner: number | null
}

export interface AbilityContext {
  state: GameState
  faction: FactionState
  /** regions currently held by this faction */
  owned: RegionData[]
}

export interface Ability {
  id: string
  name: string
  tokens: number
  text: string
  /** flavour colour used for the badge */
  color?: string
  /** delta applied to the cost of conquering `region` */
  conquestCost?: (ctx: AbilityContext, region: RegionData) => number
  /** delta applied when this faction defends `region` */
  defenseBonus?: (ctx: AbilityContext, region: RegionData) => number
  /** extra coins at scoring time */
  scoreBonus?: (ctx: AbilityContext) => number
  /** ability keeps working once the race is in decline */
  activeInDecline?: boolean
  /** may attack non-adjacent regions */
  ignoresAdjacency?: (ctx: AbilityContext, region: RegionData) => boolean
  /** keeps every token on the board when going into decline */
  keepsTokensInDecline?: boolean
  /** number of hero / fortress markers granted */
  markers?: number
  /** extra reinforcement-die rolls per turn */
  extraDice?: number
  /** may go into decline immediately after conquering */
  declineAfterConquest?: boolean
}
