import type { Ability, AbilityContext, Side } from './types'
import type { RegionData } from './types'
import { REGIONS } from './mapData.generated'

const REGION_LOOKUP: Record<string, RegionData> = Object.fromEntries(REGIONS.map((r) => [r.id, r]))

/**
 * Which banner each race fights under. Neutral races are mercenaries: they have
 * no homeland discount but they can raid *both* factions for plunder.
 */
export const RACE_SIDE: Record<string, Side> = {
  humans: 'alliance', dwarves: 'alliance', nightelves: 'alliance',
  gnomes: 'alliance', worgen: 'alliance', draenei: 'alliance',
  orcs: 'horde', trolls: 'horde', tauren: 'horde',
  forsaken: 'horde', goblins: 'horde', bloodelves: 'horde',
  murlocs: 'neutral', pandaren: 'neutral', naga: 'neutral', dragonmaw: 'neutral',
}

export const SIDE_LABEL: Record<Side, string> = {
  alliance: 'Alianza', horde: 'Horda', neutral: 'Neutral',
}

/** plunder is paid for conquering the enemy banner; mercenaries loot everyone */
export function isEnemyRegion(side: Side, region: RegionData): boolean {
  if (!region.faction || region.faction === 'neutral') return false
  if (side === 'neutral') return true
  return region.faction !== side
}

const count = (ctx: AbilityContext, fn: (r: RegionData) => boolean) => ctx.owned.filter(fn).length

export const RACES: Ability[] = [
  {
    id: 'orcs', name: 'Orcos', tokens: 5, color: '#7ba05b',
    text: 'Botín doble: 1 moneda extra más por cada región de la Alianza que conquiste este turno.',
    scoreBonus: (ctx) => {
      if (ctx.faction.inDecline) return 0
      return ctx.state.turn.conquered.filter(
        (id) => REGION_LOOKUP[id]?.faction === 'alliance',
      ).length
    },
  },
  {
    id: 'humans', name: 'Humanos', tokens: 5, color: '#c8b9a0',
    text: '+1 moneda por cada región de Llanura que ocupe.',
    scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'fields'),
  },
  {
    id: 'dwarves', name: 'Enanos', tokens: 3, color: '#d0a24c',
    text: '+1 moneda por cada Montaña que ocupe, incluso en declive.',
    activeInDecline: true,
    scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'mountains'),
  },
  {
    id: 'nightelves', name: 'Elfos de la Noche', tokens: 5, color: '#8f7fd6',
    text: 'Conquistar Bosques cuesta 1 ficha menos.',
    conquestCost: (_c, r) => (r.terrain === 'forest' ? -1 : 0),
  },
  {
    id: 'trolls', name: 'Trolls', tokens: 5, color: '#4fa8a0',
    text: '+1 de defensa en cada región que ocupe.',
    activeInDecline: true,
    defenseBonus: () => 1,
  },
  {
    id: 'tauren', name: 'Tauren', tokens: 6, color: '#a9713c',
    text: '+1 de defensa en Llanuras y Colinas.',
    defenseBonus: (_c, r) => (r.terrain === 'fields' || r.terrain === 'hills' ? 1 : 0),
  },
  {
    id: 'goblins', name: 'Goblins', tokens: 6, color: '#7fbf3f',
    text: '+1 moneda por cada región con un Lugar Legendario.',
    scoreBonus: (ctx) => count(ctx, (r) => !!r.landmark),
  },
  {
    id: 'murlocs', name: 'Múrlocs', tokens: 7, color: '#5ec6d8',
    text: 'Entrar por mar es gratis y las regiones costeras cuestan 1 menos.',
    conquestCost: (_c, r) => (r.coastal ? -1 : 0),
  },
  {
    id: 'forsaken', name: 'Renegados', tokens: 5, color: '#9aa7b0',
    text: 'Al entrar en declive conservan TODAS sus fichas sobre el tablero.',
    keepsTokensInDecline: true,
  },
  {
    id: 'worgen', name: 'Huargen', tokens: 5, color: '#7a6a58',
    text: '+1 de defensa en Bosques y los Bosques cuestan 1 menos.',
    defenseBonus: (_c, r) => (r.terrain === 'forest' ? 1 : 0),
    conquestCost: (_c, r) => (r.terrain === 'forest' ? -1 : 0),
  },
  {
    id: 'gnomes', name: 'Gnomos', tokens: 6, color: '#e0b872',
    text: 'Asalto aéreo: pueden atacar cualquier región del mapa (sin adyacencia).',
    ignoresAdjacency: () => true,
  },
  {
    id: 'pandaren', name: 'Pandaren', tokens: 5, color: '#e6ddc8',
    text: '+2 monedas cada turno mientras estén activos.',
    scoreBonus: (ctx) => (ctx.faction.inDecline ? 0 : 2),
  },
  {
    id: 'draenei', name: 'Draenei', tokens: 5, color: '#a8d8e8',
    text: '+1 de defensa y +1 moneda en regiones con Lugar Legendario.',
    defenseBonus: (_c, r) => (r.landmark ? 1 : 0),
    scoreBonus: (ctx) => count(ctx, (r) => !!r.landmark),
  },
  {
    id: 'naga', name: 'Naga', tokens: 6, color: '#4f9d76',
    text: 'Pantanos y costas cuestan 1 ficha menos; +1 defensa en Pantanos.',
    conquestCost: (_c, r) => (r.terrain === 'swamp' || r.coastal ? -1 : 0),
    defenseBonus: (_c, r) => (r.terrain === 'swamp' ? 1 : 0),
  },
  {
    id: 'bloodelves', name: 'Elfos de Sangre', tokens: 6, color: '#d95f6e',
    text: 'Atacar regiones ocupadas por un rival cuesta 1 ficha menos.',
    conquestCost: (ctx, r) => {
      const st = ctx.state.regions[r.id]
      return st.owner && st.owner !== 'lost-tribe' ? -1 : 0
    },
  },
  {
    id: 'dragonmaw', name: 'Dragón Negro', tokens: 4, color: '#8b4a5c',
    text: '+1 moneda por cada Montaña o Yermo; +1 defensa en Montañas.',
    scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'mountains' || r.terrain === 'wasteland'),
    defenseBonus: (_c, r) => (r.terrain === 'mountains' ? 1 : 0),
  },
]

