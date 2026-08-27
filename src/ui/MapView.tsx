import { useMemo } from 'react'
import { REGION_BY_ID, boardRegions, conquestCost, defenseOf, ownerPlayer } from '../game/engine'
import { LOST_TRIBE, type GameState, type RegionData } from '../game/types'
import { PLAYER_COLORS, TERRAIN_COLORS, TERRAIN_LABEL } from './theme'

interface Props {
  state: GameState
  selected: string | null
  onSelect: (id: string) => void
  highlightTargets: boolean
  markerMode: boolean
}

function roundedPath(points: [number, number][], r = 3.5) {
  if (points.length < 3) return ''
  let d = ''
  const n = points.length
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]
    const v1 = [cur[0] - prev[0], cur[1] - prev[1]]
    const v2 = [next[0] - cur[0], next[1] - cur[1]]
    const l1 = Math.hypot(v1[0], v1[1]) || 1
    const l2 = Math.hypot(v2[0], v2[1]) || 1
    const rr = Math.min(r, l1 / 2.2, l2 / 2.2)
    const p1 = [cur[0] - (v1[0] / l1) * rr, cur[1] - (v1[1] / l1) * rr]
    const p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr]
    d += i === 0 ? `M ${p1[0]} ${p1[1]}` : ` L ${p1[0]} ${p1[1]}`
    d += ` Q ${cur[0]} ${cur[1]} ${p2[0]} ${p2[1]}`
  }
  return d + ' Z'
}

export function MapView({ state, selected, onSelect, highlightTargets, markerMode }: Props) {
  const regions = useMemo(() => boardRegions(state), [state.landmasses])

  const viewBox = useMemo(() => {
    const xs = regions.flatMap((r) => r.polygon.map((p) => p[0]))
    const ys = regions.flatMap((r) => r.polygon.map((p) => p[1]))
    const pad = 24
    const x0 = Math.min(...xs) - pad
    const y0 = Math.min(...ys) - pad
    return `${x0} ${y0} ${Math.max(...xs) - x0 + pad} ${Math.max(...ys) - y0 + pad}`
  }, [regions])

  const targets = useMemo(() => {
    const map: Record<string, { cost: number; viaSea: boolean }> = {}
    if (!highlightTargets) return map
    for (const r of regions) {
      const info = conquestCost(state, r.id)
      if (info.reachable) map[r.id] = { cost: info.cost, viaSea: info.viaSea }
    }
    return map
  }, [state, highlightTargets, regions])

  const player = state.players[state.current]
  const activeUid = player?.activeUid ?? null

  return (
    <svg className="map" viewBox={viewBox} role="img" aria-label="Mapa de Azeroth">
      <defs>
        <radialGradient id="sea" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#16324a" />
          <stop offset="100%" stopColor="#0a1622" />
        </radialGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="waves" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M0 12 q4.5 -5 9 0 t9 0" fill="none" stroke="#2b5573" strokeWidth="0.8" opacity="0.5" />
        </pattern>
      </defs>

      <rect x="-500" y="-500" width="3000" height="3000" fill="url(#sea)" />
      <rect x="-500" y="-500" width="3000" height="3000" fill="url(#waves)" />

      {regions.map((r) => {
        const st = state.regions[r.id]
        const owner = st.owner
        const pid = ownerPlayer(state, owner)
        const isTarget = !!targets[r.id]
        const isSelected = selected === r.id
        const canMark = markerMode && owner === activeUid
        const fill = TERRAIN_COLORS[r.terrain]
        return (
          <g
            key={r.id}
            className={`region${isTarget ? ' target' : ''}${isSelected ? ' selected' : ''}${canMark ? ' markable' : ''}`}
            onClick={() => onSelect(r.id)}
          >
            <title>{`${r.name} — ${TERRAIN_LABEL[r.terrain]}${r.mountain ? ' (montaña, +1 def)' : ''}${r.coastal ? ' · costera ⚓' : ''}${r.landmark ? ` · ${r.landmark}` : ''}\nDefensa: ${defenseOf(state, r.id)}${targets[r.id] ? `\nCoste de conquista: ${targets[r.id].cost}` : ''}`}</title>
            <path d={roundedPath(r.polygon)} fill={fill} stroke="#0d1620" strokeWidth={1.2} />
            {pid !== null && (
              <path d={roundedPath(r.polygon)} fill={PLAYER_COLORS[pid]} opacity={state.factions[owner!]?.inDecline ? 0.3 : 0.55} />
            )}
            {owner === LOST_TRIBE && <path d={roundedPath(r.polygon)} fill="#000" opacity={0.28} />}
            <path className="outline" d={roundedPath(r.polygon)} fill="none" stroke="#0d1620" strokeWidth={1.2} />
          </g>
        )
      })}

      {regions.map((r) => {
        const st = state.regions[r.id]
        const [cx, cy] = r.center
        const pid = ownerPlayer(state, st.owner)
        const decline = st.owner && st.owner !== LOST_TRIBE && state.factions[st.owner]?.inDecline
        return (
          <g key={`o-${r.id}`} className="overlay" pointerEvents="none">
            {r.mountain && <text x={cx} y={cy - 12} className="icon">⛰</text>}
            {r.landmark && <text x={cx + 13} y={cy - 11} className="icon gold">★</text>}
            {r.coastal && <text x={cx - 15} y={cy - 11} className="icon anchor">⚓</text>}
            <text x={cx} y={cy - 2} className="rname">{r.name}</text>
            {st.owner && (
              <g transform={`translate(${cx}, ${cy + 12})`}>
                <circle r="8.5" fill={st.owner === LOST_TRIBE ? '#2f3a44' : PLAYER_COLORS[pid!]}
                  stroke="#0b1219" strokeWidth="1.4" opacity={decline ? 0.65 : 1} />
                <text className="tokens" y="3.4">{st.tokens}</text>
              </g>
            )}
            {st.fortress > 0 && <text x={cx + 18} y={cy + 16} className="icon">🛡</text>}
            {st.hero && <text x={cx - 18} y={cy + 16} className="icon">🗡</text>}
            {targets[r.id] && (
              <g transform={`translate(${cx + (st.owner ? 22 : 0)}, ${cy + (st.owner ? 12 : 12)})`} className="costbadge">
                <circle r="9" />
                <text y="3.4">{targets[r.id].cost}</text>
                {targets[r.id].viaSea && <text y="-11" className="icon anchor">⚓</text>}
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function regionName(id: string): string {
  return REGION_BY_ID[id]?.name ?? id
}

export type { RegionData }
