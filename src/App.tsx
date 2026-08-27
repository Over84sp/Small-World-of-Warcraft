import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOARDS, REGION_BY_ID, autoRedeploy, beginTurn, canDeclineNow, comboTokens, conquer,
  conquestCost, createGame, defenseOf, endTurn, factionLabel, goIntoDecline, placeMarker,
  placeToken, regionsOf, scoreFor, selectCombo, startRedeploy,
} from './game/engine'
import { RACE_BY_ID, POWER_BY_ID } from './game/abilities'
import type { GameState } from './game/types'
import { MapView } from './ui/MapView'
import { Setup, type SetupResult } from './ui/Setup'
import { Tutorial } from './ui/Tutorial'
import { PLAYER_COLORS, TERRAIN_LABEL } from './ui/theme'
import { useIsMobile, useIsTouch } from './ui/useMediaQuery'
import { chooseAction, applyBotAction } from './ai/bot'
import './App.css'

type Screen = 'setup' | 'game' | 'tutorial'

export default function App() {
  const isMobile = useIsMobile()
  const isTouch = useIsTouch()
  const [screen, setScreen] = useState<Screen>('setup')
  const [state, setState] = useState<GameState | null>(null)
  const [history, setHistory] = useState<GameState[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [markerMode, setMarkerMode] = useState(false)
  const [rules, setRules] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [confirmMode, setConfirmMode] = useState(isTouch)
  const botTimer = useRef<number | null>(null)
  // mirror of `state` so snapshots happen outside the setState updater
  // (StrictMode invokes updaters twice and would duplicate history entries)
  const stateRef = useRef<GameState | null>(null)
  stateRef.current = state

  useEffect(() => setConfirmMode(isTouch), [isTouch])

  /** `undoable` snapshots the state so the player can take the move back */
  const act = useCallback(
    (fn: (s: GameState) => void, undoable = false) => {
      if (undoable && stateRef.current) {
        const snap = stateRef.current
        setHistory((h) => [...h.slice(-19), snap])
      }
      setState((prev) => {
        if (!prev) return prev
        const next = structuredClone(prev) as GameState
        fn(next)
        return next
      })
    },
    [],
  )

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h
      setState(h[h.length - 1])
      setSelected(null)
      setMarkerMode(false)
      return h.slice(0, -1)
    })
  }

  const clearTurnState = () => {
    setHistory([])
    setSelected(null)
    setMarkerMode(false)
  }

  const start = (r: SetupResult) => {
    const s = createGame(r.players, r.seed, r.boardId)
    beginTurn(s)
    setState(s)
    setScreen('game')
    clearTurnState()
  }

  const player = state?.players[state.current]
  const isBotTurn = !!player?.isBot && state?.phase !== 'gameover'

  // ---- bot driver -------------------------------------------------------
  useEffect(() => {
    if (!state || !isBotTurn || screen !== 'game') return
    if (history.length) setHistory([])
    botTimer.current = window.setTimeout(() => {
      act((s) => {
        applyBotAction(s, chooseAction(s))
      })
    }, 650)
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current)
    }
  }, [state, isBotTurn, act, screen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  // Esc cancels the current selection / mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null)
        setMarkerMode(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (screen === 'tutorial') return <Tutorial onExit={() => setScreen('setup')} />
  if (!state || !player || screen === 'setup') {
    return <Setup onStart={start} onTutorial={() => setScreen('tutorial')} />
  }

  const activeFaction = player.activeUid ? state.factions[player.activeUid] : null
  const declineFaction = player.declineUid ? state.factions[player.declineUid] : null
  const owned = activeFaction ? regionsOf(state, activeFaction.uid) : []
  const selInfo = selected ? conquestCost(state, selected) : null
  const selRegion = selected ? REGION_BY_ID[selected] : null
  const maxDice = 1 + (activeFaction?.powerId === 'berserk' ? 1 : 0)
  const canAffordSel = !!activeFaction && !!selInfo?.reachable && selInfo.cost <= activeFaction.hand
  const canRollDie =
    !!activeFaction && state.phase === 'conquer' && state.turn.diceUsed < maxDice &&
    activeFaction.hand >= 1 && !!selInfo?.reachable && selInfo.cost > activeFaction.hand

  const doConquer = (id: string) => {
    act((s) => {
      const res = conquer(s, id, false)
      if (!res.ok) setFlash(res.message)
    }, true)
    setSelected(null)
  }

  const onRegion = (id: string) => {
    if (isBotTurn) return
    if (markerMode) {
      act((s) => placeMarker(s, id), true)
      setMarkerMode(false)
      return
    }
    if (state.phase === 'redeploy') {
      act((s) => placeToken(s, id, 1), true)
      return
    }
    // tapping the already-selected region confirms it
    if (state.phase === 'conquer' && activeFaction) {
      const info = conquestCost(state, id)
      const affordable = info.reachable && info.cost <= activeFaction.hand
      if (affordable && (!confirmMode || selected === id)) {
        doConquer(id)
        return
      }
    }
    setSelected(id)
  }

  const doDie = () => {
    if (!selected) return
    act((s) => {
      const res = conquer(s, selected, true)
      setFlash(res.rolled != null ? `🎲 Dado: ${res.rolled} — ${res.message}` : res.message)
    }, true)
  }

  const finishTurn = () => {
    act((s) => endTurn(s))
    clearTurnState()
  }

  const preview = scoreFor(state, player.id)

  /* --------------------------------------------------------------- panel */
  const panelContent =
    state.phase === 'gameover' ? (
      <section className="card victory">
        <h2>Fin de la partida</h2>
        <ol>
          {[...state.players].sort((a, b) => b.coins - a.coins).map((p) => (
            <li key={p.id}><i style={{ background: PLAYER_COLORS[p.id] }} />{p.name}<strong>{p.coins}</strong></li>
          ))}
        </ol>
        <button className="primary" onClick={() => setScreen('setup')}>Jugar otra vez</button>
      </section>
    ) : (
      <>
        <section className="card turn" style={{ borderColor: PLAYER_COLORS[player.id] }}>
          <h2>
            <i style={{ background: PLAYER_COLORS[player.id] }} />
            {player.name} {player.isBot && <em>IA</em>}
          </h2>
          {activeFaction ? (
            <div className="faction">
              <div className="ftitle">{factionLabel(activeFaction)}</div>
              <div className="fstats">
                <span>En mano <strong>{activeFaction.hand}</strong></span>
                <span>Regiones <strong>{owned.length}</strong></span>
                {activeFaction.markers > 0 && <span>Marcadores <strong>{activeFaction.markers}</strong></span>}
              </div>
              <p className="ftext">▸ {RACE_BY_ID[activeFaction.raceId]?.text}</p>
              <p className="ftext">▸ {POWER_BY_ID[activeFaction.powerId]?.text}</p>
            </div>
          ) : (
            <p className="muted">Sin raza activa: elige una combinación de la bandeja.</p>
          )}
          {declineFaction && (
            <div className="faction decline">
              <div className="ftitle">{factionLabel(declineFaction)} · en declive</div>
              <div className="fstats"><span>Regiones <strong>{regionsOf(state, declineFaction.uid).length}</strong></span></div>
            </div>
          )}
          <div className="preview">Si acabas ahora: <strong>{preview.total}</strong> 🪙</div>
        </section>

        {state.phase === 'pick' && !isBotTurn && (
          <section className="card">
            <h3>Bandeja de razas</h3>
            <p className="hint">La primera es gratis. Bajar cuesta 1 moneda por combinación saltada.</p>
            <div className="tray">
              {state.tray.map((c, i) => {
                const race = RACE_BY_ID[c.raceId]
                const power = POWER_BY_ID[c.powerId]
                const affordable = player.coins >= i
                return (
                  <button key={`${c.raceId}-${c.powerId}`} className={`combo${affordable ? '' : ' off'}`}
                    disabled={!affordable}
                    onClick={() => { act((s) => selectCombo(s, i), true); setSelected(null) }}>
                    <div className="chead">
                      <span className="cname" style={{ color: race?.color }}>{power?.name} {race?.name}</span>
                      <span className="ctok">{comboTokens(c)}</span>
                    </div>
                    <div className="cbody"><em>{race?.text}</em><em>{power?.text}</em></div>
                    <div className="cfoot">
                      <span>{i === 0 ? 'gratis' : `${i} moneda${i > 1 ? 's' : ''}`}</span>
                      {c.bonusCoins > 0 && <span className="bonus">+{c.bonusCoins} 🪙</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {state.phase === 'conquer' && activeFaction && !isBotTurn && (
          <section className="card">
            <h3>Conquista</h3>
            {selRegion && selInfo ? (
              <div className="selinfo">
                <div className="sname">
                  {selRegion.name}
                  <button className="x" onClick={() => setSelected(null)} aria-label="Quitar selección">✕</button>
                </div>
                <div className="smeta">
                  {TERRAIN_LABEL[selRegion.terrain]}
                  {selRegion.mountain && ' · ⛰ +1'}
                  {selRegion.coastal && ' · ⚓'}
                  {selRegion.landmark && ` · ★ ${selRegion.landmark}`}
                </div>
                <div className="smeta">Defensa: <strong>{defenseOf(state, selRegion.id)}</strong></div>
                {selInfo.reachable ? (
                  <>
                    <div className="scost">Coste: <strong>{selInfo.cost}</strong> fichas {selInfo.viaSea && '· desembarco'}</div>
                    {canAffordSel && (
                      <div className="confirmrow">
                        <button className="primary" onClick={() => doConquer(selRegion.id)}>⚔ Conquistar</button>
                        <button onClick={() => setSelected(null)}>Cancelar</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="sbad">{selInfo.reason}</div>
                )}
              </div>
            ) : (
              <p className="hint">
                {confirmMode
                  ? 'Toca una región marcada para verla, y otra vez para conquistarla.'
                  : 'Clic en una región marcada para conquistarla. El círculo amarillo es el coste.'}
              </p>
            )}
            <div className="actions">
              <button className="primary" disabled={!canRollDie} onClick={doDie}>
                🎲 Dado de refuerzo {state.turn.diceUsed > 0 && `(${state.turn.diceUsed}/${maxDice})`}
              </button>
              {activeFaction.markers > 0 && (
                <button className={markerMode ? 'primary' : ''} onClick={() => setMarkerMode((v) => !v)}>
                  {markerMode ? '✕ Cancelar colocación' : activeFaction.powerId === 'heroic' ? '🗡 Colocar héroe' : '🛡 Colocar fortaleza'}
                </button>
              )}
              <button disabled={!canDeclineNow(state)} onClick={() => { act((s) => { goIntoDecline(s); endTurn(s) }, true); clearTurnState() }}>
                Entrar en declive
              </button>
              <button className="primary" onClick={() => act((s) => startRedeploy(s), true)}>
                Terminar conquistas →
              </button>
            </div>
            {state.turn.diceLast != null && <div className="dieresult">Último dado: <strong>{state.turn.diceLast}</strong></div>}
          </section>
        )}

        {state.phase === 'redeploy' && activeFaction && !isBotTurn && (
          <section className="card">
            <h3>Redespliegue</h3>
            <p className="hint">Reparte las <strong>{activeFaction.hand}</strong> fichas restantes. Clic en el mapa para añadir.</p>
            <div className="deploylist">
              {owned.map((r) => (
                <div key={r.id} className="deployrow">
                  <span>{r.name}</span>
                  <button onClick={() => act((s) => placeToken(s, r.id, -1), true)} disabled={state.regions[r.id].tokens <= 1}>−</button>
                  <strong>{state.regions[r.id].tokens}</strong>
                  <button onClick={() => act((s) => placeToken(s, r.id, 1), true)} disabled={activeFaction.hand <= 0}>+</button>
                </div>
              ))}
            </div>
            <div className="actions">
              <button onClick={() => act((s) => autoRedeploy(s), true)}>Repartir automáticamente</button>
              <button className="primary" onClick={finishTurn}>Fin del turno</button>
            </div>
          </section>
        )}

        <section className="card log">
          <h3>Crónica de Azeroth</h3>
          <ul>
            {state.log.slice(0, 30).map((l, i) => (
              <li key={i}>
                <i style={{ background: l.playerId >= 0 ? PLAYER_COLORS[l.playerId] : '#666' }} />
                <span>{l.playerId >= 0 ? `${state.players[l.playerId].name} ` : ''}{l.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </>
    )

  return (
    <div className={`app${isMobile ? ' mobile' : ''}`}>
      <header className="topbar">
        <div className="brand">Small World <span>of Azeroth</span></div>
        <div className="round">
          <strong>{Math.min(state.round, state.maxRounds)}</strong>/{state.maxRounds}
          {!isMobile && <em>{BOARDS.find((b) => b.id === state.boardId)?.name}</em>}
        </div>
        <div className="scores">
          {state.players.map((p, i) => (
            <div key={p.id} className={`score${i === state.current ? ' on' : ''}`}>
              <i style={{ background: PLAYER_COLORS[i] }} />
              {!isMobile && <span>{p.name}</span>}
              <strong>{p.coins}</strong>
            </div>
          ))}
        </div>
        <button className="ghost undo" onClick={undo} disabled={!history.length || isBotTurn} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="ghost" onClick={() => setRules(true)}>{isMobile ? '?' : 'Reglas'}</button>
        <button className="ghost" onClick={() => setScreen('setup')}>{isMobile ? '⏻' : 'Nueva'}</button>
      </header>

      <main className="board">
        <MapView
          state={state}
          selected={selected}
          onSelect={onRegion}
          highlightTargets={state.phase === 'conquer' && !isBotTurn}
          markerMode={markerMode}
          compact={isMobile}
        />
        {flash && <div className="flash">{flash}</div>}
        {isBotTurn && <div className="thinking">{player.name} está pensando…</div>}
        {markerMode && <div className="modehint">Elige una región tuya · <button onClick={() => setMarkerMode(false)}>Cancelar</button></div>}
      </main>

      {isMobile ? (
        <div className={`sheet${sheetOpen ? ' open' : ''}`}>
          <button className="grab" onClick={() => setSheetOpen((v) => !v)}>
            <i />
            <span>
              {sheetOpen ? 'Ocultar panel' : `${player.name} · ${state.phase === 'pick' ? 'elegir raza' : state.phase === 'conquer' ? `${activeFaction?.hand ?? 0} fichas` : 'redesplegar'}`}
            </span>
          </button>
          <div className="sheetinner">{panelContent}</div>
        </div>
      ) : (
        <aside className="panel">{panelContent}</aside>
      )}

      {rules && (
        <div className="modal" onClick={() => setRules(false)}>
          <div className="modalbox" onClick={(e) => e.stopPropagation()}>
            <h2>Cómo se juega</h2>
            <ol>
              <li><strong>Elige raza + poder</strong> de la bandeja. La primera es gratis; cada posición más abajo cuesta 1 moneda por combinación que saltas.</li>
              <li><strong>Conquista.</strong> Al empezar el turno recoges tus fichas dejando 1 en cada región. Conquistar cuesta <em>2 + fichas defensoras + 1 por montaña + fortalezas</em>. La primera conquista de una raza debe hacerse desde el mar (⚓).</li>
              <li><strong>Dado de refuerzo.</strong> Una vez por turno, si te faltan fichas (caras 0,0,0,1,2,3). Si aun así no llegas, el asalto fracasa.</li>
              <li><strong>Redespliegue.</strong> Reparte las fichas sobrantes entre tus regiones.</li>
              <li><strong>Puntuación.</strong> 1 moneda por región ocupada más las bonificaciones.</li>
              <li><strong>Declive.</strong> Conserva 1 ficha por región y sigue puntuando; tu raza en declive anterior desaparece.</li>
            </ol>
            <h3>Controles</h3>
            <ul className="legend">
              <li>🔍 Rueda del ratón o pellizco para <b>zoom</b>; arrastra para mover el mapa</li>
              <li>↶ <b>Deshacer</b> en la barra superior (o Ctrl+Z) revierte tu última acción del turno</li>
              <li>⎋ <b>Esc</b> cancela la selección o el modo de colocar marcadores</li>
              <li>👆 En móvil: toca una región para verla, y otra vez para confirmar</li>
            </ul>
            <label className="switch">
              <input type="checkbox" checked={confirmMode} onChange={(e) => setConfirmMode(e.target.checked)} />
              Pedir confirmación antes de conquistar
            </label>
            <p className="muted">Proyecto de fans inspirado en Small World of Warcraft (Days of Wonder / Blizzard). Mapa y arte redibujados desde cero.</p>
            <button className="primary" onClick={() => setRules(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
