/**
 * Hand-drawn-ish decoration for the board: terrain motifs scattered inside each
 * region and crisp vector badges for the rule symbols.
 *
 * Emoji were a bad idea for the symbols: every platform draws them differently
 * (and Android renders ⚓ and ★ at wildly different weights), so they are all
 * real SVG paths now, each on a coloured disc so it reads on any terrain.
 */
import type { RegionData, Side, Terrain } from '../game/types'

/* ------------------------------------------------------------- sampling */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pointInPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** distance from a point to the polygon outline — keeps motifs off the borders */
function distToEdge(x: number, y: number, poly: [number, number][]) {
  let min = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j]
    const [x2, y2] = poly[i]
    const dx = x2 - x1
    const dy = y2 - y1
    const l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
    if (d < min) min = d
  }
  return min
}

/** blue-noise-ish scatter of points inside the region, away from label & edges */
function scatter(region: RegionData, count: number, minGap: number, edgePad: number) {
  const rng = makeRng(hash(region.id))
  const xs = region.polygon.map((p) => p[0])
  const ys = region.polygon.map((p) => p[1])
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  const [cx, cy] = region.center
  const pts: { x: number; y: number; r: number }[] = []
  for (let tries = 0; tries < count * 60 && pts.length < count; tries++) {
    const x = x0 + rng() * (x1 - x0)
    const y = y0 + rng() * (y1 - y0)
    if (!pointInPolygon(x, y, region.polygon)) continue
    if (distToEdge(x, y, region.polygon) < edgePad) continue
    // keep the middle clear for the name, the token and the badges
    if (Math.abs(x - cx) < 20 && y > cy - 20 && y < cy + 22) continue
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < minGap)) continue
    pts.push({ x, y, r: rng() })
  }
  return pts
}

/* ------------------------------------------------------------- motifs */
const motif = (t: Terrain, x: number, y: number, r: number, key: string) => {
  const sc = 0.95 + r * 0.5
  switch (t) {
    case 'forest':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.72}>
          <rect x={-0.5} y={1} width={1.1} height={2.4} fill="#2b3f22" />
          <path d="M0 -4.4 L2.6 0.4 L-2.6 0.4 Z" fill="#2f5330" />
          <path d="M0 -4.4 L1.1 -1.9 L-1.1 -1.9 Z" fill="#3d6b3c" />
        </g>
      )
    case 'mountains':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.8}>
          <path d="M-4 2.6 L0 -4 L4 2.6 Z" fill="#5f636b" />
          <path d="M0 -4 L4 2.6 L1.4 2.6 Z" fill="#4a4e56" />
          <path d="M0 -4 L1.5 -1.5 L-1.5 -1.5 Z" fill="#d8dde3" />
        </g>
      )
    case 'hills':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.6}>
          <path d="M-4.6 1.8 q2.3 -3.6 4.6 0 z" fill="#6d4f27" />
          <path d="M-0.8 1.8 q2.6 -4.4 5.4 0 z" fill="#7d5c2e" />
        </g>
      )
    case 'fields':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.6}>
          <path d="M0 2 V-2 M0 -2 l-1.5 -1.4 M0 -2 l1.5 -1.4 M0 0 l-1.4 -1.3 M0 0 l1.4 -1.3"
            stroke="#8a7434" strokeWidth={0.7} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'swamp':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.7}>
          <path d="M-3.4 1.4 q1.7 -1.7 3.4 0 t3.4 0" stroke="#2f4a3c" strokeWidth={0.8} fill="none" strokeLinecap="round" />
          <path d="M-1.6 1.2 V-2.6 M1.6 1.2 V-3.2" stroke="#5c7f56" strokeWidth={0.7} strokeLinecap="round" />
        </g>
      )
    case 'wasteland':
      return (
        <g key={key} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.62}>
          <path d="M-3.2 1.6 q1.6 -1 3.2 0 q1.6 1 3.2 0" stroke="#7d4526" strokeWidth={0.7} fill="none" strokeLinecap="round" />
          <circle cx={1.6} cy={-1.4} r={0.7} fill="#7d4526" />
          <circle cx={-1.8} cy={-0.6} r={0.5} fill="#8d5230" />
        </g>
      )
  }
}

const DENSITY: Record<Terrain, { n: number; gap: number }> = {
  forest: { n: 14, gap: 8 },
  mountains: { n: 8, gap: 11 },
  hills: { n: 8, gap: 11 },
  fields: { n: 12, gap: 9 },
  swamp: { n: 9, gap: 10 },
  wasteland: { n: 8, gap: 11 },
}

const decorCache = new Map<string, React.ReactNode>()

