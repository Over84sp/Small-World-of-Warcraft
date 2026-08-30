import type { Ability, AbilityContext, Side } from './types'
import type { RegionData } from './types'
import { REGIONS } from './mapData.generated'

const REGION_LOOKUP: Record<string, RegionData> = Object.fromEntries(REGIONS.map((r) => [r.id, r]))

/**
 * Which banner each race fights under. Neutral races are mercenaries: they have
 * no homeland discount but they can raid *both* factions for plunder.
 * The Murlocs are NOT playable in the official game: they are the map's natives
 * (the "lost tribe" tokens), so they do not appear in RACES.
 */
export const RACE_SIDE: Record<string, Side> = {
  humans: 'alliance', dwarves: 'alliance', nightelves: 'alliance',
  gnomes: 'alliance', worgen: 'alliance', draenei: 'alliance',
  orcs: 'horde', trolls: 'horde', tauren: 'horde',
  forsaken: 'horde', goblins: 'horde', bloodelves: 'horde',
  ethereals: 'neutral', kobolds: 'neutral', pandaren: 'neutral', naga: 'neutral',
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
  // ---------------------------------------------------------- Alianza (6)
  {
    // Objetivos militares: se colocan/redirigen desde el motor (placeObjective / endTurn)
    id: 'humans', name: 'Humanos', tokens: 5, color: '#c8b9a0',
    text: 'Objetivos militares: al acabar tu turno marcas 2 regiones que no controles. Quien las conquiste gana +2 monedas, y si no eres tú, tú también.',
  },
  {
    id: 'dwarves', name: 'Enanos', tokens: 5, color: '#d0a24c',
    text: 'Conquistar Montañas cuesta 2 fichas menos.',
    conquestCost: (_c, r) => (r.terrain === 'mountains' || r.mountain ? -2 : 0),
  },
  {
    id: 'gnomes', name: 'Gnomos', tokens: 5, color: '#e0b872',
    text: 'Asalto aéreo: 1 vez por turno pueden conquistar cualquier región sin adyacencia, y ese asalto puede tirar el dado una vez más.',
    airstrike: true,
    extraDice: 1,
  },
  {
    // Muros Wisp: los coloca el motor al conquistar bosques (f.wispWalls)
    id: 'nightelves', name: 'Elfos de la Noche', tokens: 4, color: '#8f7fd6',
    text: 'Bosques cuestan 1 ficha menos; al conquistar uno colocan un Muro Wisp (+1 defensa, permanece en el declive, se pierde si la región es conquistada).',
    conquestCost: (_c, r) => (r.terrain === 'forest' ? -1 : 0),
  },
  {
    // Primera ficha perdida por turno se reorganiza en vez de descartarse (engine)
    id: 'draenei', name: 'Draenei', tokens: 7, color: '#a8d8e8',
    text: 'La primera ficha Draenei que perderían en cada turno rival no se descarta: se redespliega.',
  },
  {
    // Forma humana / huargo: elección al empezar el turno (setWorgenForm)
    id: 'worgen', name: 'Huargen', tokens: 5, color: '#7a6a58',
    text: 'Al empezar tu turno eliges forma: Humano (+2 monedas al puntuar) o Huargo (todas tus conquistas cuestan 1 menos, pero puntúas 1 menos).',
  },
  // ------------------------------------------------------------ Horda (6)
  {
    id: 'orcs', name: 'Orcos', tokens: 6, color: '#7ba05b',
    text: 'Botín doble: 1 moneda extra más por cada región de la Alianza que conquiste este turno.',
    scoreBonus: (ctx) => {
      if (ctx.faction.inDecline) return 0
      return ctx.state.turn.conquered.filter(
        (id) => REGION_LOOKUP[id]?.faction === 'alliance',
      ).length
    },
  },
  {
    // Mínimo 2 fichas por región (conquistar, redesplegar y declive) — engine
    id: 'tauren', name: 'Tauren', tokens: 11, color: '#a9713c',
    text: 'Colocan sus fichas de 2 en 2: cada región que ocupan (o dejan en declive) tiene al menos 2 Tauren.',
  },
  {
    id: 'trolls', name: 'Trolls', tokens: 6, color: '#4fa8a0',
    text: 'Conquistar una región ocupada (Múrlocs u otra raza) cuesta 1 ficha menos.',
    conquestCost: (ctx, r) => {
      const st = ctx.state.regions[r.id]
      return st.owner ? -1 : 0
    },
  },
  {
    // Salvamento de almas: pagar 1 moneda por ficha enemiga descartada (salvageSouls)
    id: 'forsaken', name: 'Renegados', tokens: 6, color: '#9aa7b0',
    text: 'Por cada ficha rival descartada con tus conquistas puedes pagar 1 moneda en el redespliegue para recuperar 1 Renegado.',
  },
  {
    id: 'bloodelves', name: 'Elfos de Sangre', tokens: 5, color: '#d95f6e',
    text: '+1 moneda por cada región Mágica que ocupes. (Las regiones mágicas llegarán con la revisión del mapa.)',
    scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'magic'),
  },
  {
    // Bombas: colocar al acabar el turno, explotan al empezar el siguiente (placeBomb / resolveBombs)
    id: 'goblins', name: 'Goblins', tokens: 6, color: '#7fbf3f',
    text: 'Bombas: al acabar tu turno pegas 1 bomba en cada región rival adyacente que quieras. Si al empezar tu siguiente turno sigue ocupada, explota (50%): el dueño pierde 1 ficha y retrae el resto.',
  },
  // ---------------------------------------------------------- Neutrales (4)
  {
    // Descuento 1 vez por turno en regiones con loseta legendario (engine)
    id: 'ethereals', name: 'Etéreos', tokens: 5, color: '#b48ce0',
    text: '1 vez por turno, conquistar una región con Lugar Legendario o Artefacto cuesta 2 fichas menos.',
  },
  {
    id: 'kobolds', name: 'Kobolds', tokens: 6, color: '#c96f3f',
    text: 'Pueden conquistar cualquier Caverna como si fuera adyacente, incluso como primera conquista. (Las cavernas llegarán con la revisión del mapa.)',
    ignoresAdjacency: (_c, r) => r.terrain === 'cave',
  },
  {
    id: 'pandaren', name: 'Pandaren', tokens: 5, color: '#e6ddc8',
    text: 'Armonía: al acabar tu turno regalas 1 ficha de Armonía a cada rival que no te haya atacado. Quien tenga Armonía paga 2 monedas cada vez que conquiste un Pandaren activo.',
  },
  {
    id: 'naga', name: 'Naga', tokens: 6, color: '#4f9d76',
    text: 'Única raza que puede ocupar Mares y Lagos, incluso como primera conquista y en declive. (Los lagos llegarán con la revisión del mapa.)',
    ignoresAdjacency: (_c, r) => r.terrain === 'lake',
    activeInDecline: true,
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
