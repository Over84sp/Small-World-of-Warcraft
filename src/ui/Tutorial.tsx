import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  autoRedeploy, conquer, conquestCost, createGame, defenseOf, factionLabel,
  goIntoDecline, placeToken, regionsOf, scoreFor, selectCombo, startRedeploy,
} from '../game/engine'
import { RACE_BY_ID, POWER_BY_ID } from '../game/abilities'
import type { GameState } from '../game/types'
import { MapView } from './MapView'
import { PLAYER_COLORS } from './theme'
import { useIsMobile } from './useMediaQuery'

type PanelKind = 'none' | 'tray' | 'conquer' | 'dice' | 'redeploy' | 'score' | 'decline'

interface Step {
  id: string
  title: string
  body: React.ReactNode
  /** stage the board for this lesson — must be idempotent */
  setup?: (s: GameState) => void
  spotlight?: (s: GameState) => string[] | null
  /** auto-advance once the player has done the thing */
  done?: (s: GameState) => boolean
  cta?: string
  panel?: PanelKind
}

const HORDE = 'tut-horde'

function stageFaction(s: GameState) {
  if (!s.factions[HORDE]) {
    s.factions[HORDE] = {
      uid: HORDE, playerId: 1, raceId: 'orcs', powerId: 'berserk',
      inDecline: false, hand: 0, markers: 0,
    }
    s.players[1].activeUid = HORDE
  }
}

/** absolute assignment so re-running a step never doubles anything */
function setRegion(s: GameState, id: string, owner: string | null, tokens: number) {
  s.regions[id] = { owner, tokens, fortress: 0, hero: false }
}

const Cost = ({ parts, total }: { parts: [string, number][]; total: number }) => (
  <div className="costcalc">
    {parts.map(([label, n], i) => (
      <span key={label} className="cpart">
        {i > 0 && <b>+</b>}
        <em>{n}</em>
        <i>{label}</i>
      </span>
    ))}
    <span className="cpart eq"><b>=</b><em>{total}</em><i>fichas</i></span>
  </div>
)

