// Hand-authored geography of Azeroth for the board.
// Coordinates live in a 0..1000 x 0..1000 design space.

export type Terrain = 'fields' | 'forest' | 'hills' | 'mountains' | 'swamp' | 'wasteland'

export interface SeedDef {
  id: string
  name: string
  terrain: Terrain
  x: number
  y: number
  /** Legendary place / artifact flavour marker */
  landmark?: string
  /** starts guarded by a Lost Tribe token */
  lostTribe?: boolean
  faction?: 'alliance' | 'horde' | 'neutral'
}

export interface LandmassDef {
  id: string
  name: string
  outline: [number, number][]
  seeds: SeedDef[]
}

export const LANDMASSES: LandmassDef[] = [
  {
    id: 'teldrassil',
    name: 'Teldrassil',
    outline: [
      [96, 96], [130, 86], [160, 100], [166, 130], [148, 156], [114, 158], [92, 132],
    ],
    seeds: [
      { id: 'teldrassil', name: 'Teldrassil', terrain: 'forest', x: 129, y: 122, faction: 'alliance', landmark: 'Darnassus' },
    ],
  },
  {
    id: 'kalimdor',
    name: 'Kalimdor',
    outline: [
      [196, 96], [244, 84], [286, 104], [312, 142], [330, 186], [318, 226], [336, 262],
      [352, 306], [346, 352], [328, 396], [346, 436], [352, 486], [330, 534], [306, 566],
      [312, 612], [292, 664], [256, 706], [214, 726], [178, 706], [162, 664], [176, 620],
      [148, 596], [126, 556], [140, 512], [166, 480], [146, 442], [136, 396], [158, 356],
      [140, 312], [130, 266], [150, 218], [146, 168], [166, 122],
    ],
    seeds: [
      { id: 'darkshore', name: 'Darkshore', terrain: 'forest', x: 178, y: 150, faction: 'alliance' },
      { id: 'moonglade', name: 'Moonglade', terrain: 'forest', x: 252, y: 122, faction: 'neutral', landmark: 'Nighthaven' },
      { id: 'winterspring', name: 'Winterspring', terrain: 'mountains', x: 300, y: 168, lostTribe: true },
      { id: 'felwood', name: 'Felwood', terrain: 'forest', x: 214, y: 200, lostTribe: true },
      { id: 'hyjal', name: 'Mount Hyjal', terrain: 'mountains', x: 274, y: 226, landmark: 'Nordrassil' },
      { id: 'azshara', name: 'Azshara', terrain: 'hills', x: 322, y: 268, faction: 'horde' },
      { id: 'ashenvale', name: 'Ashenvale', terrain: 'forest', x: 216, y: 274, faction: 'neutral' },
      { id: 'durotar', name: 'Durotar', terrain: 'wasteland', x: 318, y: 334, faction: 'horde', landmark: 'Orgrimmar' },
      { id: 'stonetalon', name: 'Stonetalon Mountains', terrain: 'mountains', x: 178, y: 330 },
      { id: 'nbarrens', name: 'Northern Barrens', terrain: 'fields', x: 262, y: 344, faction: 'horde' },
      { id: 'desolace', name: 'Desolace', terrain: 'wasteland', x: 158, y: 400, lostTribe: true },
      { id: 'mulgore', name: 'Mulgore', terrain: 'fields', x: 232, y: 418, faction: 'horde', landmark: 'Thunder Bluff' },
      { id: 'sbarrens', name: 'Southern Barrens', terrain: 'fields', x: 296, y: 414 },
      { id: 'dustwallow', name: 'Dustwallow Marsh', terrain: 'swamp', x: 320, y: 470, faction: 'alliance' },
      { id: 'feralas', name: 'Feralas', terrain: 'forest', x: 176, y: 476, lostTribe: true },
      { id: 'thousandneedles', name: 'Thousand Needles', terrain: 'hills', x: 264, y: 500 },
      { id: 'silithus', name: 'Silithus', terrain: 'wasteland', x: 166, y: 548, landmark: 'Ahn\u2019Qiraj' },
      { id: 'ungoro', name: "Un'Goro Crater", terrain: 'forest', x: 224, y: 566, lostTribe: true },
      { id: 'tanaris', name: 'Tanaris', terrain: 'wasteland', x: 274, y: 618 },
      { id: 'uldum', name: 'Uldum', terrain: 'wasteland', x: 216, y: 668, landmark: 'Halls of Origination' },
    ],
  },
  {
    id: 'quel-danas',
    name: "Isle of Quel'Danas",
    outline: [
      [800, 72], [834, 66], [856, 84], [850, 110], [820, 120], [796, 102],
    ],
    seeds: [
      { id: 'queldanas', name: "Isle of Quel'Danas", terrain: 'fields', x: 826, y: 92, landmark: 'Sunwell', lostTribe: true },
    ],
  },
  {
    id: 'eastern-kingdoms',
    name: 'Eastern Kingdoms',
    outline: [
      [700, 96], [746, 86], [790, 96], [828, 122], [846, 160], [860, 204], [850, 248],
      [864, 292], [852, 342], [830, 380], [846, 420], [850, 470], [828, 512], [842, 556],
      [846, 606], [820, 650], [790, 676], [770, 712], [742, 748], [706, 762], [676, 740],
      [664, 700], [682, 664], [660, 630], [646, 588], [664, 552], [644, 512], [636, 466],
      [656, 428], [636, 390], [628, 344], [652, 304], [644, 260], [652, 214], [668, 168],
      [676, 126],
    ],
    seeds: [
      { id: 'tirisfal', name: 'Tirisfal Glades', terrain: 'forest', x: 706, y: 140, faction: 'horde', landmark: 'Undercity' },
      { id: 'eversong', name: 'Eversong Woods', terrain: 'forest', x: 796, y: 136, faction: 'horde', landmark: 'Silvermoon' },
      { id: 'ghostlands', name: 'Ghostlands', terrain: 'forest', x: 806, y: 194, lostTribe: true },
      { id: 'wplaguelands', name: 'Western Plaguelands', terrain: 'fields', x: 742, y: 190 },
      { id: 'eplaguelands', name: 'Eastern Plaguelands', terrain: 'wasteland', x: 812, y: 250, lostTribe: true },
      { id: 'silverpine', name: 'Silverpine Forest', terrain: 'forest', x: 682, y: 208, faction: 'horde' },
      { id: 'alterac', name: 'Alterac Mountains', terrain: 'mountains', x: 744, y: 262 },
      { id: 'hillsbrad', name: 'Hillsbrad Foothills', terrain: 'fields', x: 686, y: 282 },
      { id: 'hinterlands', name: 'The Hinterlands', terrain: 'forest', x: 818, y: 306, lostTribe: true },
      { id: 'arathi', name: 'Arathi Highlands', terrain: 'hills', x: 748, y: 330 },
      { id: 'gilneas', name: 'Gilneas', terrain: 'forest', x: 654, y: 330, faction: 'alliance' },
      { id: 'twilighthighlands', name: 'Twilight Highlands', terrain: 'mountains', x: 820, y: 380 },
      { id: 'wetlands', name: 'Wetlands', terrain: 'swamp', x: 692, y: 388 },
      { id: 'lochmodan', name: 'Loch Modan', terrain: 'hills', x: 762, y: 418 },
      { id: 'dunmorogh', name: 'Dun Morogh', terrain: 'mountains', x: 682, y: 452, faction: 'alliance', landmark: 'Ironforge' },
      { id: 'badlands', name: 'Badlands', terrain: 'wasteland', x: 790, y: 452, lostTribe: true },
      { id: 'searinggorge', name: 'Searing Gorge', terrain: 'mountains', x: 744, y: 488 },
      { id: 'burningsteppes', name: 'Burning Steppes', terrain: 'mountains', x: 800, y: 520, landmark: 'Blackrock Mountain' },
      { id: 'elwynn', name: 'Elwynn Forest', terrain: 'forest', x: 688, y: 528, faction: 'alliance', landmark: 'Stormwind' },
      { id: 'westfall', name: 'Westfall', terrain: 'fields', x: 656, y: 574 },
      { id: 'redridge', name: 'Redridge Mountains', terrain: 'mountains', x: 756, y: 560 },
      { id: 'deadwind', name: 'Deadwind Pass', terrain: 'hills', x: 762, y: 606, landmark: 'Karazhan' },
      { id: 'duskwood', name: 'Duskwood', terrain: 'forest', x: 692, y: 616, lostTribe: true },
      { id: 'swampofsorrows', name: 'Swamp of Sorrows', terrain: 'swamp', x: 816, y: 596 },
      { id: 'blastedlands', name: 'Blasted Lands', terrain: 'wasteland', x: 808, y: 650, landmark: 'The Dark Portal' },
      { id: 'nstranglethorn', name: 'Northern Stranglethorn', terrain: 'forest', x: 716, y: 682 },
      { id: 'capestranglethorn', name: 'The Cape of Stranglethorn', terrain: 'swamp', x: 712, y: 736, landmark: 'Booty Bay' },
    ],
  },
  {
    id: 'tolbarad',
    name: 'Tol Barad',
    outline: [
      [590, 396], [618, 388], [636, 406], [628, 430], [600, 436], [582, 418],
    ],
    seeds: [
      { id: 'tolbarad', name: 'Tol Barad', terrain: 'fields', x: 609, y: 412, landmark: 'Baradin Hold' },
    ],
  },
  {
    id: 'kezan',
    name: 'Kezan',
    outline: [
      [452, 736], [486, 728], [508, 748], [500, 776], [468, 786], [444, 766],
    ],
    seeds: [
      { id: 'kezan', name: 'Kezan', terrain: 'hills', x: 476, y: 756, landmark: 'Undermine', faction: 'neutral' },
    ],
  },
  {
    id: 'theramore',
    name: 'Theramore Isle',
    outline: [
      [372, 470], [400, 462], [418, 482], [408, 506], [380, 510], [364, 492],
    ],
    seeds: [
      { id: 'theramore', name: 'Theramore Isle', terrain: 'swamp', x: 390, y: 486, faction: 'alliance' },
    ],
  },
  {
    id: 'maelstrom',
    name: 'The Maelstrom',
    outline: [
      [486, 424], [518, 414], [546, 434], [546, 466], [516, 484], [486, 468], [476, 444],
    ],
    seeds: [
      { id: 'maelstrom', name: 'The Maelstrom', terrain: 'wasteland', x: 512, y: 448, landmark: 'Deepholm', lostTribe: true },
    ],
  },
]