/** deterministic terrain decoration, computed once per region */
export function terrainDecor(region: RegionData): React.ReactNode {
  const cached = decorCache.get(region.id)
  if (cached) return cached
  const { n, gap } = DENSITY[region.terrain]
  const pts = scatter(region, n, gap, 7.5)
  const node = <>{pts.map((p, i) => motif(region.terrain, p.x, p.y, p.r, `${region.id}-${i}`))}</>
  decorCache.set(region.id, node)
  return node
}

/* -------------------------------------------------------------- badges */
function starPath(outer: number, inner: number, points = 5) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (Math.PI / points) * i - Math.PI / 2
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`
  }
  return d + 'Z'
}

export type BadgeKind = 'anchor' | 'landmark' | 'mountain' | 'fortress' | 'hero' | 'tribe'

const GLYPH: Record<BadgeKind, { bg: string; ring: string; node: React.ReactNode }> = {
  // anchor: unmistakable silhouette — ring, crossbar, hooked base
  anchor: {
    bg: '#1d5f8c', ring: '#a8dcff',
    node: (
      <g stroke="#eaf6ff" strokeWidth={1.7} fill="none" strokeLinecap="round">
        <circle cx={0} cy={-6} r={2.2} />
        <path d="M0 -3.8 V7" />
        <path d="M-4.6 -1.4 H4.6" />
        <path d="M-6 3.2 a6 6 0 0 0 12 0" />
      </g>
    ),
  },
  // landmark: solid five-pointed star, nothing else on the board is star-shaped
  landmark: {
    bg: '#8a6410', ring: '#ffe9a8',
    node: <path d={starPath(7.6, 3.3)} fill="#ffd964" stroke="#5c3f05" strokeWidth={0.8} strokeLinejoin="round" />,
  },
  // mountain: double peak with snow cap
  mountain: {
    bg: '#4a4f57', ring: '#cfd6de',
    node: (
      <g>
        <path d="M-7 5 L-1.5 -4 L2 1 L4 -2 L7.5 5 Z" fill="#9aa3ad" stroke="#2b3038" strokeWidth={0.7} strokeLinejoin="round" />
        <path d="M-1.5 -4 L0.6 -0.6 L-3.4 -0.6 Z" fill="#f2f6fa" />
      </g>
    ),
  },
  fortress: {
    bg: '#1f6b45', ring: '#9ff0c4',
    node: <path d="M0 -7 L6.5 -4.2 V0.6 C6.5 4.6 3.4 6.6 0 7.4 C-3.4 6.6 -6.5 4.6 -6.5 0.6 V-4.2 Z"
      fill="#7fe3a1" stroke="#0d3a24" strokeWidth={0.9} strokeLinejoin="round" />,
  },
  hero: {
    bg: '#8c2f2f', ring: '#ffb3b3',
    node: (
      <g stroke="#0f0b0b" strokeWidth={0.7} strokeLinejoin="round">
        <path d="M4.8 -7.2 L7.2 -4.8 L-2.4 5 L-5 5.4 L-4.6 2.8 Z" fill="#ffd9d9" />
        <path d="M-5.6 -6.4 L-2.6 -3.4 M-6.8 -3.6 L-3.8 -0.6" stroke="#ffd9d9" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ),
  },
  // lost tribe: little skull, clearly not one of the player tokens
  tribe: {
    bg: '#2b333c', ring: '#b9c6d2',
    node: (
      <g fill="#dbe4ec">
        <path d="M0 -6.6 C4.2 -6.6 6.6 -3.8 6.6 -0.6 C6.6 1.8 5.2 3.2 3.6 3.8 L3.6 6 L-3.6 6 L-3.6 3.8 C-5.2 3.2 -6.6 1.8 -6.6 -0.6 C-6.6 -3.8 -4.2 -6.6 0 -6.6 Z" />
        <circle cx={-2.6} cy={-1} r={1.7} fill="#2b333c" />
        <circle cx={2.6} cy={-1} r={1.7} fill="#2b333c" />
        <path d="M-1 2.2 h2 v1.6 h-2 Z" fill="#2b333c" />
      </g>
    ),
  },
}

export function Badge({ kind, x, y, r }: { kind: BadgeKind; x: number; y: number; r: number }) {
  const g = GLYPH[kind]
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={g.bg} stroke={g.ring} strokeWidth={r * 0.16} />
      <circle r={r} fill="none" stroke="#0a1219" strokeWidth={r * 0.08} opacity={0.7} />
      <g transform={`scale(${r / 9.6})`}>{g.node}</g>
    </g>
  )
}

/** which badges a region shows, in a stable order */
export function badgesFor(
  region: RegionData,
  st: { fortress: number; hero: boolean; owner: string | null },
): BadgeKind[] {
  const out: BadgeKind[] = []
  if (region.mountain) out.push('mountain')
  if (region.coastal) out.push('anchor')
  if (region.landmark) out.push('landmark')
  if (st.owner === 'lost-tribe') out.push('tribe')
  if (st.fortress > 0) out.push('fortress')
  if (st.hero) out.push('hero')
  return out
}

/* ------------------------------------------------- faction emblems */
/**
 * Our own emblems, not Blizzard's: a shield for the Alliance and a double
 * bladed axe head for the Horde. Drawn as a small solid badge in the bottom
 * left corner, away from the rule badges (top row) and the sea-landing anchor
 * (right), so nothing important gets covered.
 */
const EMBLEM: Record<'alliance' | 'horde', { glyph: React.ReactNode; fill: string; ring: string }> = {
  alliance: {
    fill: '#2f68b3',
    ring: '#bcdcff',
    glyph: (
      <path d="M0 -6.6 L5.6 -4.2 V1.2 C5.6 5.4 2.9 8.4 0 9.6 C-2.9 8.4 -5.6 5.4 -5.6 1.2 V-4.2 Z
               M0 -4.2 L-3.4 -2.8 V1.1 C-3.4 3.9 -1.8 6 0 6.9 C1.8 6 3.4 3.9 3.4 1.1 V-2.8 Z" />
    ),
  },
  horde: {
    fill: '#a8391f',
    ring: '#ffc7ad',
    glyph: (
      <path d="M-1.1 -7.4 C3.6 -6.2 7.4 -2.2 8 3.4 C8.3 6.6 6.4 9 3.2 9.8 L1.7 6.3
               C3.8 5.4 4.7 3.6 4.4 1.2 C4 -2 1.7 -4.4 -1.1 -5.2 Z
               M1.1 -7.4 C-3.6 -6.2 -7.4 -2.2 -8 3.4 C-8.3 6.6 -6.4 9 -3.2 9.8 L-1.7 6.3
               C-3.8 5.4 -4.7 3.6 -4.4 1.2 C-4 -2 -1.7 -4.4 1.1 -5.2 Z
               M0 -3 L2.3 3.4 H-2.3 Z" />
    ),
  },
}

export function FactionMark({ side, x, y, r = 5.6 }: { side: Side; x: number; y: number; r?: number }) {
  if (side === 'neutral') return null
  const e = EMBLEM[side]
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={r} fill={e.fill} fillOpacity={0.95} stroke="#0b1016" strokeWidth={0.9} />
      <circle r={r} fill="none" stroke={e.ring} strokeWidth={0.8} strokeOpacity={0.85} />
      <g transform={`scale(${r / 9.6})`} fill={e.ring}>{e.glyph}</g>
    </g>
  )
}

/** inline version for legends and side panels */
export function FactionIcon({ side, size = 16 }: { side: Side; size?: number }) {
  if (side === 'neutral') return null
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" style={{ verticalAlign: 'middle' }}>
      <FactionMark side={side} x={0} y={0} r={7.4} />
    </svg>
  )
}

/* ------------------------------------------------- legendary places & artifacts */
export function LegendaryMark({
  isArtifact,
  revealed,
  x,
  y,
  r = 7.2,
}: {
  isArtifact: boolean
  revealed: boolean
  x: number
  y: number
  r?: number
}) {
  const bg = revealed ? (isArtifact ? '#6a3fb5' : '#8a6410') : '#2a2f3a'
  const ring = revealed ? (isArtifact ? '#d2b8ff' : '#ffe9a8') : '#8b9bab'
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={r} fill={bg} stroke={ring} strokeWidth={r * 0.18} />
      <circle r={r} fill="none" stroke="#0a1219" strokeWidth={r * 0.08} opacity={0.6} />
      <g transform={`scale(${r / 9.6})`}>
        {!revealed ? (
          <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#dde6ef">?</text>
        ) : isArtifact ? (
          // artifact: crystal / gem
          <g>
            <path d="M0 -6.5 L4.8 -2 L2.8 6 L-2.8 6 L-4.8 -2 Z" fill="#d2b8ff" stroke="#3a225a" strokeWidth={0.8} />
            <path d="M0 -6.5 L0 6 M-4.8 -2 L2.8 6 M4.8 -2 L-2.8 6" stroke="#8a5bd6" strokeWidth={0.6} opacity={0.8} />
          </g>
        ) : (
          // legendary place: star
          <path d={starPath(7.2, 3.1)} fill="#ffd964" stroke="#5c3f05" strokeWidth={0.8} strokeLinejoin="round" />
        )}
      </g>
    </g>
  )
}

export function LegendaryIcon({ isArtifact, size = 16 }: { isArtifact: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" style={{ verticalAlign: 'middle' }}>
      <LegendaryMark isArtifact={isArtifact} revealed x={0} y={0} r={8.5} />
    </svg>
  )
}
