import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REGION_BY_ID, boardRegions, conquestCost, defenseOf, legendaryAt, ownerPlayer } from '../game/engine'
import { LOST_TRIBE, type GameState, type RegionData } from '../game/types'
import { PLAYER_COLORS, TERRAIN_COLORS, TERRAIN_LABEL, TERRAIN_LIST, TERRAIN_MATERIAL, lighten, darken } from './theme'
import { Badge, FactionMark, LegendaryMark, badgesFor, terrainDecor } from './mapArt'

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

/** splits long region names at the most central space, max two lines */
function wrapName(name: string): string[] {
  if (name.length <= 13) return [name]
  const spaces: number[] = []
  for (let i = 0; i < name.length; i++) if (name[i] === ' ') spaces.push(i)
  if (!spaces.length) return [name]
  const mid = name.length / 2
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), spaces[0])
  return [name.slice(0, at), name.slice(at + 1)]
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
          {/* deep-water gradient: a lighter sunlit patch fading to near-black depths */}
          <radialGradient id="sea" cx="42%" cy="36%" r="85%">
            <stop offset="0%" stopColor="#245876" />
            <stop offset="30%" stopColor="#1a4a63" />
            <stop offset="62%" stopColor="#123246" />
            <stop offset="100%" stopColor="#050c13" />
          </radialGradient>
          {/* two wave layers at different scales read as gentle swell, not a flat pattern */}
          <pattern id="waves" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(6)">
            <path d="M0 22 q8.5 -9 17 0 t17 0" fill="none" stroke="#3a7396" strokeWidth="1" opacity="0.35" />
            <path d="M-8 8 q8.5 -8 17 0 t17 0" fill="none" stroke="#2c5a78" strokeWidth="0.7" opacity="0.3" />
          </pattern>
          <pattern id="wavesFine" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
            <path d="M0 9 q3.2 -3.6 6.5 0 t6.5 0" fill="none" stroke="#4a86a8" strokeWidth="0.5" opacity="0.22" />
          </pattern>
          {/* subtle turbulence used both as sea caustics and as land paper-grain */}
          <filter id="noiseTex" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
          </filter>
          <pattern id="grain" width="140" height="140" patternUnits="userSpaceOnUse">
            <rect width="140" height="140" filter="url(#noiseTex)" />
          </pattern>
          {/* darkened rim so the whole archipelago reads as sitting in deep water */}
          <radialGradient id="vignette" cx="50%" cy="45%" r="72%">
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </radialGradient>
          {/* soft shoreline halo so land reads as land */}
          <filter id="shore" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b" />
            <feFlood floodColor="#071019" floodOpacity="0.75" />
            <feComposite in2="b" operator="in" />
            <feComposite in2="SourceAlpha" operator="out" result="halo" />
            <feMerge><feMergeNode in="halo" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* bright blurred stroke behind coastal regions reads as surf breaking on the shore */}
          <filter id="foam" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </linearGradient>
          {TERRAIN_LIST.map((t) => (
            <linearGradient key={`grad-${t}`} id={`terrain-${t}`} x1="0.15" y1="0" x2="0.65" y2="1">
              <stop offset="0%" stopColor={lighten(TERRAIN_COLORS[t], 13)} />
              <stop offset="55%" stopColor={TERRAIN_COLORS[t]} />
              <stop offset="100%" stopColor={darken(TERRAIN_COLORS[t], 11)} />
            </linearGradient>
          ))}
          {/* relief-shaded "aerial photo" material per terrain: fractal noise
              lit from the upper-left and multiplied with the terrain colour.
              Fully procedural — no external imagery involved. */}
          {TERRAIN_LIST.map((t) => {
            const m = TERRAIN_MATERIAL[t]
            return (
              <Fragment key={`mat-${t}`}>
                <filter id={`tex-${t}`} x="0%" y="0%" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency={m.freq} numOctaves={m.octaves} seed={m.seed} stitchTiles="stitch" result="n" />
                  <feDiffuseLighting in="n" surfaceScale={m.scale} diffuseConstant="1.15" lightingColor="#ffffff" result="lit">
                    <feDistantLight azimuth={235} elevation={55} />
                  </feDiffuseLighting>
                  <feFlood floodColor={TERRAIN_COLORS[t]} result="tint" />
                  <feBlend in="tint" in2="lit" mode="multiply" />
                </filter>
                <pattern id={`mat-${t}`} width={200} height={200} patternUnits="userSpaceOnUse">
                  <rect width={200} height={200} filter={`url(#tex-${t})`} />
                </pattern>
              </Fragment>
            )
          })}
          {/* same recipe for the sea: a lit, rippled water surface instead of flat caustics */}
          <filter id="tex-sea" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves={4} seed={44} stitchTiles="stitch" result="n" />
            <feDiffuseLighting in="n" surfaceScale={3.4} diffuseConstant="1" lightingColor="#bfe6f5" result="lit">
              <feDistantLight azimuth={235} elevation={58} />
            </feDiffuseLighting>
          </filter>
          <pattern id="mat-sea" width={320} height={320} patternUnits="userSpaceOnUse">
            <rect width={320} height={320} filter="url(#tex-sea)" />
          </pattern>
          {regions.map((r) => (
            <clipPath key={`cp-${r.id}`} id={`cp-${r.id}`}>
              <path d={roundedPath(r.polygon)} />
            </clipPath>
          ))}
        </defs>

        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#sea)" />
        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#mat-sea)" opacity="0.55" style={{ mixBlendMode: 'soft-light' }} />
        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#waves)" />
        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#wavesFine)" />
        <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#vignette)" />

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
                <title>{`${r.name} — ${TERRAIN_LABEL[r.terrain]}${r.faction && r.faction !== 'neutral' ? ` · ${r.faction === 'alliance' ? 'Alianza' : 'Horda'}` : ''}${r.mountain ? ' (montaña, +1 def)' : ''}${r.coastal ? ' · costera ⚓' : ''}${r.landmark ? ` · ${r.landmark}` : ''}\nDefensa: ${defenseOf(state, r.id)}${targets[r.id] ? `\nCoste de conquista: ${targets[r.id].cost}` : ''}`}</title>
                {r.coastal && (
                  <path d={roundedPath(r.polygon)} fill="none" stroke="#cdeeff" strokeWidth={4.5}
                    opacity={0.4} filter="url(#foam)" pointerEvents="none" />
                )}
                <path d={roundedPath(r.polygon)} fill={`url(#terrain-${r.terrain})`} filter="url(#shore)" />
                <path d={roundedPath(r.polygon)} fill={`url(#mat-${r.terrain})`} pointerEvents="none" />
                <g clipPath={`url(#cp-${r.id})`}>
                  <rect x={r.center[0] - 60} y={r.center[1] - 60} width={120} height={120}
                    fill="url(#grain)" opacity={0.5} style={{ mixBlendMode: 'overlay' }} pointerEvents="none" />
                  {r.faction && r.faction !== 'neutral' && (
                    <FactionMark side={r.faction} x={r.center[0] - 15} y={r.center[1] + 11} />
                  )}
                  {terrainDecor(r)}
                  {/* ownership reads as a coloured band hugging the border, so the
                      terrain underneath stays identifiable at a glance */}
                  {pid !== null && (
                    <path d={roundedPath(r.polygon)} fill="none"
                      stroke={PLAYER_COLORS[pid]} strokeWidth={9}
                      strokeDasharray={state.factions[owner!]?.inDecline ? '7 5' : undefined}
                      opacity={state.factions[owner!]?.inDecline ? 0.55 : 0.95} />
                  )}
                  {owner === LOST_TRIBE && (
                    <path d={roundedPath(r.polygon)} fill="none" stroke="#11181f" strokeWidth={9} opacity={0.5} />
                  )}
                </g>
                {pid !== null && (
                  <path d={roundedPath(r.polygon)} fill={PLAYER_COLORS[pid]} opacity={0.12} />
                )}
                <path d={roundedPath(r.polygon)} fill="url(#sheen)" pointerEvents="none" />
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
            const leg = legendaryAt(state, r.id)
            return (
              <g key={`o-${r.id}`} className={`overlay${dimmed ? ' dimmed' : ''}`} pointerEvents="none">
                {(() => {
                  const kinds = badgesFor(r, st)
                  const br = s(5.6)
                  const gap = br * 2.3
                  return kinds.map((k, i) => (
                    <Badge key={k} kind={k} r={br}
                      x={cx + (i - (kinds.length - 1) / 2) * gap}
                      y={cy - s(16)} />
                  ))
                })()}
                {(() => {
                  const lines = wrapName(r.name)
                  const fs = s(lines.length > 1 ? 6.8 : 7.6)
                  const y0 = cy - s(1) - (lines.length - 1) * fs * 0.42
                  return lines.map((line, li) => (
                    <g key={li}>
                      <text x={cx} y={y0 + li * fs * 0.95} className="rname halo" fontSize={fs} strokeWidth={s(1.7)}>{line}</text>
                      <text x={cx} y={y0 + li * fs * 0.95} className="rname" fontSize={fs}>{line}</text>
                    </g>
                  ))
                })()}
                {st.owner && (
                  <g transform={`translate(${cx}, ${cy + s(11)})`}>
                    <circle r={s(8.5)} fill={st.owner === LOST_TRIBE ? '#2f3a44' : PLAYER_COLORS[pid!]}
                      stroke="#0b1219" strokeWidth={s(1.4)} opacity={decline ? 0.65 : 1} />
                    <text className="tokens" y={s(3.4)} fontSize={s(9.5)}>{st.tokens}</text>
                  </g>
                )}
                {targets[r.id] && (
                  <g transform={`translate(${cx + (st.owner ? s(22) : 0)}, ${cy + s(11)})`} className="costbadge">
                    <circle r={s(9)} />
                    <text y={s(3.4)} fontSize={s(9.5)}>{targets[r.id].cost}</text>
                    {targets[r.id].viaSea && <Badge kind="anchor" x={s(10)} y={s(7)} r={s(4.4)} />}
                  </g>
                )}
                {leg && (
                  <LegendaryMark
                    isArtifact={leg.isArtifact}
                    revealed={leg.revealed}
                    x={cx + 15}
                    y={cy + 11}
                    r={s(7.2)}
                  />
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
