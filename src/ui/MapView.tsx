import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REGION_BY_ID, boardRegions, conquestCost, defenseOf, ownerPlayer } from '../game/engine'
import { LOST_TRIBE, type GameState, type RegionData } from '../game/types'
import { PLAYER_COLORS, TERRAIN_COLORS, TERRAIN_LABEL } from './theme'

interface Props {
  state: GameState
  selected: string | null
  onSelect: (id: string) => void
  highlightTargets: boolean
  markerMode: boolean
  /** tutorial: only these regions react to clicks and get a pulsing ring */
  spotlight?: string[] | null
  /** bigger text / tokens for phones */
  compact?: boolean
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

interface View { k: number; tx: number; ty: number }
const IDENTITY: View = { k: 1, tx: 0, ty: 0 }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function MapView({
  state, selected, onSelect, highlightTargets, markerMode, spotlight, compact,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<View>(IDENTITY)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null)
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const regions = useMemo(() => boardRegions(state), [state.landmasses])

  const viewBox = useMemo(() => {
    const xs = regions.flatMap((r) => r.polygon.map((p) => p[0]))
    const ys = regions.flatMap((r) => r.polygon.map((p) => p[1]))
    const pad = 24
    const x0 = Math.min(...xs) - pad
    const y0 = Math.min(...ys) - pad
    return { x0, y0, w: Math.max(...xs) - x0 + pad, h: Math.max(...ys) - y0 + pad }
  }, [regions])

  // reset the camera when the board itself changes
  useEffect(() => setView(IDENTITY), [state.boardId])

  /** client coords -> current viewBox user units */
  const toUser = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = svg.createSVGPoint()
    p.x = cx
    p.y = cy
    const u = p.matrixTransform(ctm.inverse())
    return { x: u.x, y: u.y }
  }, [])

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const q = toUser(cx, cy)
      const k = clamp(v.k * factor, 1, 7)
      const f = k / v.k
      return { k, tx: q.x - f * (q.x - v.tx), ty: q.y - f * (q.y - v.ty) }
    })
  }, [toUser])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    down.current = { x: e.clientX, y: e.clientY, moved: false }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)!
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (gesture.current.dist > 0) zoomAt(dist / gesture.current.dist, mid.x, mid.y)
      gesture.current = { dist, mid }
      if (down.current) down.current.moved = true
      return
    }

    if (e.buttons === 0 && e.pointerType === 'mouse') return
    const d = Math.hypot(e.clientX - (down.current?.x ?? e.clientX), e.clientY - (down.current?.y ?? e.clientY))
    if (d > 6 && down.current) down.current.moved = true
    if (!down.current?.moved) return

    const a = toUser(prev.x, prev.y)
    const b = toUser(e.clientX, e.clientY)
    setView((v) => ({ ...v, tx: v.tx + (b.x - a.x), ty: v.ty + (b.y - a.y) }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  const clickRegion = (id: string) => {
    if (down.current?.moved) return
    onSelect(id)
  }

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
  const spot = spotlight ? new Set(spotlight) : null
  // keep labels readable regardless of zoom
  const s = (n: number) => n / Math.sqrt(view.k) * (compact ? 1.25 : 1)

  return (
    <div className="mapwrap">
      <svg
        ref={svgRef}
        className="map"
        viewBox={`${viewBox.x0} ${viewBox.y0} ${viewBox.w} ${viewBox.h}`}
        role="img"
        aria-label="Mapa de Azeroth"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <radialGradient id="sea" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#16324a" />
            <stop offset="100%" stopColor="#0a1622" />
          </radialGradient>
          <pattern id="waves" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 12 q4.5 -5 9 0 t9 0" fill="none" stroke="#2b5573" strokeWidth="0.8" opacity="0.5" />
          </pattern>
        </defs>

        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#sea)" />
        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#waves)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {regions.map((r) => {
            const st = state.regions[r.id]
            const owner = st.owner
            const pid = ownerPlayer(state, owner)
            const isTarget = !!targets[r.id]
            const isSelected = selected === r.id
            const canMark = markerMode && owner === activeUid
            const dimmed = !!spot && !spot.has(r.id)
            return (
              <g
                key={r.id}
                className={`region${isTarget ? ' target' : ''}${isSelected ? ' selected' : ''}${canMark ? ' markable' : ''}${dimmed ? ' dimmed' : ''}${spot?.has(r.id) ? ' spot' : ''}`}
                onClick={() => clickRegion(r.id)}
              >
                <title>{`${r.name} — ${TERRAIN_LABEL[r.terrain]}${r.mountain ? ' (montaña, +1 def)' : ''}${r.coastal ? ' · costera ⚓' : ''}${r.landmark ? ` · ${r.landmark}` : ''}\nDefensa: ${defenseOf(state, r.id)}${targets[r.id] ? `\nCoste de conquista: ${targets[r.id].cost}` : ''}`}</title>
                <path d={roundedPath(r.polygon)} fill={TERRAIN_COLORS[r.terrain]} stroke="#0d1620" strokeWidth={1.2} />
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
            const dimmed = !!spot && !spot.has(r.id)
            return (
              <g key={`o-${r.id}`} className={`overlay${dimmed ? ' dimmed' : ''}`} pointerEvents="none">
                {r.mountain && <text x={cx} y={cy - s(12)} className="icon" fontSize={s(8)}>⛰</text>}
                {r.landmark && <text x={cx + s(13)} y={cy - s(11)} className="icon gold" fontSize={s(8)}>★</text>}
                {r.coastal && <text x={cx - s(15)} y={cy - s(11)} className="icon anchor" fontSize={s(8)}>⚓</text>}
                <text x={cx} y={cy - s(2)} className="rname" fontSize={s(7.2)} strokeWidth={s(2.2)}>{r.name}</text>
                {st.owner && (
                  <g transform={`translate(${cx}, ${cy + s(12)})`}>
                    <circle r={s(8.5)} fill={st.owner === LOST_TRIBE ? '#2f3a44' : PLAYER_COLORS[pid!]}
                      stroke="#0b1219" strokeWidth={s(1.4)} opacity={decline ? 0.65 : 1} />
                    <text className="tokens" y={s(3.4)} fontSize={s(9.5)}>{st.tokens}</text>
                  </g>
                )}
                {st.fortress > 0 && <text x={cx + s(18)} y={cy + s(16)} className="icon" fontSize={s(8)}>🛡</text>}
                {st.hero && <text x={cx - s(18)} y={cy + s(16)} className="icon" fontSize={s(8)}>🗡</text>}
                {targets[r.id] && (
                  <g transform={`translate(${cx + (st.owner ? s(22) : 0)}, ${cy + s(12)})`} className="costbadge">
                    <circle r={s(9)} />
                    <text y={s(3.4)} fontSize={s(9.5)}>{targets[r.id].cost}</text>
                    {targets[r.id].viaSea && <text y={-s(11)} className="icon anchor" fontSize={s(8)}>⚓</text>}
                  </g>
                )}
                {spot?.has(r.id) && (
                  <circle className="spotring" cx={cx} cy={cy} r={s(20)} fill="none" stroke="#ffe28a" strokeWidth={s(2)} />
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="zoomctl">
        <button onClick={() => { const b = svgRef.current!.getBoundingClientRect(); zoomAt(1.3, b.left + b.width / 2, b.top + b.height / 2) }} aria-label="Acercar">＋</button>
        <button onClick={() => { const b = svgRef.current!.getBoundingClientRect(); zoomAt(1 / 1.3, b.left + b.width / 2, b.top + b.height / 2) }} aria-label="Alejar">－</button>
        <button onClick={() => setView(IDENTITY)} aria-label="Centrar mapa">⤢</button>
      </div>
    </div>
  )
}

export function regionName(id: string): string {
  return REGION_BY_ID[id]?.name ?? id
}

export type { RegionData }
