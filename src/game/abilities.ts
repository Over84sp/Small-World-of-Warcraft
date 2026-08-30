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

/**
 * The 20 official special powers (names translated by hand, token costs are
 * sensible approximations — the official per-badge token values are not
 * documented in the sources we consulted).
 */
export const POWERS: Ability[] = [
  // ---- extra victory coins ----
  {
    id: 'archaeologist', name: 'Arqueóloga', tokens: 5,
    text: '+1 moneda por cada Lugar Legendario o Artefacto que haya en regiones que ocupes.',
    scoreBonus: (ctx) => ctx.state.legendary.filter((t) => ctx.owned.some((r) => r.id === t.regionId)).length,
  },
  { id: 'farmer', name: 'Granjera', tokens: 4, text: '+1 moneda por cada Llanura que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'fields') },
  { id: 'fishing', name: 'Pescadora', tokens: 4, text: '+1 moneda por cada región costera o pegada a un lago que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.coastal || r.neighbors.some((n) => REGION_LOOKUP[n]?.terrain === 'lake')) },
  { id: 'herbalist', name: 'Herborista', tokens: 4, text: '+1 moneda por cada Colina que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'hills') },
  { id: 'mountaineer', name: 'Montañesa', tokens: 4, text: '+1 moneda por cada Montaña que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.mountain) },
  { id: 'ranger', name: 'Guardabosques', tokens: 4, text: '+1 moneda por cada Bosque que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'forest') },
  { id: 'swampwalker', name: 'Caminante de Pantanos', tokens: 4, text: '+1 moneda por cada Pantano que ocupes.', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'swamp') },
  { id: 'mining', name: 'Minera', tokens: 4, text: '+1 moneda por cada Caverna que ocupes. (Requiere el mapa con cavernas.)', scoreBonus: (ctx) => count(ctx, (r) => r.terrain === 'cave') },
  { id: 'explorer', name: 'Exploradora', tokens: 4, text: '+1 moneda por cada isla en la que tengas al menos una región.', scoreBonus: (ctx) => new Set(ctx.owned.map((r) => r.landmass)).size },
  { id: 'battlemaster', name: 'Maestre de Guerra', tokens: 5, text: '+1 moneda por cada región ocupada (Múrlocs u otra raza) que conquistes este turno.', scoreBonus: (ctx) => (ctx.faction.inDecline ? 0 : ctx.state.turn.conqueredOccupied.length) },
  {
    id: 'enraged', name: 'Enfurecida', tokens: 5, enraged: true,
    text: 'Por cada región que conquistes con 2 o más fichas defensoras, ganas tantas monedas como fichas defensoras tuviera.',
  },
  // ---- conquest discounts ----
  { id: 'blacksmith', name: 'Herrero', tokens: 4, text: 'Todas las conquistas cuestan 1 ficha menos.', conquestCost: () => -1 },
  { id: 'sailing', name: 'Navegante', tokens: 5, text: 'El desembarco por mar no cuesta la ficha extra.', conquestCost: () => 0 },
  // ---- defence ----
  {
    id: 'defensive', name: 'Defensiva', tokens: 4, watchtower: true,
    text: 'Al acabar tu turno colocas 1 Torre de Vigía en una Llanura tuya rodeada por tus regiones: no puede ser conquistada.',
  },
  {
    id: 'garrisoned', name: 'Guarnición', tokens: 3, markers: 10,
    text: 'Cada región que ocupes recibe una Fortaleza (+1 defensa y +1 moneda al puntuar). Hasta 10 en total.',
  },
  {
    id: 'marshdweller', name: 'Habitante del Marjal', tokens: 4, activeInDecline: true, marshdweller: true,
    text: 'Quien conquiste uno de tus Pantanos te paga 1 moneda. El poder sigue activo en declive.',
  },
  // ---- special actions ----
  {
    id: 'champion', name: 'Campeón', tokens: 5, champion: true,
    text: 'Tu Campeón: 1 vez por turno conquistas una región adyacente con el Campeón solo (defiende +1; si te lo capturan, lo rescatas pagando 1 moneda).',
  },
  {
    id: 'beastmaster', name: 'Maestra de Bestias', tokens: 4, beasts: true,
    text: 'Al empezar tu turno recibes 1 ficha de bestia por cada Colina que ocupes (máx 5): luchan como fichas de tu raza.',
  },
  {
    id: 'intimidating', name: 'Intimidadora', tokens: 5, intimidating: true,
    text: '3 veces por turno: mueves 1 ficha de una región rival adyacente a otra región de ese mismo rival (si no tiene dónde meterla, la descarta).',
  },
  {
    id: 'portalmage', name: 'Maga de Portales', tokens: 5, portalmage: true,
    text: '2 veces por turno intercambia las fichas entre dos regiones Mágicas. (Requiere el mapa con regiones mágicas.)',
  },
]

export const RACE_BY_ID = Object.fromEntries(RACES.map((r) => [r.id, r]))
export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]))
