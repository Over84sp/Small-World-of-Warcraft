import type { Terrain } from '../game/types'

export const PLAYER_COLORS = ['#c8442f', '#2f7dc8', '#3f9d5c', '#c9a227', '#8a5bc8']
export const PLAYER_NAMES = ['Alianza', 'Horda', 'Sindicato', 'Círculo Cenarion', 'Culto Crepuscular']

export const TERRAIN_COLORS: Record<Terrain, string> = {
  fields: '#c2ad6c',
  forest: '#416b3c',
  hills: '#9a7038',
  mountains: '#7f8288',
  swamp: '#456253',
  wasteland: '#a4643f',
}

export const TERRAIN_LABEL: Record<Terrain, string> = {
  fields: 'Llanura',
  forest: 'Bosque',
  hills: 'Colinas',
  mountains: 'Montañas',
  swamp: 'Pantano',
  wasteland: 'Yermo',
}
