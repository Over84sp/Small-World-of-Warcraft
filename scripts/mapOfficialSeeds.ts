// Mapa oficial Small World of Warcraft - 6 islas doble cara (solo 1 cara por isla por ahora)
// Basado en fotos alta resolución wiki + regla 6 islas S7 M9 L11
// Cada isla es un landmass con outline y seeds. Terrenos mapeados a nuestros 6 tipos.

export type Terrain = 'fields' | 'forest' | 'hills' | 'mountains' | 'swamp' | 'wasteland'
export type Side = 'alliance' | 'horde' | 'neutral'

export interface SeedDef {
  id: string
  name: string
  terrain: Terrain
  x: number
  y: number
  landmark?: string // S, M, L para loseta legendaria
  lostTribe?: boolean // Murloc
  faction?: Side
  mountain?: boolean // si tiene montaña impresa (además de terrain mountains)
}

export interface LandmassDef {
  id: string
  name: string
  size: 'S' | 'M' | 'L'
  outline: [number, number][]
  seeds: SeedDef[]
}

type Pt = [number, number]
const Q = (n: number) => Math.round(n * 100) / 100

// deterministic PRNG so re-running the generator always yields the same coastline
function mulberry32(seed: number) {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashSeed(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/** monotone-chain convex hull */
function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

/**
 * Builds a natural-looking island coastline (bays + headlands) that safely
 * encloses every seed, instead of a plain rectangle. Deterministic per `id`.
 */
function organicOutline(
  seeds: SeedDef[],
  id: string,
  opts: { pad?: number; jag?: number; seg?: number } = {},
): Pt[] {
  const pad = opts.pad ?? 48
  const jag = opts.jag ?? 0.5
  const seg = opts.seg ?? 3
  const rng = mulberry32(hashSeed(id))

  const hull = convexHull(seeds.map((s) => [s.x, s.y] as Pt))
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length

  // push the hull outward so there's room for jagged coastline beyond every seed
  const expanded = hull.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    return [x + (dx / len) * pad, y + (dy / len) * pad] as Pt
  })

  // subdivide each hull edge and jitter it radially -> bays / headlands
  const out: Pt[] = []
  const n = expanded.length
  for (let i = 0; i < n; i++) {
    const a = expanded[i]
    const b = expanded[(i + 1) % n]
    for (let k = 0; k < seg; k++) {
      const t = k / seg
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      const dx = x - cx
      const dy = y - cy
      const len = Math.hypot(dx, dy) || 1
      const amt = (rng() * 2 - 1) * pad * jag
      out.push([Q(x + (dx / len) * amt), Q(y + (dy / len) * amt)])
    }
  }
  return out
}

// ---------------------------------------------------------------- seeds --
// SMALL A - basado en small_board.jpg (7 regiones)
// Visual: top mountain, top-right fields, left hills, center forest, right mountain, bottom-left fields, bottom swamp
const SMALL_A_SEEDS: SeedDef[] = [
  { id: 'sa1', name: 'Cima del Vigía', terrain: 'mountains', x: 200, y: 80, mountain: true, faction: 'neutral' },
  { id: 'sa2', name: 'Campos de Westfall', terrain: 'fields', x: 300, y: 120, landmark: 'S', faction: 'alliance' },
  { id: 'sa3', name: 'Colinas de Hillsbrad', terrain: 'hills', x: 100, y: 150, lostTribe: true, faction: 'neutral' },
  { id: 'sa4', name: 'Bosque de Elwynn', terrain: 'forest', x: 180, y: 210, faction: 'alliance' },
  { id: 'sa5', name: 'Montañas Crestagrana', terrain: 'mountains', x: 320, y: 260, mountain: true, faction: 'alliance' },
  { id: 'sa6', name: 'Llanos de Mulgore', terrain: 'fields', x: 100, y: 300, faction: 'horde' },
  { id: 'sa7', name: 'Pantano de los Zánganos', terrain: 'swamp', x: 200, y: 350, lostTribe: true, faction: 'neutral' },
]