export const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Bienvenido a Azeroth',
    body: (
      <>
        <p>Ganas quien <strong>más monedas</strong> tenga al final de la partida. Cada turno
          cobras <strong>1 moneda por región ocupada</strong>, así que se trata de ocupar mucho… y
          de saber retirarte a tiempo.</p>
        <p>Te voy a llevar paso a paso por una partida real. Puedes tocar el mapa, hacer zoom con
          dos dedos y arrastrar para moverte.</p>
      </>
    ),
    cta: 'Empezar',
    panel: 'none',
  },
  {
    id: 'board',
    title: 'Leer el mapa',
    body: (
      <>
        <p>Cada región tiene un <strong>terreno</strong> (color) y a veces símbolos que cambian las reglas:</p>
        <ul className="legend">
          <li><span className="lg" style={{ background: '#7f8288' }} /><b>⛰ Montaña</b> — cuesta 1 ficha más conquistarla</li>
          <li><span className="lg" style={{ background: '#456253' }} /><b>⚓ Costera</b> — se puede invadir desde el mar</li>
          <li><span className="lg" style={{ background: '#c2ad6c' }} /><b>★ Lugar legendario</b> — algunas razas puntúan extra aquí</li>
          <li><span className="lg" style={{ background: '#2f3a44' }} /><b>Círculo gris</b> — una tribu perdida defiende la región</li>
        </ul>
        <p>Los círculos de colores son fichas: el número es <strong>cuántas hay</strong>.</p>
      </>
    ),
    setup: (s) => {
      setRegion(s, 'winterspring', 'lost-tribe', 1)
      setRegion(s, 'felwood', 'lost-tribe', 1)
    },
    spotlight: () => ['hyjal', 'durotar', 'winterspring', 'nbarrens'],
    cta: 'Entendido',
    panel: 'none',
  },
  {
    id: 'pick',
    title: 'Elige raza y poder',
    body: (
      <>
        <p>Cada partida empareja al azar <strong>razas</strong> con <strong>poderes</strong>. El número
          de la derecha son las <strong>fichas</strong> que recibes: tu ejército.</p>
        <p>La primera combinación es gratis. Bajar cuesta <strong>1 moneda por cada una que saltas</strong>,
          y esas monedas se quedan encima de las descartadas como cebo para el siguiente.</p>
        <p className="doit">👉 Coge los <strong>Humanos Mercaderes</strong>.</p>
      </>
    ),
    setup: (s) => {
      s.tray[0] = { raceId: 'humans', powerId: 'merchant', bonusCoins: 0 }
      s.tray[1] = { raceId: 'murlocs', powerId: 'pillaging', bonusCoins: 0 }
      s.tray[2] = { raceId: 'dwarves', powerId: 'flying', bonusCoins: 0 }
      s.phase = 'pick'
    },
    done: (s) => !!s.players[0].activeUid,
    panel: 'tray',
  },
  {
    id: 'firstconquest',
    title: 'Tu primera conquista llega por mar',
    body: (
      <>
        <p>La <strong>primera región</strong> de una raza nueva debe conquistarse
          desde el mar: solo valen las que tienen <strong>⚓</strong>.</p>
        <p>Toda conquista parte de <strong>2 fichas</strong>, y llegar por mar
          cuesta <strong>1 más</strong> (los Múrlocs y el poder Navegante desembarcan gratis):</p>
        <Cost parts={[['base', 2], ['desembarco', 1], ['defensores', 0]]} total={3} />
        <p className="doit">👉 Desembarca en <strong>Durotar</strong>. El círculo amarillo del mapa
          siempre te dice el coste exacto, ya calculado.</p>
      </>
    ),
    setup: (s) => {
      const f = s.factions[s.players[0].activeUid!]
      if (f && regionsOf(s, f.uid).length === 0) f.hand = 9
    },
    spotlight: () => ['durotar'],
    done: (s) => s.regions['durotar'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'adjacency',
    title: 'A partir de ahí, por tierra',
    body: (
      <>
        <p>Ya con un pie en el continente puedes extenderte a cualquier región
          <strong> adyacente</strong> a las tuyas (o seguir desembarcando en costas, pagando 1 ficha extra).</p>
        <p>Fíjate en que al conquistar <strong>dejas las fichas que has gastado</strong> en la región.
          Conquistar barato te deja regiones mal defendidas.</p>
        <p className="doit">👉 Avanza a <strong>Azshara</strong>.</p>
      </>
    ),
    spotlight: () => ['azshara'],
    done: (s) => s.regions['azshara'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'mountain',
    title: 'Las montañas se defienden solas',
    body: (
      <>
        <p>Una región de <strong>montaña ⛰</strong> siempre cuesta <strong>1 ficha más</strong>,
          esté vacía o no. A cambio, cuando sea tuya, también le costará más al rival quitártela.</p>
        <Cost parts={[['base', 2], ['montaña', 1], ['defensores', 0]]} total={3} />
        <p><strong>Monte Hyjal</strong> además tiene <strong>★</strong>: un lugar legendario.</p>
        <p className="doit">👉 Conquista <strong>Monte Hyjal</strong>.</p>
      </>
    ),
    spotlight: () => ['hyjal'],
    done: (s) => s.regions['hyjal'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'tribe',
    title: 'Tribus perdidas',
    body: (
      <>
        <p>Algunas regiones empiezan ocupadas por una <strong>tribu perdida</strong> neutral.
          Cada ficha defensora suma <strong>+1 al coste</strong>.</p>
        <Cost parts={[['base', 2], ['tribu perdida', 1]]} total={3} />
        <p>La ficha de la tribu desaparece del juego para siempre.</p>
        <p className="doit">👉 Somete <strong>Felwood</strong>.</p>
      </>
    ),
    setup: (s) => {
      if (s.regions['felwood'].owner === 'lost-tribe' || s.regions['felwood'].owner === null) {
        setRegion(s, 'felwood', 'lost-tribe', 1)
      }
      const f = s.factions[s.players[0].activeUid!]
      if (f && f.hand < 4) f.hand = 4
    },
    spotlight: () => ['felwood'],
    done: (s) => s.regions['felwood'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'combat',
    title: 'Atacar a un rival',
    body: (
      <>
        <p>La Horda se ha instalado en <strong>Ashenvale</strong> con <strong>2 fichas</strong>.
          Cuestan lo mismo que cualquier defensor: +1 cada una.</p>
        <Cost parts={[['base', 2], ['2 defensores', 2]]} total={4} />
        <p>Al expulsarlo, el defensor <strong>pierde 1 ficha para siempre</strong> y recupera el resto,
          que volverá al tablero al final de tu turno. Por eso atacar desgasta a los dos.</p>
        <p className="doit">👉 Expulsa a la Horda de <strong>Ashenvale</strong>.</p>
      </>
    ),
    setup: (s) => {
      stageFaction(s)
      if (s.regions['ashenvale'].owner !== s.players[0].activeUid) setRegion(s, 'ashenvale', HORDE, 2)
      const f = s.factions[s.players[0].activeUid!]
      if (f && f.hand < 5) f.hand = 5
    },
    spotlight: () => ['ashenvale'],
    done: (s) => s.regions['ashenvale'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'dice',
    title: 'El dado de refuerzo',
    body: (
      <>
        <p>Te quedan pocas fichas y <strong>Winterspring</strong> (montaña + tribu perdida) cuesta 4.
          Cuando no llegas, <strong>una vez por turno</strong> puedes jugártela al dado.</p>
        <div className="dieface">
          {[0, 0, 0, 1, 2, 3].map((n, i) => <span key={i}>{n}</span>)}
        </div>
        <p>Si <em>fichas + dado ≥ coste</em>, conquistas. Si no, el asalto fracasa y
          <strong> tu turno de conquistas termina</strong>. Es la última bala.</p>
        <p className="doit">👉 Selecciona <strong>Winterspring</strong> y lanza el dado.</p>
      </>
    ),
    setup: (s) => {
      const f = s.factions[s.players[0].activeUid!]
      if (f && s.turn.diceUsed === 0) f.hand = 3
      if (s.regions['winterspring'].owner === null) setRegion(s, 'winterspring', 'lost-tribe', 1)
    },
    spotlight: () => ['winterspring'],
    done: (s) => s.turn.diceUsed > 0,
    panel: 'dice',
  },
  {
    id: 'redeploy',
    title: 'Redespliegue: repartir el ejército',
    body: (
      <>
        <p>Terminadas las conquistas, repartes <strong>todas las fichas que te sobran</strong>
          entre tus regiones. Mínimo 1 por región.</p>
        <p>Aquí decides tu defensa: amontonar fichas en la frontera encarece que te ataquen,
          pero dejar regiones a 1 ficha las convierte en caramelos.</p>
        <p className="doit">👉 Reparte las fichas y pulsa <strong>Fin del turno</strong>.</p>
      </>
    ),
    setup: (s) => {
      const f = s.factions[s.players[0].activeUid!]
      if (f && s.phase === 'conquer') {
        if (f.hand < 3) f.hand = 3
        startRedeploy(s)
      }
    },
    done: (s) => s.phase === 'redeploy' && s.factions[s.players[0].activeUid!]?.hand === 0,
    panel: 'redeploy',
  },
  {
    id: 'score',
    title: 'Cobrar',
    body: (
      <>
        <p>Al acabar el turno cobras <strong>1 moneda por región</strong> que ocupes, sumando
          las de tu raza activa y las de tu raza en declive.</p>
        <p>Encima se aplican los bonos de tu combinación: <strong>Mercader</strong> da +1 por región,
          o sea que aquí cobras el doble. Los <strong>Humanos</strong> darían +1 por llanura,
          pero de momento no has ocupado ninguna.</p>
        <p>Por eso la combinación importa tanto: dos jugadores con las mismas regiones
          pueden cobrar muy distinto.</p>
      </>
    ),
    cta: 'Ver mi puntuación',
    panel: 'score',
  },
  {
    id: 'decline',
    title: 'El declive: la decisión clave',
    body: (
      <>
        <p>Tu raza se desgasta: cada conquista deja fichas repartidas y cada vez puedes menos.
          Cuando ya no crezcas, mándala al <strong>declive</strong>.</p>
        <p>Al declinar conservas <strong>1 ficha por región</strong> y sigues cobrando por ellas,
          pero no vuelves a atacar con esa raza. Al turno siguiente eliges una raza nueva
          y pasas a cobrar por <strong>las dos a la vez</strong>.</p>
        <p className="warn">⚠️ Solo puedes tener una raza en declive: al declinar la segunda,
          la primera desaparece del mapa.</p>
        <p className="doit">👉 Manda a los Humanos al declive.</p>
      </>
    ),
    done: (s) => !!s.players[0].declineUid,
    panel: 'decline',
  },
  {
    id: 'end',
    title: 'Ya sabes jugar',
    body: (
      <>
        <p>Eso es todo el juego. El resto es criterio:</p>
        <ul className="legend">
          <li>🎯 <b>Expandirse</b> vale monedas ya, pero deja fichas desperdigadas</li>
          <li>🛡️ <b>Fronteras cortas</b> (islas, montañas) se defienden con menos fichas</li>
          <li>⏳ <b>Declinar pronto</b> es perder un turno de ataque a cambio de una raza fresca</li>
          <li>💰 <b>Las últimas rondas</b> valen tanto como las primeras: cuenta cuántas quedan</li>
        </ul>
        <p>Los símbolos ⛰ ⚓ ★ y el número amarillo del coste están siempre en el mapa,
          y el botón <strong>Reglas</strong> tiene el resumen a mano.</p>
      </>
    ),
    cta: 'Jugar de verdad',
    panel: 'none',
  },
]

export function Tutorial({ onExit }: { onExit: () => void }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [state, setState] = useState<GameState>(() => {
    const s = createGame(
      [{ name: 'Tú', isBot: false }, { name: 'Horda', isBot: true }],
      20260828,
      'kalimdor',
    )
    s.phase = 'pick'
    return s
  })

  // board state as it was when each step began, so "Atrás" really rewinds
  const snaps = useRef<Record<number, GameState>>({})
  // only auto-advance when the goal is met *during* the step, never on arrival
  const armed = useRef(true)
  const stateRef = useRef(state)
  stateRef.current = state

  const act = useCallback((fn: (s: GameState) => void) => {
    setState((prev) => {
      const next = structuredClone(prev) as GameState
      fn(next)
      return next
    })
  }, [])

  const enterStep = useCallback((i: number, back = false) => {
    const target = STEPS[i]
    let next: GameState
    if (back && snaps.current[i]) {
      // rewind: undo everything the player did during the steps we leave behind
      next = structuredClone(snaps.current[i])
    } else {
      next = structuredClone(stateRef.current)
      target.setup?.(next)
      snaps.current[i] = structuredClone(next)
    }
    armed.current = !(target.done?.(next) ?? false)
    stateRef.current = next
    setState(next)
    setStep(i)
    setSelected(null)
    setFlash(null)
    setSheetOpen(true)
  }, [])

  const cur = STEPS[step]

  // snapshot the opening position of step 0
  useEffect(() => { enterStep(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // auto-advance when the lesson's goal is met
  useEffect(() => {
    if (!armed.current) return
    if (cur.done?.(state)) {
      armed.current = false
      const t = setTimeout(() => enterStep(Math.min(step + 1, STEPS.length - 1)), 850)
      return () => clearTimeout(t)
    }
  }, [state, cur, step, enterStep])

  const goalMet = !!cur.done?.(state)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  const spotlight = useMemo(() => cur.spotlight?.(state) ?? null, [cur, state])
  const me = state.players[0]
  const faction = me.activeUid ? state.factions[me.activeUid] : null
  const owned = faction ? regionsOf(state, faction.uid) : []
  const selInfo = selected ? conquestCost(state, selected) : null

  const onRegion = (id: string) => {
    if (cur.panel === 'redeploy') {
      act((s) => placeToken(s, id, 1))
      return
    }
    setSelected(id)
    if ((cur.panel === 'conquer' || cur.panel === 'dice') && faction) {
      const info = conquestCost(state, id)
      if (spotlight && !spotlight.includes(id)) {
        setFlash('En este paso, toca la región que te indico ✋')
        return
      }
      if (info.reachable && info.cost <= faction.hand && cur.panel === 'conquer') {
        act((s) => {
          const res = conquer(s, id, false)
          if (!res.ok) setFlash(res.message)
        })
      }
    }
  }

  const score = scoreFor(state, 0)

  const panel = (
    <div className="tutbody">
      <div className="tutprogress">
        {STEPS.map((s, i) => (
          <span key={s.id} className={i === step ? 'on' : i < step ? 'done' : ''} />
        ))}
      </div>
      <h2>{cur.title}</h2>
      <div className="tuttext">{cur.body}</div>

      {cur.panel === 'tray' && (
        <div className="tray">
          {state.tray.slice(0, 3).map((c, i) => {
            const race = RACE_BY_ID[c.raceId]
            const power = POWER_BY_ID[c.powerId]
            return (
              <button key={i} className={`combo${i === 0 ? ' pulse' : ''}`} disabled={i !== 0}
                onClick={() => act((s) => selectCombo(s, i))}>
                <div className="chead">
                  <span className="cname" style={{ color: race?.color }}>{power?.name} {race?.name}</span>
                  <span className="ctok">{(race?.tokens ?? 0) + (power?.tokens ?? 0)}</span>
                </div>
                <div className="cbody"><em>{race?.text}</em><em>{power?.text}</em></div>
                <div className="cfoot"><span>{i === 0 ? 'gratis' : `${i} moneda${i > 1 ? 's' : ''}`}</span></div>
              </button>
            )
          })}
        </div>
      )}

      {(cur.panel === 'conquer' || cur.panel === 'dice') && faction && (
        <div className="tutstats">
          <span>En mano <strong>{faction.hand}</strong></span>
          <span>Regiones <strong>{owned.length}</strong></span>
          {selected && selInfo?.reachable && <span>Coste <strong>{selInfo.cost}</strong></span>}
        </div>
      )}

      {cur.panel === 'dice' && (
        <button className="primary" disabled={!selected || selected !== 'winterspring'}
          onClick={() => act((s) => {
            const res = conquer(s, 'winterspring', true)
            setFlash(res.rolled != null ? `🎲 Sale ${res.rolled} — ${res.ok ? '¡conquistada!' : 'asalto fallido'}` : res.message)
          })}>
          🎲 Lanzar el dado de refuerzo
        </button>
      )}

      {cur.panel === 'redeploy' && faction && (
        <>
          <div className="tutstats"><span>Por repartir <strong>{faction.hand}</strong></span></div>
          <div className="deploylist">
            {owned.map((r) => (
              <div key={r.id} className="deployrow">
                <span>{r.name}</span>
                <button onClick={() => act((s) => placeToken(s, r.id, -1))} disabled={state.regions[r.id].tokens <= 1}>−</button>
                <strong>{state.regions[r.id].tokens}</strong>
                <button onClick={() => act((s) => placeToken(s, r.id, 1))} disabled={faction.hand <= 0}>+</button>
              </div>
            ))}
          </div>
          <button className="primary" onClick={() => act((s) => autoRedeploy(s))} disabled={faction.hand === 0}>
            Repartir automáticamente
          </button>
        </>
      )}

      {cur.panel === 'score' && (
        <div className="scorebox">
          {score.detail.map((d, i) => <div key={i} className={d.startsWith('  ') ? 'sub' : ''}>{d}</div>)}
          <div className="total">Total del turno: <strong>{score.total} 🪙</strong></div>
        </div>
      )}

      {cur.panel === 'decline' && faction && (
        <button className="primary" onClick={() => act((s) => goIntoDecline(s))}>
          Mandar {factionLabel(faction)} al declive
        </button>
      )}

      <div className="tutnav">
        <button className="ghost" onClick={() => enterStep(Math.max(0, step - 1), true)} disabled={step === 0}>
          ← Atrás
        </button>
        {cur.cta ? (
          <button className="primary" onClick={() => (step === STEPS.length - 1 ? onExit() : enterStep(step + 1))}>
            {cur.cta}
          </button>
        ) : (
          <button className={goalMet ? 'primary' : 'ghost'}
            onClick={() => enterStep(Math.min(STEPS.length - 1, step + 1))}>
            {goalMet ? 'Siguiente →' : 'Saltar paso →'}
          </button>
        )}
        <button className="ghost quit" onClick={onExit}>Salir</button>
      </div>
    </div>
  )

  return (
    <div className={`tutorial${isMobile ? ' mobile' : ''}`}>
      <header className="topbar slim">
        <div className="brand">Tutorial <span>· Small World of Azeroth</span></div>
        <div className="round">Paso {step + 1} / {STEPS.length}</div>
        <button className="ghost" onClick={onExit}>Salir</button>
      </header>

      <main className="board">
        <MapView
          state={state}
          selected={selected}
          onSelect={onRegion}
          highlightTargets={cur.panel === 'conquer' || cur.panel === 'dice'}
          markerMode={false}
          spotlight={spotlight}
          compact={isMobile}
        />
        {flash && <div className="flash">{flash}</div>}
        {goalMet && armed.current === false && <div className="okflash">✔ ¡Hecho!</div>}
      </main>

      {isMobile ? (
        <div className={`sheet${sheetOpen ? ' open' : ''}`}>
          <button className="grab" onClick={() => setSheetOpen((v) => !v)} aria-label="Mostrar u ocultar">
            <i />
            <span>{sheetOpen ? 'Ocultar' : cur.title}</span>
          </button>
          <div className="sheetinner">{panel}</div>
        </div>
      ) : (
        <aside className="panel tutpanel">
          <i className="tutmark" style={{ background: PLAYER_COLORS[0] }} />
          {panel}
        </aside>
      )}
    </div>
  )
}

export { defenseOf }