export const POWERS: Ability[] = [
  { id: 'alchemist', name: 'Alquimista', tokens: 4, text: '+2 monedas al final de cada turno mientras esté activa.', scoreBonus: (ctx) => (ctx.faction.inDecline ? 0 : 2) },
  { id: 'berserk', name: 'Berserker', tokens: 4, text: 'Puede usar el dado de refuerzo 2 veces por turno.', extraDice: 1 },
  { id: 'commando', name: 'Comando', tokens: 4, text: 'Todas las conquistas cuestan 1 ficha menos.', conquestCost: () => -1 },
  { id: 'flying', name: 'Voladora', tokens: 5, text: 'Puede conquistar cualquier región del mapa sin adyacencia.', ignoresAdjacency: () => true },
  { id: 'forest', name: 'del Bosque', tokens: 4, text: '+1 moneda por cada Bosque ocupado.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'forest') },
  { id: 'hill', name: 'de las Colinas', tokens: 4, text: '+1 moneda por cada Colina ocupada.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'hills') },
  { id: 'swamp', name: 'del Pantano', tokens: 4, text: '+1 moneda por cada Pantano ocupado.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'swamp') },
  { id: 'merchant', name: 'Mercader', tokens: 2, text: '+1 moneda por cada región ocupada.', scoreBonus: (ctx) => ctx.owned.length },
  { id: 'mounted', name: 'Montada', tokens: 5, text: 'Llanuras y Colinas cuestan 1 ficha menos.', conquestCost: (_c, r) => (r.terrain === 'fields' || r.terrain === 'hills' ? -1 : 0) },
  { id: 'pillaging', name: 'Saqueadora', tokens: 5, text: '+1 moneda por cada región ocupada por un rival que conquiste este turno.', scoreBonus: (ctx) => (ctx.faction.inDecline ? 0 : ctx.state.turn.conqueredOccupied.length) },
  { id: 'seafaring', name: 'Navegante', tokens: 5, text: 'Entrar por mar es gratis; +1 moneda por región costera.', conquestCost: () => 0, scoreBonus: (ctx) => count(ctx, (r) => r.coastal) },
  { id: 'fortified', name: 'Fortificada', tokens: 3, text: 'Coloca hasta 6 fortalezas (+1 defensa y +1 moneda cada una).', markers: 6 },
  { id: 'heroic', name: 'Heroica', tokens: 5, text: '2 héroes: la región que ocupan es inmune a la conquista.', markers: 2 },
  { id: 'stout', name: 'Resistente', tokens: 4, text: 'Puede entrar en declive justo después de conquistar, en el mismo turno.', declineAfterConquest: true },
  { id: 'underworld', name: 'Subterránea', tokens: 5, text: '+1 moneda por cada Lugar Legendario ocupado.', scoreBonus: (ctx) => count(ctx, (r) => !!r.landmark) },
  { id: 'wealthy', name: 'Rica', tokens: 4, text: '+7 monedas al final del turno en que la eliges.' },
  { id: 'portalmage', name: 'Maga de Portales', tokens: 5, text: 'Puede conquistar sin adyacencia cualquier región con Lugar Legendario.', ignoresAdjacency: (_c, r) => !!r.landmark },
  { id: 'diplomat', name: 'Diplomática', tokens: 5, text: 'Al acabar el turno firma la paz con un rival: no podrá atacarte en su turno.' },
  { id: 'defensive', name: 'Defensiva', tokens: 4, text: '+1 de defensa en todas tus regiones.', defenseBonus: () => 1 },
  { id: 'spirit', name: 'Espiritual', tokens: 5, text: 'En declive sigue puntuando y no puede ser eliminada por una tercera raza.', activeInDecline: true },
]

export const RACE_BY_ID = Object.fromEntries(RACES.map((r) => [r.id, r]))
export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]))