// SMALL B - basado en crop_bottom.png (7 regiones)
const SMALL_B_SEEDS: SeedDef[] = [
  { id: 'sb1', name: 'Montañas de Alterac', terrain: 'mountains', x: 550, y: 80, mountain: true },
  { id: 'sb2', name: 'Campos de Arathi', terrain: 'fields', x: 700, y: 120, landmark: 'S' },
  { id: 'sb3', name: 'Bosque de Argénteos', terrain: 'forest', x: 500, y: 160, faction: 'alliance' },
  { id: 'sb4', name: 'Claro de Tirisfal', terrain: 'forest', x: 600, y: 200, lostTribe: true },
  { id: 'sb5', name: 'Montañas de Colmillo', terrain: 'mountains', x: 720, y: 260, mountain: true },
  { id: 'sb6', name: 'Praderas de Loch Modan', terrain: 'fields', x: 500, y: 300 },
  { id: 'sb7', name: 'Ciénaga de Dustwallow', terrain: 'swamp', x: 600, y: 340, lostTribe: true },
]

// MEDIUM A - basado en medium_board.jpg (9 regiones)
const MEDIUM_A_SEEDS: SeedDef[] = [
  { id: 'ma1', name: 'Pantano de las Penas', terrain: 'swamp', x: 150, y: 480, mountain: false },
  { id: 'ma2', name: 'Campos de Trabalomas', terrain: 'fields', x: 300, y: 500, landmark: 'M' },
  { id: 'ma3', name: 'Bosque de Terokkar', terrain: 'forest', x: 350, y: 580, faction: 'neutral' },
  { id: 'ma4', name: 'Caverna de Desolace', terrain: 'swamp', x: 300, y: 650, lostTribe: true },
  { id: 'ma5', name: 'Montañas de Cumbre Borrascosa', terrain: 'mountains', x: 350, y: 780, mountain: true },
  { id: 'ma6', name: 'Colinas de Feralas', terrain: 'hills', x: 200, y: 780 },
  { id: 'ma7', name: 'Bosque de Frondavil', terrain: 'forest', x: 120, y: 700, faction: 'alliance' },
  { id: 'ma8', name: 'Praderas de Vallefresno', terrain: 'hills', x: 120, y: 560, lostTribe: true },
  { id: 'ma9', name: 'Campos de Costasur', terrain: 'fields', x: 200, y: 660 },
]

// MEDIUM B - basado en crop_top.png (9 regiones, top island de 4-island image)
const MEDIUM_B_SEEDS: SeedDef[] = [
  { id: 'mb1', name: 'Bosque de Ashenvale', terrain: 'forest', x: 550, y: 480, faction: 'alliance' },
  { id: 'mb2', name: 'Ciénaga de Marjal Revolcafango', terrain: 'swamp', x: 650, y: 480 },
  { id: 'mb3', name: 'Campos de Vega de Tuercespina', terrain: 'fields', x: 800, y: 500, landmark: 'M' },
  { id: 'mb4', name: 'Montañas de Filospada', terrain: 'mountains', x: 850, y: 580, mountain: true },
  { id: 'mb5', name: 'Colinas de Desolace', terrain: 'hills', x: 600, y: 580, lostTribe: true },
  { id: 'mb6', name: 'Bosque de Vega Crepuscular', terrain: 'forest', x: 600, y: 650, lostTribe: true },
  { id: 'mb7', name: 'Campos de los Baldíos Sur', terrain: 'fields', x: 800, y: 680 },
  { id: 'mb8', name: 'Montañas de Sierra Espolón', terrain: 'mountains', x: 550, y: 780, mountain: true },
  { id: 'mb9', name: 'Bosque de Claro de la Luna', terrain: 'forest', x: 650, y: 800, faction: 'neutral' },
]

