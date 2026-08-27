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
import { PLAYER_COLORS, TERRAIN_LABEL } from './ui/theme'
import { chooseAction, applyBotAction } from './ai/bot'
import './App.css'

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [markerMode, setMarkerMode] = useState(false)
  const [rules, setRules] = useState(false)
  const botTimer = useRef<number | null>(null)

  const act = useCallback((fn: (s: GameState) => void) => {
    setState((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev) as GameState
      fn(next)
      return next
    })
  }, [])

  const start = (r: SetupResult) => {
    const s = createGame(r.players, r.seed, r.boardId)
    beginTurn(s)
    setState(s)
    setSelected(null)
  }

  const player = state?.players[state.current]
  const isBotTurn = !!player?.isBot && state?.phase !== 'gameover'

  // ---- bot driver -------------------------------------------------------
  useEffect(() => {
    if (!state || !isBotTurn) return
    botTimer.current = window.setTimeout(() => {
      act((s) => {
        const action = chooseAction(s)
        applyBotAction(s, action)
      })
    }, 650)
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current)
    }
  }, [state, isBotTurn, act])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  if (!state || !player) return <Setup onStart={start} />

  const activeFaction = player.activeUid ? state.factions[player.activeUid] : null
  const declineFaction = player.declineUid ? state.factions[player.declineUid] : null
  const owned = activeFaction ? regionsOf(state, activeFaction.uid) : []
  const selInfo = selected ? conquestCost(state, selected) : null
  const selRegion = selected ? REGION_BY_ID[selected] : null
  const maxDice = 1 + (activeFaction?.powerId === 'berserk' ? 1 : 0)
  const canRollDie =
    !!activeFaction && state.phase === 'conquer' && state.turn.diceUsed < maxDice &&
    activeFaction.hand >= 1 && !!selInfo?.reachable && selInfo.cost > activeFaction.hand

  const onRegion = (id: string) => {
    if (isBotTurn) return
    if (markerMode) {
      act((s) => placeMarker(s, id))
      setMarkerMode(false)
      return
    }
    if (state.phase === 'redeploy') {
      act((s) => placeToken(s, id, 1))
      return
    }
    setSelected(id)
    if (state.phase === 'conquer' && activeFaction) {
      const info = conquestCost(state, id)
      if (info.reachable && info.cost <= activeFaction.hand) {
        act((s) => {
          const res = conquer(s, id, false)
          if (!res.ok) setFlash(res.message)
        })
      }
    }
  }

  const doDie = () => {
    if (!selected) return
    act((s) => {
      const res = conquer(s, selected, true)
      setFlash(res.rolled != null ? `Dado de refuerzo: ${res.rolled} — ${res.message}` : res.message)
    })
  }

  const preview = scoreFor(state, player.id)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Small World <span>of Azeroth</span></div>
        <div className="round">
          Ronda <strong>{Math.min(state.round, state.maxRounds)}</strong> / {state.maxRounds}
          <em>{BOARDS.find((b) => b.id === state.boardId)?.name}</em>
        </div>
        <div className="scores">
          {state.players.map((p, i) => (
            <div key={p.id} className={`score${i === state.current ? ' on' : ''}`}>
              <i style={{ background: PLAYER_COLORS[i] }} />
              <span>{p.name}</span>
              <strong>{p.coins}</strong>
            </div>
          ))}
        </div>
        <button className="ghost" onClick={() => setRules(true)}>Reglas</button>
        <button className="ghost" onClick={() => setState(null)}>Nueva</button>
      </header>

      <main className="board">
        <MapView
          state={state}
          selected={selected}
          onSelect={onRegion}
          highlightTargets={state.phase === 'conquer' && !isBotTurn}
          markerMode={markerMode}
        />
        {flash && <div className="flash">{flash}</div>}
        {isBotTurn && <div className="thinking">{player.name} está pensando…</div>}
      </main>

      <aside className="panel">
        {state.phase === 'gameover' ? (
          <section className="card victory">
            <h2>Fin de la partida</h2>
            <ol>
              {[...state.players].sort((a, b) => b.coins - a.coins).map((p) => (
                <li key={p.id}><i style={{ background: PLAYER_COLORS[p.id] }} />{p.name}<strong>{p.coins}</strong></li>
              ))}
            </ol>
            <button className="primary" onClick={() => setState(null)}>Jugar otra vez</button>
          </section>
        ) : (
          <>
            <section className="card turn" style={{ borderColor: PLAYER_COLORS[player.id] }}>
              <h2>
                <i style={{ background: PLAYER_COLORS[player.id] }} />
                Turno de {player.name} {player.isBot && <em>IA</em>}
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
              <div className="preview">Puntuación si acabas ahora: <strong>{preview.total}</strong></div>
            </section>

            {state.phase === 'pick' && (
              <section className="card">
                <h3>Bandeja de razas</h3>
                <p className="hint">Coger la combinación #{'n'} cuesta n-1 monedas, que se reparten entre las de arriba.</p>
                <div className="tray">
                  {state.tray.map((c, i) => {
                    const race = RACE_BY_ID[c.raceId]
                    const power = POWER_BY_ID[c.powerId]
                    const affordable = player.coins >= i && !isBotTurn
                    return (
                      <button key={`${c.raceId}-${c.powerId}`} className={`combo${affordable ? '' : ' off'}`}
                        disabled={!affordable}
                        onClick={() => { act((s) => selectCombo(s, i)); setSelected(null) }}>
                        <div className="chead">
                          <span className="cname" style={{ color: race?.color }}>{power?.name} {race?.name}</span>
                          <span className="ctok">{comboTokens(c)}</span>
                        </div>
                        <div className="cbody">
                          <em>{race?.text}</em>
                          <em>{power?.text}</em>
                        </div>
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
                    <div className="sname">{selRegion.name}</div>
                    <div className="smeta">
                      {TERRAIN_LABEL[selRegion.terrain]}
                      {selRegion.mountain && ' · ⛰ +1'}
                      {selRegion.coastal && ' · ⚓ costera'}
                      {selRegion.landmark && ` · ★ ${selRegion.landmark}`}
                    </div>
                    <div className="smeta">Defensa actual: <strong>{defenseOf(state, selRegion.id)}</strong></div>
                    {selInfo.reachable ? (
                      <div className="scost">Coste: <strong>{selInfo.cost}</strong> fichas {selInfo.viaSea && '(desembarco)'}</div>
                    ) : (
                      <div className="sbad">{selInfo.reason}</div>
                    )}
                  </div>
                ) : (
                  <p className="hint">Haz clic en una región marcada para conquistarla. El número en el círculo es el coste.</p>
                )}
                <div className="actions">
                  <button className="primary" disabled={!canRollDie} onClick={doDie}>
                    🎲 Dado de refuerzo {state.turn.diceUsed > 0 && `(${state.turn.diceUsed}/${maxDice})`}
                  </button>
                  {activeFaction.markers > 0 && (
                    <button className={markerMode ? 'primary' : ''} onClick={() => setMarkerMode((v) => !v)}>
                      {activeFaction.powerId === 'heroic' ? '🗡 Colocar héroe' : '🛡 Colocar fortaleza'}
                    </button>
                  )}
                  <button disabled={!canDeclineNow(state)} onClick={() => { act((s) => { goIntoDecline(s); endTurn(s) }); setSelected(null) }}>
                    Entrar en declive
                  </button>
                  <button className="primary" onClick={() => act((s) => startRedeploy(s))}>
                    Terminar conquistas →
                  </button>
                </div>
                {state.turn.diceLast != null && <div className="dieresult">Último dado: <strong>{state.turn.diceLast}</strong></div>}
              </section>
            )}

            {state.phase === 'redeploy' && activeFaction && !isBotTurn && (
              <section className="card">
                <h3>Redespliegue</h3>
                <p className="hint">
                  Reparte las <strong>{activeFaction.hand}</strong> fichas restantes entre tus regiones.
                  Clic en el mapa para añadir; clic aquí abajo para quitar.
                </p>
                <div className="deploylist">
                  {owned.map((r) => (
                    <div key={r.id} className="deployrow">
                      <span>{r.name}</span>
                      <button onClick={() => act((s) => placeToken(s, r.id, -1))} disabled={state.regions[r.id].tokens <= 1}>−</button>
                      <strong>{state.regions[r.id].tokens}</strong>
                      <button onClick={() => act((s) => placeToken(s, r.id, 1))} disabled={activeFaction.hand <= 0}>+</button>
                    </div>
                  ))}
                </div>
                <div className="actions">
                  <button onClick={() => act((s) => autoRedeploy(s))}>Repartir automáticamente</button>
                  <button className="primary" onClick={() => { act((s) => endTurn(s)); setSelected(null); setMarkerMode(false) }}>
                    Fin del turno
                  </button>
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
        )}
      </aside>

      {rules && (
        <div className="modal" onClick={() => setRules(false)}>
          <div className="modalbox" onClick={(e) => e.stopPropagation()}>
            <h2>Cómo se juega</h2>
            <ol>
              <li><strong>Elige raza + poder</strong> de la bandeja. La primera es gratis; cada posición más abajo cuesta 1 moneda por combinación que saltas, y esas monedas se quedan encima de las descartadas.</li>
              <li><strong>Conquista.</strong> Al empezar el turno recoges todas tus fichas dejando 1 en cada región. Conquistar cuesta <em>2 + fichas defensoras + 1 por montaña + fortalezas</em>, modificado por tus poderes. La primera conquista de una raza debe hacerse desde el mar (regiones con ⚓).</li>
              <li><strong>Dado de refuerzo.</strong> Una vez por turno, si te faltan fichas, puedes lanzarlo (caras 0,0,0,1,2,3). Si aun así no llegas, el asalto fracasa.</li>
              <li><strong>Redespliegue.</strong> Reparte las fichas sobrantes entre tus regiones para defenderlas.</li>
              <li><strong>Puntuación.</strong> 1 moneda por región ocupada (activa y en declive) más las bonificaciones de raza y poder.</li>
              <li><strong>Declive.</strong> Cuando tu raza se agote, mándala al declive: conserva 1 ficha por región y sigue puntuando, pero tu raza anterior en declive desaparece. Al turno siguiente eliges una raza nueva.</li>
            </ol>
            <p className="muted">Proyecto de fans inspirado en Small World of Warcraft (Days of Wonder / Blizzard). Arte y mapa redibujados desde cero.</p>
            <button className="primary" onClick={() => setRules(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
