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
  lake: '#2e5f7e',
  cave: '#57504a',
  magic: '#6f4f9e',
}

export const TERRAIN_LABEL: Record<Terrain, string> = {
  fields: 'Llanura',
  forest: 'Bosque',
  hills: 'Colinas',
  mountains: 'Montañas',
  swamp: 'Pantano',
  wasteland: 'Yermo',
  lake: 'Lago',
  cave: 'Caverna',
  magic: 'Mágica',
}

/* ---------------------------------------------------------- color math */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h * 360, s * 100, l * 100]
}
function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) { r = g = b = l } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
/** lighten/darken a hex color by `amt` lightness points (0-100), clamped */
export function lighten(hex: string, amt: number): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s, Math.min(100, l + amt))
}
export function darken(hex: string, amt: number): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s, Math.max(0, l - amt))
}

export const TERRAIN_LIST = Object.keys(TERRAIN_COLORS) as Terrain[]

/** feTurbulence + feDiffuseLighting recipe per terrain: baseFrequency (x y),
 *  octaves, seed and relief height. Tuned per material so each terrain reads
 *  like an aerial photo texture instead of a flat fill. */
export interface MaterialParams {
  freq: string
  octaves: number
  seed: number
  scale: number
}
export const TERRAIN_MATERIAL: Record<Terrain, MaterialParams> = {
  fields: { freq: '0.02 0.1', octaves: 3, seed: 5, scale: 2.2 },
  forest: { freq: '0.1 0.1', octaves: 5, seed: 12, scale: 5.4 },
  hills: { freq: '0.03 0.034', octaves: 4, seed: 8, scale: 4.6 },
  mountains: { freq: '0.02 0.022', octaves: 5, seed: 21, scale: 9.5 },
  swamp: { freq: '0.05 0.022', octaves: 4, seed: 33, scale: 3.3 },
  wasteland: { freq: '0.035 0.03', octaves: 4, seed: 44, scale: 5.2 },
  lake: { freq: '0.015 0.06', octaves: 3, seed: 51, scale: 2.6 },
  cave: { freq: '0.06 0.05', octaves: 4, seed: 57, scale: 4.2 },
  magic: { freq: '0.045 0.045', octaves: 4, seed: 63, scale: 4.0 },
}