// LARGE A - basado en large_board.jpg (11 regiones)
const LARGE_A_SEEDS: SeedDef[] = [
  { id: 'la1', name: 'Pantano de Zangarmar', terrain: 'swamp', x: 150, y: 930 },
  { id: 'la2', name: 'Campos de Elwynn', terrain: 'fields', x: 320, y: 960, landmark: 'L' },
  { id: 'la3', name: 'Montañas de Dun Morogh', terrain: 'mountains', x: 400, y: 1050, mountain: true },
  { id: 'la4', name: 'Colinas de Loch Modan', terrain: 'hills', x: 300, y: 1100, faction: 'alliance' },
  { id: 'la5', name: 'Campos de Westfall', terrain: 'fields', x: 400, y: 1180 },
  { id: 'la6', name: 'Montañas de Crestagrana', terrain: 'mountains', x: 350, y: 1300, mountain: true },
  { id: 'la7', name: 'Bosque de Tuercespina', terrain: 'forest', x: 150, y: 1280, lostTribe: true },
  { id: 'la8', name: 'Montañas de Vega de Tuercespina', terrain: 'mountains', x: 120, y: 1180, mountain: true },
  { id: 'la9', name: 'Praderas de Mulgore', terrain: 'hills', x: 120, y: 1050 },
  { id: 'la10', name: 'Bosque de Claros de Tirisfal', terrain: 'forest', x: 100, y: 960, faction: 'horde' },
  { id: 'la11', name: 'Ciénaga de las Mil Agujas', terrain: 'swamp', x: 200, y: 1130, lostTribe: true },
]

// LARGE B - basado en board_page3.png (11 regiones)
const LARGE_B_SEEDS: SeedDef[] = [
  { id: 'lb1', name: 'Bosque de Cuna del Invierno', terrain: 'forest', x: 600, y: 930, faction: 'neutral' },
  { id: 'lb2', name: 'Pantano de Feralas', terrain: 'swamp', x: 700, y: 930 },
  { id: 'lb3', name: 'Campos de Tanaris', terrain: 'fields', x: 850, y: 960, landmark: 'L' },
  { id: 'lb4', name: 'Montañas de Cuna del Invierno', terrain: 'mountains', x: 900, y: 1050, mountain: true },
  { id: 'lb5', name: 'Colinas de Silithus', terrain: 'hills', x: 700, y: 1050, lostTribe: true },
  { id: 'lb6', name: 'Bosque de Frondavil', terrain: 'forest', x: 650, y: 1130, lostTribe: true },
  { id: 'lb7', name: 'Campos de Vega de Tuercespina Sur', terrain: 'fields', x: 850, y: 1180 },
  { id: 'lb8', name: 'Montañas de Silithus', terrain: 'mountains', x: 600, y: 1180, mountain: true },
  { id: 'lb9', name: 'Bosque de Claro de la Luna Sur', terrain: 'forest', x: 650, y: 1260 },
  { id: 'lb10', name: 'Pantano de Dustwallow', terrain: 'swamp', x: 700, y: 1100, lostTribe: true },
  { id: 'lb11', name: 'Montañas de Tanaris', terrain: 'mountains', x: 800, y: 1300, mountain: true },
]

export const LANDMASSES: LandmassDef[] = [
  {
    id: 'small_a',
    name: 'Isla Pequeña A',
    size: 'S',
    outline: organicOutline(SMALL_A_SEEDS, 'small_a', { pad: 44 }),
    seeds: SMALL_A_SEEDS,
  },
  {
    id: 'small_b',
    name: 'Isla Pequeña B',
    size: 'S',
    outline: organicOutline(SMALL_B_SEEDS, 'small_b', { pad: 44 }),
    seeds: SMALL_B_SEEDS,
  },
  {
    id: 'medium_a',
    name: 'Isla Mediana A',
    size: 'M',
    outline: organicOutline(MEDIUM_A_SEEDS, 'medium_a', { pad: 48 }),
    seeds: MEDIUM_A_SEEDS,
  },
  {
    id: 'medium_b',
    name: 'Isla Mediana B',
    size: 'M',
    outline: organicOutline(MEDIUM_B_SEEDS, 'medium_b', { pad: 48 }),
    seeds: MEDIUM_B_SEEDS,
  },
  {
    id: 'large_a',
    name: 'Isla Grande A',
    size: 'L',
    outline: organicOutline(LARGE_A_SEEDS, 'large_a', { pad: 52 }),
    seeds: LARGE_A_SEEDS,
  },
  {
    id: 'large_b',
    name: 'Isla Grande B',
    size: 'L',
    outline: organicOutline(LARGE_B_SEEDS, 'large_b', { pad: 52 }),
    seeds: LARGE_B_SEEDS,
  },
]
