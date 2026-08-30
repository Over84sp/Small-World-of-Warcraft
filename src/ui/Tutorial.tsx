import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  autoRedeploy, conquer, conquestCost, createGame, defenseOf, factionLabel,
  goIntoDecline, placeToken, regionsOf, scoreFor, selectCombo, startRedeploy,
} from '../game/engine'
import { RACE_BY_ID, POWER_BY_ID } from '../game/abilities'
import type { GameState } from '../game/types'
import { MapView } from './MapView'
import { FactionIcon, LegendaryIcon } from './mapArt'
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
  /** shown when the tutorial hands out or takes away tokens, so the maths never lies */
  note?: string
}

const HORDE = 'tut-horde'
/** deliberately generous so the whole scripted turn fits without silent top-ups */
const TUTORIAL_ARMY = 20

function stageFaction(s: GameState) {
  if (!s.factions[HORDE]) {
    s.factions[HORDE] = {
      uid: HORDE, playerId: 1, raceId: 'orcs', powerId: 'berserk',
      inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0,
    }
    s.players[1].activeUid = HORDE
  }
}

/** absolute assignment so re-running a step never doubles anything */
function setRegion(s: GameState, id: string, owner: string | null, tokens: number) {
  s.regions[id] = { owner, tokens, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false }
}

