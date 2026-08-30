export type Side = 'alliance' | 'horde' | 'neutral'

export type Terrain =
  | 'fields' | 'forest' | 'hills' | 'mountains' | 'swamp' | 'wasteland'
  // terrain types from the official boards, pending map regeneration (block 4)
  | 'lake' | 'cave' | 'magic'

export interface RegionData {
  id: string
  name: string
  terrain: Terrain
  landmass: string
  faction?: Side
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
  /** the Champion power token: counts as 1 race token when defending */
  hero: boolean
  /** night-elf wisp wall: +1 defense, survives decline, discarded on conquest */
  wisp: number
  /** goblin bomb waiting to be resolved at the goblin player's next turn */
  bomb: boolean
  /** human military objective: +2 coins to whoever conquers it */
  mo: boolean
  /** Defensive power watchtower: the region cannot be conquered */
  tower: boolean
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
  /** night-elf wisp walls still available (race token pool) */
  wispWalls: number
  /** goblin bombs still available (race token pool) */
  bombs: number
  /** Beast Master: beast tokens granted this turn (fight as race tokens) */
  beasts: number
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
  /** pandaren harmony tokens held: attacking active Pandaren costs 2 coins */
  harmony: number
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
  /* ---- race-specific per-turn state (official races, block 1) ---- */
  /** worgen form chosen this turn; null = not chosen yet (treated as human) */
  worgenForm: 'human' | 'werewolf' | null
  /** draenei: the first token they would lose each turn is redeployed instead */
  draeneiSaved: boolean
  /** ethereals: their once-per-turn legendary discount */
  etherealUsed: boolean
  /** gnomes: their once-per-turn aerial assault */
  airstrikeUsed: boolean
  /** forsaken: enemy tokens discarded by their conquests this turn */
  souls: number
  /** players who conquered active Pandaren regions this turn (get no harmony) */
  pandarenStruck: number[]
  /** human military objectives placed this turn (max 2) */
  moPlaced: number
  /* ---- power-specific per-turn state (official powers, block 2) ---- */
  /** Champion: their once-per-turn champion conquest */
  championUsed: boolean
  /** Intimidating: enemy tokens moved this turn (max 3) */
  intimidated: number
  /** defender tokens each conquered region had — the Enraged bonus */
  defenders: Record<string, number>
}

export interface LogEntry {
  round: number
  playerId: number
  text: string
}

export interface LegendaryTile {
  /** definition id, e.g. 'karazhan' */
  defId: string
  regionId: string
  revealed: boolean
  isArtifact: boolean
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
  legendary: LegendaryTile[]
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
  /** once per turn, may conquer one non-adjacent region (gnomes' aerial assault) */
  airstrike?: boolean
  /* ---- official power flags (block 2) ---- */
  /** Champion power: once per turn conquer an adjacent region with the champion token */
  champion?: boolean
  /** Defensive power: places a watchtower at end of turn */
  watchtower?: boolean
  /** Intimidating power: may move enemy tokens */
  intimidating?: boolean
  /** Beast Master power: beast tokens each turn */
  beasts?: boolean
  /** Portal Mage power: swap tokens between magic regions (needs magic terrain) */
  portalmage?: boolean
  /** Enraged power: bonus coins per defender token of conquered regions */
  enraged?: boolean
  /** Marshdweller power: attackers of your swamps pay you 1 coin (also in decline) */
  marshdweller?: boolean
}
