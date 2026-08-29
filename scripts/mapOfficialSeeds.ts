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

// Helper para crear outline rectangular con margen
function rectOutline(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

export const LANDMASSES: LandmassDef[] = [
  // SMALL A - basado en small_board.jpg (7 regiones)
  // Visual: top mountain, top-right fields, left hills, center forest, right mountain, bottom-left fields, bottom swamp
  {
    id: 'small_a',
    name: 'Isla Pequeña A',
    size: 'S',
    outline: rectOutline(50, 50, 300, 350),
    seeds: [
      { id: 'sa1', name: 'Cima del Vigía', terrain: 'mountains', x: 200, y: 80, mountain: true, faction: 'neutral' }, // top mountain
      { id: 'sa2', name: 'Campos de Westfall', terrain: 'fields', x: 300, y: 120, landmark: 'S', faction: 'alliance' }, // top-right fields S
      { id: 'sa3', name: 'Colinas de Hillsbrad', terrain: 'hills', x: 100, y: 150, lostTribe: true, faction: 'neutral' }, // left hills Murloc
      { id: 'sa4', name: 'Bosque de Elwynn', terrain: 'forest', x: 180, y: 210, faction: 'alliance' }, // center forest
      { id: 'sa5', name: 'Montañas Crestagrana', terrain: 'mountains', x: 320, y: 260, mountain: true, faction: 'alliance' }, // right mountain
      { id: 'sa6', name: 'Llanos de Mulgore', terrain: 'fields', x: 100, y: 300, faction: 'horde' }, // bottom-left fields
      { id: 'sa7', name: 'Pantano de los Zánganos', terrain: 'swamp', x: 200, y: 350, lostTribe: true, faction: 'neutral' }, // bottom swamp Murloc
    ],
  },
  // SMALL B - basado en crop_bottom.png (7 regiones)
  {
    id: 'small_b',
    name: 'Isla Pequeña B',
    size: 'S',
    outline: rectOutline(450, 50, 300, 350),
    seeds: [
      { id: 'sb1', name: 'Montañas de Alterac', terrain: 'mountains', x: 550, y: 80, mountain: true },
      { id: 'sb2', name: 'Campos de Arathi', terrain: 'fields', x: 700, y: 120, landmark: 'S' },
      { id: 'sb3', name: 'Bosque de Argénteos', terrain: 'forest', x: 500, y: 160, faction: 'alliance' },
      { id: 'sb4', name: 'Claro de Tirisfal', terrain: 'forest', x: 600, y: 200, lostTribe: true },
      { id: 'sb5', name: 'Montañas de Colmillo', terrain: 'mountains', x: 720, y: 260, mountain: true },
      { id: 'sb6', name: 'Praderas de Loch Modan', terrain: 'fields', x: 500, y: 300 },
      { id: 'sb7', name: 'Ciénaga de Dustwallow', terrain: 'swamp', x: 600, y: 340, lostTribe: true },
    ],
  },
  // MEDIUM A - basado en medium_board.jpg (9 regiones)
  {
    id: 'medium_a',
    name: 'Isla Mediana A',
    size: 'M',
    outline: rectOutline(50, 450, 350, 400),
    seeds: [
      { id: 'ma1', name: 'Pantano de las Penas', terrain: 'swamp', x: 150, y: 480, mountain: false },
      { id: 'ma2', name: 'Campos de Trabalomas', terrain: 'fields', x: 300, y: 500, landmark: 'M' },
      { id: 'ma3', name: 'Bosque de Terokkar', terrain: 'forest', x: 350, y: 580, faction: 'neutral' },
      { id: 'ma4', name: 'Caverna de Desolace', terrain: 'swamp', x: 300, y: 650, lostTribe: true }, // cavern mapped to swamp
      { id: 'ma5', name: 'Montañas de Cumbre Borrascosa', terrain: 'mountains', x: 350, y: 780, mountain: true },
      { id: 'ma6', name: 'Colinas de Feralas', terrain: 'hills', x: 200, y: 780 },
      { id: 'ma7', name: 'Bosque de Frondavil', terrain: 'forest', x: 120, y: 700, faction: 'alliance' },
      { id: 'ma8', name: 'Praderas de Vallefresno', terrain: 'hills', x: 120, y: 560, lostTribe: true },
      { id: 'ma9', name: 'Campos de Costasur', terrain: 'fields', x: 200, y: 660 },
    ],
  },
  // MEDIUM B - basado en crop_top.png (9 regiones, top island de 4-island image)
  {
    id: 'medium_b',
    name: 'Isla Mediana B',
    size: 'M',
    outline: rectOutline(500, 450, 400, 400),
    seeds: [
      { id: 'mb1', name: 'Bosque de Ashenvale', terrain: 'forest', x: 550, y: 480, faction: 'alliance' },
      { id: 'mb2', name: 'Ciénaga de Marjal Revolcafango', terrain: 'swamp', x: 650, y: 480 },
      { id: 'mb3', name: 'Campos de Vega de Tuercespina', terrain: 'fields', x: 800, y: 500, landmark: 'M' },
      { id: 'mb4', name: 'Montañas de Filospada', terrain: 'mountains', x: 850, y: 580, mountain: true },
      { id: 'mb5', name: 'Colinas de Desolace', terrain: 'hills', x: 600, y: 580, lostTribe: true },
      { id: 'mb6', name: 'Bosque de Vega Crepuscular', terrain: 'forest', x: 600, y: 650, lostTribe: true },
      { id: 'mb7', name: 'Campos de los Baldíos Sur', terrain: 'fields', x: 800, y: 680 },
      { id: 'mb8', name: 'Montañas de Sierra Espolón', terrain: 'mountains', x: 550, y: 780, mountain: true },
      { id: 'mb9', name: 'Bosque de Claro de la Luna', terrain: 'forest', x: 650, y: 800, faction: 'neutral' },
    ],
  },
  // LARGE A - basado en large_board.jpg (11 regiones)
  {
    id: 'large_a',
    name: 'Isla Grande A',
    size: 'L',
    outline: rectOutline(50, 900, 400, 500),
    seeds: [
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
    ],
  },
  // LARGE B - basado en board_page3.png (11 regiones)
  {
    id: 'large_b',
    name: 'Isla Grande B',
    size: 'L',
    outline: rectOutline(550, 900, 400, 500),
    seeds: [
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
    ],
  },
]