const Cost = ({ parts, total }: { parts: [string, number][]; total: number }) => (
  <div className="costcalc">
    {parts.map(([label, n], i) => (
      <span key={label} className={`cpart${n < 0 ? ' minus' : ''}`}>
        {i > 0 && <b>{n < 0 ? '−' : '+'}</b>}
        <em>{Math.abs(n)}</em>
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
          <li><span className="lg" style={{ background: '#c2ad6c' }} /><b>★ Lugar legendario / 🔮 Artefacto</b> — bonus especial al conquistarlo (abajo a la derecha)</li>
          <li><span className="lg" style={{ background: '#2f3a44' }} /><b>Círculo gris</b> — los Múrlocs nativos defienden la región</li>
          <li><span className="lg" style={{ background: '#2a2f3a' }} /><b>❓ Boca abajo</b> — lugar sin revelar, ¡conquístalo para ver qué es!</li>
        </ul>
        <p>Los círculos de colores son fichas: el número es <strong>cuántas hay</strong>.</p>
      </>
    ),
    setup: (s) => {
      setRegion(s, 'sa7', 'lost-tribe', 1)
      setRegion(s, 'sa3', 'lost-tribe', 1)
    },
    spotlight: () => ['sa1', 'sa6', 'sa7', 'sa2'],
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
      s.tray[1] = { raceId: 'naga', powerId: 'pillaging', bonusCoins: 0 }
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
          cuesta <strong>1 más</strong> (el poder Navegante desembarca gratis):</p>
        <Cost parts={[['base', 2], ['desembarco', 1], ['defensores', 0]]} total={3} />
        <p className="doit">👉 Desembarca en <strong>Llanos de Mulgore</strong>. El círculo amarillo del mapa
          siempre te dice el coste exacto, ya calculado.</p>
      </>
    ),
    setup: (s) => {
      const f = s.factions[s.players[0].activeUid!]
      if (f && regionsOf(s, f.uid).length === 0) f.hand = TUTORIAL_ARMY
    },
    note: `Solo en el tutorial: te doy ${TUTORIAL_ARMY} fichas en vez de las 7 de tu combinación, para que puedas probarlo todo en un turno. A partir de aquí el contador baja de verdad con cada conquista.`,
    spotlight: () => ['sa6'],
    done: (s) => s.regions['sa6'].owner === s.players[0].activeUid,
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
        <p className="doit">👉 Avanza a <strong>Bosque de Elwynn</strong>.</p>
      </>
    ),
    spotlight: () => ['sa4'],
    done: (s) => s.regions['sa4'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'factions',
    title: 'Alianza contra Horda',
    body: (
      <>
        <p>Media Azeroth tiene bandera. Míralas en el mapa, abajo a la izquierda de cada región:</p>
        <div className="factlegend">
          <span className="fl alliance"><FactionIcon side="alliance" size={22} /> Alianza</span>
          <span className="fl horde"><FactionIcon side="horde" size={22} /> Horda</span>
          <span className="fl none">sin emblema = tierra de nadie</span>
        </div>
        <p>Tu raza también tiene bando. Los <strong>Humanos</strong> que has elegido son
          <strong> Alianza</strong>, así que:</p>
        <ul className="factrules">
          <li><b>🏳 Patria:</b> una región <em>de la Alianza</em> te cuesta <b>1 ficha menos</b>;
            los tuyos se te unen.</li>
          <li><b>⚔ Botín:</b> cada región <em>de la Horda</em> que tomes te da <b>+1 moneda</b>,
            pero solo el turno en que la conquistas.</li>
        </ul>
        <p><strong>Llanos de Mulgore</strong> y <strong>Bosque de Elwynn</strong>, que ya son tuyas, son de la Horda:
          llevas <strong>+2 monedas</strong> de botín apuntadas para el final del turno.</p>
        <p className="hint">Las razas neutrales (Múrlocs, Pandaren, Naga, Dragón Negro) no tienen
          patria, pero saquean a los dos bandos. Y los Orcos cobran el botín doble contra la Alianza.</p>
      </>
    ),
    spotlight: () => ['sa6', 'sa4', 'sa5', 'darkshore'],
    cta: 'Entendido',
    panel: 'none',
  },
  {
    id: 'legendary',
    title: 'Lugares legendarios y artefactos',
    body: (
      <>
        <p>Algunas regiones tienen un icono <strong>❓</strong> abajo a la derecha. Son <strong>losetas boca abajo</strong>: un Lugar Legendario ★ o un Artefacto 🔮 escondido.</p>
        <div className="factlegend">
          <span className="fl" style={{ background: '#2a2317', color: '#ffe9a8' }}><LegendaryIcon isArtifact={false} size={18} /> Lugar</span>
          <span className="fl" style={{ background: '#231a3a', color: '#d8c0ff' }}><LegendaryIcon isArtifact={true} size={18} /> Artefacto</span>
          <span className="fl none">❓ sin revelar</span>
        </div>
        <p>Al conquistar la región, se <strong>revela</strong> y te da su poder <em>inmediatamente</em> y cada turno mientras la controles.</p>
        <ul className="factrules">
          <li><b>★ Portal Oscuro:</b> +2 monedas</li>
          <li><b>★ Pozo de la Eternidad:</b> +3 monedas, siempre aparece en costa</li>
          <li><b>★ Campo de Batalla:</b> tu botín de facción cuenta doble</li>
          <li><b>🔮 Artefactos</b> se quedan en la región aunque la abandones o entres en declive. Si te la conquistan, cambian de dueño.</li>
        </ul>
        <p>En esta partida hay <strong>{'tantas losetas como jugadores'}</strong>, como en el juego de mesa. En el tutorial he puesto una en <strong>Campos de Westfall</strong>.</p>
        <p className="doit">👉 Conquista <strong>Campos de Westfall</strong> para revelar el Portal Oscuro.</p>
      </>
    ),
    setup: (s) => {
      // ensure Campos de Westfall has a face-down Portal Oscuro for the lesson
      if (!s.legendary) s.legendary = []
      const existing = s.legendary.find((t) => t.regionId === 'sa2')
      if (!existing) {
        s.legendary.push({ defId: 'dark_portal', regionId: 'sa2', revealed: false, isArtifact: false })
      } else {
        existing.defId = 'dark_portal'
        existing.revealed = false
        existing.isArtifact = false
      }
      // clean other tiles that could confuse this step
      // keep only this one face-down to make lesson clear
      s.legendary = s.legendary.filter((t) => t.regionId === 'sa2')
      // ensure nbarrens is empty for conquest
      if (s.regions['sa2'].owner === s.players[0].activeUid) {
        // already owned from previous rewind, reset
        setRegion(s, 'sa2', null, 0)
      }
    },
    spotlight: () => ['sa2', 'sa6', 'sa4'],
    done: (s) => {
      const tile = s.legendary.find((t) => t.regionId === 'sa2')
      return !!tile?.revealed && s.regions['sa2'].owner === s.players[0].activeUid
    },
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
        <p><strong>Cima del Vigía</strong> es montaña y está justo al lado de Bosque de Elwynn.</p>
        <p className="doit">👉 Conquista <strong>Cima del Vigía</strong>.</p>
      </>
    ),
    spotlight: () => ['sa1'],
    done: (s) => s.regions['sa1'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'tribe',
    title: 'Tribus perdidas',
    body: (
      <>
        <p>Algunas regiones empiezan ocupadas por los <strong>Múrlocs</strong>, los nativos del mapa.
          Cada ficha defensora suma <strong>+1 al coste</strong>.</p>
        <Cost parts={[['base', 2], ['Múrlocs', 1]]} total={3} />
        <p>La ficha de la tribu desaparece del juego para siempre.</p>
        <p className="doit">👉 Somete <strong>Colinas de Hillsbrad</strong>.</p>
      </>
    ),
    setup: (s) => {
      if (s.regions['sa3'].owner === 'lost-tribe' || s.regions['sa3'].owner === null) {
        setRegion(s, 'sa3', 'lost-tribe', 1)
      }
    },
    spotlight: () => ['sa3'],
    done: (s) => s.regions['sa3'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'combat',
    title: 'Atacar a un rival (y tu propia bandera)',
    body: (
      <>
        <p>La Horda se ha instalado en <strong>Montañas Crestagrana</strong> con <strong>2 fichas</strong>.
          Cuestan lo mismo que cualquier defensor: +1 cada una.</p>
        <p>Y aquí ves la <strong>patria</strong> en acción: Montañas Crestagrana es de la
          <strong> Alianza</strong>, igual que tus Humanos, así que descuentas <strong>1 ficha</strong>.
          Atacar a un rival dentro de tu propio bando sale más barato.</p>
        <Cost parts={[['base', 2], ['2 defensores', 2], ['tu bandera', -1]]} total={3} />
        <p>Al expulsarlo, el defensor <strong>pierde 1 ficha para siempre</strong> y recupera el resto,
          que volverá al tablero al final de tu turno. Por eso atacar desgasta a los dos.</p>
        <p className="doit">👉 Expulsa a la Horda de <strong>Montañas Crestagrana</strong>.</p>
      </>
    ),
    setup: (s) => {
      stageFaction(s)
      if (s.regions['sa5'].owner !== s.players[0].activeUid) setRegion(s, 'sa5', HORDE, 2)
    },
    spotlight: () => ['sa5'],
    done: (s) => s.regions['sa5'].owner === s.players[0].activeUid,
    panel: 'conquer',
  },
  {
    id: 'dice',
    title: 'El dado de refuerzo',
    body: (
      <>
        <p>Te quedan pocas fichas y <strong>Pantano de los Zánganos</strong> (montaña + Múrlocs) cuesta 4.
          Cuando no llegas, <strong>una vez por turno</strong> puedes jugártela al dado.</p>
        <div className="dieface">
          {[0, 0, 0, 1, 2, 3].map((n, i) => <span key={i}>{n}</span>)}
        </div>
        <p>Si <em>fichas + dado ≥ coste</em>, conquistas. Si no, el asalto fracasa y
          <strong> tu turno de conquistas termina</strong>. Es la última bala.</p>
        <p className="doit">👉 Selecciona <strong>Pantano de los Zánganos</strong> y lanza el dado.</p>
      </>
    ),
    setup: (s) => {
      const f = s.factions[s.players[0].activeUid!]
      if (f && s.turn.diceUsed === 0) f.hand = 3
      // sa7 debe ser montaña + tribu para costar 4
      setRegion(s, 'sa7', 'lost-tribe', 1)
    },
    note: 'Para esta lección te dejo a propósito con solo 3 fichas: así te falta justo lo necesario para tener que arriesgarte.',
    spotlight: () => ['sa7'],
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
        f.hand = Math.max(f.hand, 3)
        startRedeploy(s)
      }
    },
    note: 'Te dejo 3 fichas sin colocar para que practiques el reparto.',
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
        <p>Y ahí está el <strong>botín de facción</strong>: +1 por cada región de la Horda
          (Llanos de Mulgore y Bosque de Elwynn) que has tomado <em>este turno</em>. Solo se cobra el turno de la
          conquista, así que atacar al bando contrario premia el ataque, no la ocupación.</p>
        <p>Y el <strong>Portal Oscuro</strong> que acabas de revelar en Campos de Westfall: <strong>+2 monedas</strong> extra
          cada turno mientras lo controles. Los artefactos se quedan aunque entres en declive.</p>
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
        <p>Los símbolos ⛰ ⚓ ★ 🔮 ❓ y el número amarillo del coste están siempre en el mapa,
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
      'small_a',
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
      {cur.note && <p className="tutnote">🎓 {cur.note}</p>}

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
        <button className="primary" disabled={!selected || selected !== 'sa7'}
          onClick={() => act((s) => {
            const res = conquer(s, 'sa7', true)
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
