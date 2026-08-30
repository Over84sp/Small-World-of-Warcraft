import type { ReactElement } from 'react'
import type { GameState } from '../game/types'
import type { BattleAnim } from './MapView'
import { REGION_BY_ID } from '../game/engine'
import { PLAYER_COLORS } from './theme'

/* ------------------------------------------------- drawn glyphs (SVG) */

const Swords = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <g stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M-6.5 -6.5 L5.5 5.5 M5.5 5.5 L6.5 6.5" fill="none" />
      <path d="M6.5 -6.5 L-5.5 5.5 M-5.5 5.5 L-6.5 6.5" fill="none" />
      <path d="M2.6 2.6 L4.6 0.6 M-2.6 2.6 L-4.6 0.6" strokeWidth={1.4} />
    </g>
  </svg>
)

const Shield = ({ n, s = 20 }: { n?: number; s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M0 -8 L6.5 -5.2 V1 C6.5 5.6 3.4 7.6 0 8.6 C-3.4 7.6 -6.5 5.6 -6.5 1 V-5.2 Z"
      fill="currentColor" opacity={0.25} stroke="currentColor" strokeWidth={1.6} />
    {n !== undefined && (
      <text x={0} y={3.4} textAnchor="middle" fontSize={9} fontWeight={800} fill="currentColor">{n}</text>
    )}
  </svg>
)

const pips: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [[-3, -3], [3, 3]],
  3: [[-3, -3], [0, 0], [3, 3]],
}

const Die = ({ n = 0, s = 20 }: { n?: number; s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <rect x={-7.5} y={-7.5} width={15} height={15} rx={3.4} fill="currentColor" opacity={0.2}
      stroke="currentColor" strokeWidth={1.6} />
    {pips[n]?.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.7} fill="currentColor" />)}
  </svg>
)

const Anchor = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <g stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round">
      <circle cx={0} cy={-6} r={2} />
      <path d="M0 -4 V7 M-4.4 -1 H4.4 M-5.8 3.2 a5.8 5.8 0 0 0 11.6 0" />
    </g>
  </svg>
)

const Banner = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M-5 -8 V8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M-5 -7 H6 L3 -4 L6 -1 H-5 Z" fill="currentColor" opacity={0.3} stroke="currentColor" strokeWidth={1.5} />
  </svg>
)

const Coin = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <circle r={7} fill="currentColor" opacity={0.25} stroke="currentColor" strokeWidth={1.6} />
    <text x={0} y={3.2} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="currentColor">¢</text>
  </svg>
)

const Spark = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="currentColor" opacity={0.35}
      stroke="currentColor" strokeWidth={1.2} />
  </svg>
)

const Paw = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <circle cx={0} cy={3} r={3.6} fill="currentColor" opacity={0.3} stroke="currentColor" strokeWidth={1.3} />
    <circle cx={-4.6} cy={-2.6} r={1.9} fill="currentColor" />
    <circle cx={-1.6} cy={-5} r={1.9} fill="currentColor" />
    <circle cx={1.6} cy={-5} r={1.9} fill="currentColor" />
    <circle cx={4.6} cy={-2.6} r={1.9} fill="currentColor" />
  </svg>
)

const Wand = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M-6 7 L4 -3" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    <path d="M5.5 -5.5 L6.5 -8.5 L7.5 -5.5 L10.5 -4.5 L7.5 -3.5 L6.5 -0.5 L5.5 -3.5 L2.5 -4.5 Z"
      fill="currentColor" transform="scale(.7) translate(1 -3)" />
  </svg>
)

const ChampSword = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M-6.5 6.5 L4 -4" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M4 -4 L6.5 -6.5" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />
    <path d="M-4.6 1.4 L-1.4 4.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

const Cross = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
  </svg>
)

