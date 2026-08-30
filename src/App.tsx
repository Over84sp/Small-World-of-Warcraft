import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOARDS, REGION_BY_ID, abilitiesOf, autoRedeploy, beginTurn, canDeclineNow, comboTokens, conquer,
  conquestCost, createGame, defenseOf, diplomacyOptions, endTurn, factionLabel,
  goIntoDecline, intimidate, legendaryAt, legendaryDefOf, needsDiplomacy, placeBomb, placeMarker, placeObjective, placeToken,
  plunderThisTurn, regionsOf, salvageSouls, scoreFor, selectCombo, setPeace, setWorgenForm, sideOf, startRedeploy,
} from './game/engine'
import { clearSave, loadGame, saveGame } from './game/save'
import { RACE_BY_ID, POWER_BY_ID, RACE_SIDE, SIDE_LABEL } from './game/abilities'
import { LEGENDARY_BY_ID } from './game/legendary'
import type { GameState } from './game/types'
import { MapView, type BattleAnim } from './ui/MapView'
import { FactionIcon, LegendaryIcon } from './ui/mapArt'
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
  const [bombMode, setBombMode] = useState(false)
  const [objectiveMode, setObjectiveMode] = useState(false)
  const [intimidateMode, setIntimidateMode] = useState(false)
  const [battle, setBattle] = useState<BattleAnim | null>(null)
  const battleTimer = useRef<number | null>(null)
  // conquests already narrated during the current bot turn: the first gets a
  // long pause so the animation can play, the rest keep the game moving
  const botConquests = useRef(0)
  const [rules, setRules] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [confirmMode, setConfirmMode] = useState(isTouch)
  const [showAbandon, setShowAbandon] = useState(false)
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
      setBombMode(false)
      setObjectiveMode(false)
      setIntimidateMode(false)
      return h.slice(0, -1)
    })
  }

  const clearTurnState = () => {
    setHistory([])
    setSelected(null)
    setMarkerMode(false)
    setBombMode(false)
    setObjectiveMode(false)
    setIntimidateMode(false)
  }

  const abandonGame = () => {
    clearSave()
    setState(null)
    setScreen('setup')
    clearTurnState()
    setShowAbandon(false)
    setSelected(null)
    setMarkerMode(false)
  }

  const start = (r: SetupResult) => {
    const s = createGame(r.players, r.seed, r.boardId)
    beginTurn(s)
    clearSave()
    setState(s)
    setScreen('game')
    clearTurnState()
  }

  const resume = () => {
    const s = loadGame()
    if (!s) return
    setState(s)
    setScreen('game')
    clearTurnState()
  }

  const player = state?.players[state.current]
  const isBotTurn = !!player?.isBot && state?.phase !== 'gameover'

  /** narrate a conquest: rings on the region + a cost-breakdown panel */
  const showBattle = useCallback((b: BattleAnim) => {
    setBattle(b)
    if (battleTimer.current) window.clearTimeout(battleTimer.current)
    battleTimer.current = window.setTimeout(() => setBattle(null), 2700)
  }, [])

  /** human readable cost breakdown of a conquest, from the pre-conquest state */
  const battleParts = (s: GameState, regionId: string, info: ReturnType<typeof conquestCost>): [string, number][] => {
    const parts: [string, number][] = [['base', 2]]
    const def = defenseOf(s, regionId)
    if (def > 0) parts.push(['defensa', def])
    if (info.viaSea) parts.push(['desembarco', 1])
    if (info.homeland) parts.push(['patria', -1])
    if (info.ethereal) parts.push(['etéreos', -2])
    if (s.turn.worgenForm === 'werewolf') parts.push(['huargo', -1])
    const listed = parts.reduce((a, [, v]) => a + v, 0)
    const rest = info.cost - listed
    if (rest !== 0) parts.push(['poderes', rest])
    return parts
  }

  // ---- bot driver -------------------------------------------------------
  useEffect(() => {
    if (!state || !isBotTurn || screen !== 'game') return
    if (history.length) setHistory([])
    const s0 = stateRef.current!
    if (s0.turn.conquered.length === 0) botConquests.current = 0
    const action = chooseAction(structuredClone(s0))
    let delay = 750
    if (action.kind === 'conquer') {
      const info = conquestCost(s0, action.regionId)
      if (info.reachable) {
        showBattle({
          key: Date.now(),
          regionId: action.regionId,
          attackerPid: s0.current,
          attackerUid: s0.players[s0.current].activeUid,
          parts: battleParts(s0, action.regionId, info),
          total: action.champion ? 1 : info.cost,
          champion: action.champion ?? false,
          useDie: action.useDie,
        })
      }
      const first = botConquests.current === 0
      botConquests.current += 1
      delay = first ? (action.champion ? 2200 : 2700) : 1800
    } else if (action.kind === 'decline') {
      delay = 1300
    } else if (action.kind === 'endTurn' || action.kind === 'peace') {
      delay = 950
    }
    botTimer.current = window.setTimeout(() => {
      act((s) => {
        applyBotAction(s, action)
      })
    }, delay)
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current)
    }
  }, [state, isBotTurn, act, screen, showBattle]) // eslint-disable-line react-hooks/exhaustive-deps

  // autosave: the engine state is plain JSON, so this is just a stringify
  useEffect(() => {
    if (state && screen === 'game') saveGame(state)
  }, [state, screen])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  // Esc cancels the current selection / mode / modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAbandon) { setShowAbandon(false); return }
        if (rules) { setRules(false); return }
        setSelected(null)
        setMarkerMode(false)
        setBombMode(false)
        setObjectiveMode(false)
        setIntimidateMode(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showAbandon, rules])

  if (screen === 'tutorial') return <Tutorial onExit={() => setScreen('setup')} />
  if (!state || !player || screen === 'setup') {
    return <Setup onStart={start} onTutorial={() => setScreen('tutorial')} onContinue={resume} />
  }

  const activeFaction = player.activeUid ? state.factions[player.activeUid] : null
  const declineFaction = player.declineUid ? state.factions[player.declineUid] : null
  const owned = activeFaction ? regionsOf(state, activeFaction.uid) : []
  const selInfo = selected ? conquestCost(state, selected) : null
  const selRegion = selected ? REGION_BY_ID[selected] : null
  const maxDice = 1 + (activeFaction
    ? (abilitiesOf(activeFaction).find((a) => a.extraDice)?.extraDice ?? 0)
    : 0)
  const canAffordSel = !!activeFaction && !!selInfo?.reachable && selInfo.cost <= activeFaction.hand
  const canRollDie =
    !!activeFaction && state.phase === 'conquer' && state.turn.diceUsed < maxDice &&
    activeFaction.hand >= 1 && !!selInfo?.reachable && selInfo.cost > activeFaction.hand

  const doConquer = (id: string) => {
    const info = conquestCost(state, id)
    if (info.reachable) {
      showBattle({
        key: Date.now(),
        regionId: id,
        attackerPid: player.id,
        attackerUid: activeFaction?.uid ?? null,
        parts: battleParts(state, id, info),
        total: info.cost,
        champion: false,
        useDie: false,
      })
    }
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
    if (bombMode) {
      const test = structuredClone(state)
      if (placeBomb(test, id)) {
        act((s) => { placeBomb(s, id) }, true)
      } else {
        setFlash('Ahí no puedes pegar una bomba: ha de ser una región rival activa adyacente a la tuya')
      }
      setBombMode(false)
      return
    }
    if (objectiveMode) {
      const test = structuredClone(state)
      if (placeObjective(test, id)) {
        act((s) => { placeObjective(s, id) }, true)
      } else {
        setFlash('Objetivo inválido: marca regiones que NO controles (máximo 2 por turno)')
      }
      setObjectiveMode(false)
      return
    }
    if (intimidateMode) {
      const test = structuredClone(state)
      if (intimidate(test, id)) {
        act((s) => { intimidate(s, id) }, true)
      } else {
        setFlash('No puedes intimidar ahí: región rival activa adyacente a la tuya y con fichas (máx 3 por turno)')
      }
      setIntimidateMode(false)
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
    const info = conquestCost(state, selected)
    if (info.reachable) {
      showBattle({
        key: Date.now(),
        regionId: selected,
        attackerPid: player.id,
        attackerUid: activeFaction?.uid ?? null,
        parts: battleParts(state, selected, info),
        total: info.cost,
        champion: false,
        useDie: true,
      })
    }
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
        <div className="modalActions">
          <button className="primary" onClick={() => { clearSave(); setState(null); setScreen('setup'); clearTurnState() }}>Jugar otra vez</button>
          <button className="ghost danger" onClick={() => { clearSave(); setState(null); setScreen('setup'); clearTurnState() }}>Volver al inicio</button>
        </div>
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
              <div className="ftitle">
                {factionLabel(activeFaction)}
                <span className={`sidetag ${sideOf(activeFaction)}`}>
                  <FactionIcon side={sideOf(activeFaction)} size={13} />
                  {SIDE_LABEL[sideOf(activeFaction)]}
                </span>
              </div>
              <div className="fstats">
                <span>En mano <strong>{activeFaction.hand}</strong></span>
                <span>Regiones <strong>{owned.length}</strong></span>
                {activeFaction.markers > 0 && <span>Marcadores <strong>{activeFaction.markers}</strong></span>}
                {activeFaction.bombs > 0 && <span>💣 <strong>{activeFaction.bombs}</strong></span>}
                {activeFaction.wispWalls > 0 && <span>✨ <strong>{activeFaction.wispWalls}</strong></span>}
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
          {activeFaction && plunderThisTurn(state, activeFaction).length > 0 && (
            <div className="plunder">
              ⚔ Botín de facción este turno: <strong>+{plunderThisTurn(state, activeFaction).length}</strong> 🪙
            </div>
          )}
          {player.harmony > 0 && (
            <div className="plunder">
              🕊 Tienes <strong>Armonía</strong>: conquistar una región Pandaren activa te cuesta 2 monedas.
            </div>
          )}
          {state.legendary.filter(t => t.revealed).length > 0 && (
            <div className="legendary-owned">
              {state.legendary.filter(t => {
                return t.revealed && (() => {
                  const pid = player.id
                  const owned = new Set<string>()
                  for (const uid of [state.players[pid].activeUid, state.players[pid].declineUid]) {
                    if (!uid) continue
                    for (const [rid, rs] of Object.entries(state.regions)) if (rs.owner === uid) owned.add(rid)
                  }
                  return owned.has(t.regionId)
                })()
              }).map(t => {
                const def = LEGENDARY_BY_ID[t.defId]
                return (
                  <span key={t.defId} className={`legchip ${def?.isArtifact ? 'artifact' : 'place'}`}>
                    <LegendaryIcon isArtifact={!!def?.isArtifact} size={12} /> {def?.name}
                  </span>
                )
              })}
            </div>
          )}
          <div className="preview">Si acabas ahora: <strong>{preview.total}</strong> 🪙</div>
        </section>

        {!isBotTurn && state.phase === 'conquer' && activeFaction?.raceId === 'worgen' && !state.turn.worgenForm && (
          <section className="card diplo">
            <h3>Forma Huargen</h3>
            <p className="hint">Elige tu forma para este turno (al acabar el turno sin elegir cuentas como humano).</p>
            <div className="diplolist">
              <button onClick={() => act((s) => setWorgenForm(s, 'human'), true)}>
                🧑 <strong>Humano</strong> · +2 monedas al puntuar
              </button>
              <button onClick={() => act((s) => setWorgenForm(s, 'werewolf'), true)}>
                🐺 <strong>Huargo</strong> · conquistas −1 ficha, −1 moneda al puntuar
              </button>
            </div>
          </section>
        )}

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
                      <span className="cname" style={{ color: race?.color }}>
                        <FactionIcon side={RACE_SIDE[c.raceId] ?? 'neutral'} size={12} /> {power?.name} {race?.name}
                      </span>
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
                {selRegion.faction && selRegion.faction !== 'neutral' && (
                  <div className={`smeta banner ${selRegion.faction}`}>
                    <FactionIcon side={selRegion.faction} size={14} />
                    Territorio de la {SIDE_LABEL[selRegion.faction]}
                  </div>
                )}
                {selInfo.homeland && <div className="bonusline home">🏳 Tu propia tierra: cuesta 1 ficha menos</div>}
                {selInfo.plunder && <div className="bonusline loot">⚔ Botín: +1 moneda al conquistarla</div>}
                {(() => {
                  const leg = legendaryAt(state, selRegion.id)
                  const def = legendaryDefOf(leg)
                  if (!leg) return null
                  if (!leg.revealed) {
                    return <div className="bonusline legendary hidden">❓ Loseta boca abajo: se revelará al conquistarla</div>
                  }
                  return (
                    <div className={`bonusline legendary ${def?.isArtifact ? 'artifact' : 'place'}`}>
                      <LegendaryIcon isArtifact={!!def?.isArtifact} size={14} /> <strong>{def?.name}</strong> — {def?.effectDesc}
                      <div className="lore">{def?.lore}</div>
                    </div>
                  )
                })()}
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
                    {selInfo.champion && (
                      <div className="confirmrow">
                        <button className="primary" onClick={() => {
                          showBattle({
                            key: Date.now(),
                            regionId: selRegion.id,
                            attackerPid: player.id,
                            attackerUid: activeFaction?.uid ?? null,
                            parts: [],
                            total: 1,
                            champion: true,
                            useDie: false,
                          })
                          act((s) => {
                            const res = conquer(s, selRegion.id, false, true)
                            if (!res.ok) setFlash(res.message)
                          }, true)
                          setSelected(null)
                        }}>🗡 Cargar con el Campeón (1 ficha, ignora la defensa)</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="sbad">{selInfo.reason}</div>
                )}
              </div>
            ) : (
              state.turn.assaultFailed ? (
                <p className="sbad">
                  🎲 Tu asalto fracasó. Se acabaron las conquistas de este turno: reparte tus
                  fichas y pasa el turno.
                </p>
              ) : (
                <p className="hint">
                  {confirmMode
                    ? 'Toca una región marcada para verla, y otra vez para conquistarla.'
                    : 'Clic en una región marcada para conquistarla. El círculo amarillo es el coste.'}
                </p>
              )
            )}
            <div className="actions">
              <button className="primary" disabled={!canRollDie} onClick={doDie}>
                🎲 Dado de refuerzo {state.turn.diceUsed > 0 && `(${state.turn.diceUsed}/${maxDice})`}
              </button>
              {activeFaction.powerId === 'intimidating' && state.turn.intimidated < 3 && (
                <button className={intimidateMode ? 'primary' : ''} onClick={() => setIntimidateMode((v) => !v)}>
                  😠 {intimidateMode ? 'Cancelar' : `Intimidar (${state.turn.intimidated}/3)`}
                </button>
              )}
              {activeFaction.markers > 0 && (
                <button className={markerMode ? 'primary' : ''} onClick={() => setMarkerMode((v) => !v)}>
                  {markerMode ? '✕ Cancelar colocación' : '🛡 Colocar fortaleza'}
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

        {!isBotTurn && needsDiplomacy(state) && (
          <section className="card diplo">
            <h3>Diplomacia</h3>
            <p className="hint">
              Elige un rival con el que firmar la paz: no podrá atacarte hasta tu próximo turno.
              No puedes pactar con quien hayas atacado este turno.
            </p>
            <div className="diplolist">
              {diplomacyOptions(state).map((pid) => (
                <button key={pid} onClick={() => act((s) => setPeace(s, pid), true)}>
                  <i style={{ background: PLAYER_COLORS[pid] }} />
                  {state.players[pid].name}
                  <strong>{state.players[pid].coins} 🪙</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {player.peaceWith !== null && !isBotTurn && (
          <div className="peacenote">🕊 Paz firmada con {state.players[player.peaceWith].name}</div>
        )}

        {state.phase === 'redeploy' && activeFaction && !isBotTurn && (
          <section className="card">
            <h3>Redespliegue</h3>
            <p className="hint">Reparte las <strong>{activeFaction.hand}</strong> fichas restantes. Clic en el mapa para añadir.</p>
            <div className="deploylist">
              {owned.map((r) => (
                <div key={r.id} className="deployrow">
                  <span>{r.name}</span>
                  <button onClick={() => act((s) => placeToken(s, r.id, -1), true)} disabled={state.regions[r.id].tokens <= (activeFaction.raceId === 'tauren' ? 2 : 1)}>−</button>
                  <strong>{state.regions[r.id].tokens}</strong>
                  <button onClick={() => act((s) => placeToken(s, r.id, 1), true)} disabled={activeFaction.hand <= 0}>+</button>
                </div>
              ))}
            </div>
            <div className="actions">
              <button onClick={() => act((s) => autoRedeploy(s), true)}>Repartir automáticamente</button>
              <button className="primary" onClick={finishTurn}>Fin del turno</button>
            </div>
            {(activeFaction.raceId === 'goblins' || activeFaction.raceId === 'humans' || (activeFaction.raceId === 'forsaken' && state.turn.souls > 0)) && (
              <div className="actions">
                {activeFaction.raceId === 'goblins' && activeFaction.bombs > 0 && (
                  <button className={bombMode ? 'primary' : ''} onClick={() => setBombMode((v) => !v)}>
                    💣 {bombMode ? 'Cancelar bomba' : 'Pegar bomba a región vecina'}
                  </button>
                )}
                {activeFaction.raceId === 'humans' && state.turn.moPlaced < 2 && (
                  <button className={objectiveMode ? 'primary' : ''} onClick={() => setObjectiveMode((v) => !v)}>
                    🎯 {objectiveMode ? 'Cancelar objetivo' : `Marcar objetivo militar (${state.turn.moPlaced}/2)`}
                  </button>
                )}
                {activeFaction.raceId === 'forsaken' && state.turn.souls > 0 && (
                  <button onClick={() => act((s) => salvageSouls(s, 1), true)} disabled={player.coins < 1}>
                    👻 Alma → ficha (1🪙) · {state.turn.souls} disponible{state.turn.souls > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
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

        <section className="card dangerzone">
          <button className="ghost danger full" onClick={() => setShowAbandon(true)}>⏻ Abandonar partida</button>
          <p className="hint small">Borra el guardado y vuelve al inicio. Se puede deshacer mientras no cierres la pestaña con Ctrl+Z, pero el guardado se pierde.</p>
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
        {state.phase !== 'gameover' && (
          <button className="ghost danger" onClick={() => setShowAbandon(true)} title="Abandonar partida">{isMobile ? '⏻' : 'Abandonar'}</button>
        )}
      </header>

      <main className="board">
        <MapView
          state={state}
          selected={selected}
          onSelect={onRegion}
          highlightTargets={state.phase === 'conquer' && !isBotTurn}
          markerMode={markerMode}
          compact={isMobile}
          battle={battle}
        />
        {flash && <div className="flash">{flash}</div>}
        {isBotTurn && <div className="thinking">{player.name} está pensando…</div>}
        {markerMode && <div className="modehint">Elige una región tuya · <button onClick={() => setMarkerMode(false)}>Cancelar</button></div>}
        {bombMode && <div className="modehint">💣 Elige una región rival activa adyacente a las tuyas · <button onClick={() => setBombMode(false)}>Cancelar</button></div>}
        {objectiveMode && <div className="modehint">🎯 Marca una región que NO controles · <button onClick={() => setObjectiveMode(false)}>Cancelar</button></div>}
        {intimidateMode && <div className="modehint">😠 Elige una región rival activa adyacente · <button onClick={() => setIntimidateMode(false)}>Cancelar</button></div>}
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
            <h3>Alianza y Horda</h3>
            <ul className="legend">
              <li>Cada raza lucha bajo una bandera. Las razas <b>neutrales</b> (Etéreos, Kobolds, Pandaren y Naga) son mercenarias.</li>
              <li>🏳 Conquistar una región <b>de tu propia bandera</b> cuesta <b>1 ficha menos</b>: los tuyos se te unen.</li>
              <li>⚔ Conquistar una región <b>de la bandera enemiga</b> da <b>+1 moneda</b> de botín ese turno. Las razas neutrales saquean a los dos bandos.</li>
              <li>Los <b>Orcos</b> cobran el botín <b>doble</b> sobre territorio de la Alianza. Los <b>Múrlocs</b> son los nativos del mapa (fichas grises).</li>
            </ul>

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

      {showAbandon && (
        <div className="modal" onClick={() => setShowAbandon(false)}>
          <div className="modalbox small" onClick={(e) => e.stopPropagation()}>
            <h2>¿Abandonar partida?</h2>
            <p>Se borrará el guardado automático y volverás a la pantalla de inicio. Esta acción no se puede deshacer.</p>
            <p className="muted">Ronda {state.round}/{state.maxRounds} · {BOARDS.find((b) => b.id === state.boardId)?.name}</p>
            <div className="modalActions">
              <button className="ghost danger" onClick={abandonGame}>Sí, abandonar y borrar</button>
              <button className="primary" onClick={() => setShowAbandon(false)}>Seguir jugando</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