const Check = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="-10 -10 20 20" aria-hidden>
    <path d="M-6 0.5 L-1.5 5 L6.5 -5" stroke="currentColor" strokeWidth={2.6} fill="none"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const GLYPH: Record<string, (p: { s?: number }) => ReactElement> = {
  base: Swords, defensa: Shield, desembarco: Anchor, patria: Banner,
  etéreos: Spark, huargo: Paw, poderes: Wand, campeón: ChampSword, dado: Die, monedas: Coin,
}

/* ------------------------------------------------------------ the card */

interface Props {
  battle: BattleAnim
  state: GameState
  /** pause mode: bots wait for the player to press continue */
  waiting: boolean
  onContinue: () => void
  onClose: () => void
}

export function NarrationCard({ battle, state, waiting, onContinue, onClose }: Props) {
  const reg = REGION_BY_ID[battle.regionId]
  if (!reg) return null
  const attacker = state.players[battle.attackerPid]
  const st = state.regions[battle.regionId]
  const color = PLAYER_COLORS[battle.attackerPid]
  const won = !!battle.attackerUid && st.owner === battle.attackerUid
  const failed = !won && state.turn.assaultFailed
  const rolling = battle.useDie && !won && !failed && state.turn.diceLast == null

  const chips: { g: string; label: string; v?: number }[] = []
  if (battle.champion) {
    chips.push({ g: 'campeón', label: 'Carga del Campeón' })
  } else {
    for (const [label, v] of battle.parts) {
      chips.push({ g: label === 'defensa' ? 'defensa' : label, label, v })
    }
    chips.push({ g: 'base', label: 'total', v: battle.total })
  }

  return (
    <div className="narration" role="status">
      <div className="narrCard" style={{ borderColor: color }}>
        <button className="narrClose" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="narrHead">
          <span className="narrEmblem" style={{ background: color }} aria-hidden>
            {(attacker?.name ?? '?').slice(0, 1)}
          </span>
          <span className="narrTitle">
            <strong style={{ color }}>{attacker?.name}</strong>
            <span className="narrArrow">⚔→</span>
            <strong>{reg.name}</strong>
          </span>
          <span className="narrTerrain" title={reg.mountain ? 'región con montaña (+1 defensa)' : undefined}>
            {reg.mountain ? '⛰' : ''}{reg.coastal ? '⚓' : ''}
          </span>
        </div>
        <div className="narrSub">
          {reg.terrain === 'fields' ? 'Llanura' : reg.terrain === 'forest' ? 'Bosque' : reg.terrain === 'hills' ? 'Colinas'
            : reg.terrain === 'mountains' ? 'Montañas' : reg.terrain === 'swamp' ? 'Pantano' : 'Yermo'}
          {reg.mountain && ' · con montaña'}
        </div>

        <div className="narrChips">
          {chips.map((c, i) => {
            const G = GLYPH[c.g] ?? Wand
            return (
              <span key={i} className={`chip${c.v !== undefined ? (c.v < 0 ? ' neg' : c.g === 'total' ? ' tot' : '') : ''}`}>
                <G s={15} />
                <em>{c.label}</em>
                {c.v !== undefined && <strong>{c.v < 0 ? c.v : c.v}</strong>}
              </span>
            )
          })}
          {battle.useDie && state.turn.diceLast != null && (
            <span className="chip"><Die n={state.turn.diceLast} s={15} /><em>dado</em><strong>{state.turn.diceLast}</strong></span>
          )}
        </div>

        <div className={`narrResult ${won ? 'win' : failed ? 'fail' : 'wait'}`}>
          {won && <><Check s={17} /><span>¡Conquistada!</span></>}
          {failed && <><Cross s={17} /><span>Asalto fallido: se acaban sus conquistas</span></>}
          {rolling && <><Die n={0} s={17} /><span>Lee el desenlace en la crónica…</span></>}
          {!won && !failed && !rolling && <><Swords s={17} /><span>El asalto continúa…</span></>}
        </div>

        {waiting && (
          <button className="narrContinue" onClick={onContinue}>▶ Continuar</button>
        )}
      </div>
    </div>
  )
}
