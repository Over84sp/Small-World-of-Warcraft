import { useState } from 'react'
import { BOARDS, ISLANDS, ROUNDS_BY_PLAYERS, defaultBoardFor } from '../game/engine'
import { clearSave, describeWhen, savedInfo } from '../game/save'
import { PLAYER_COLORS, PLAYER_NAMES } from './theme'

export interface SetupResult {
  players: { name: string; isBot: boolean }[]
  boardId: string
  seed: number
}

export function Setup({ onStart, onTutorial, onContinue }: {
  onStart: (r: SetupResult) => void
  onTutorial: () => void
  onContinue: () => void
}) {
  const [saved, setSaved] = useState(() => savedInfo())
  const [count, setCount] = useState(3)
  const [humans, setHumans] = useState(1)
  const [boardId, setBoardId] = useState(defaultBoardFor(3))
  const [names, setNames] = useState<string[]>([...PLAYER_NAMES])
  const [showDiscard, setShowDiscard] = useState(false)

  const changeCount = (n: number) => {
    setCount(n)
    setHumans(Math.min(humans, n))
    setBoardId(defaultBoardFor(n))
  }

  const start = () =>
    onStart({
      players: Array.from({ length: count }, (_, i) => ({
        name: names[i] || `Jugador ${i + 1}`,
        isBot: i >= humans,
      })),
      boardId,
      seed: Math.floor(Math.random() * 2 ** 31),
    })

  const discard = () => {
    clearSave()
    setSaved(null)
    setShowDiscard(false)
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Small World <span>of Azeroth</span></h1>
        <p className="tagline">
          Un mundo demasiado pequeño para tantos pueblos. Conquista, exprime a tu raza y mándala
          al declive antes de que se desangre.
        </p>

        {saved && (
          <div className="resume-wrap">
            <button className="resume" onClick={onContinue}>
              <div className="rhead">
                <strong>Continuar partida</strong>
                <em>{describeWhen(saved.savedAt)}</em>
              </div>
              <div className="rmeta">
                Ronda {saved.round}/{saved.maxRounds} · {BOARDS.find((b) => b.id === saved.boardId)?.name}
              </div>
              <div className="rplayers">
                {saved.players.map((p, i) => (
                  <span key={i} className={i === saved.current ? 'on' : ''}>
                    <i style={{ background: PLAYER_COLORS[i] }} />
                    {p.name} {p.coins}🪙
                  </span>
                ))}
              </div>
            </button>
            <div className="resume-actions">
              <button className="ghost small danger" onClick={() => setShowDiscard(true)}>✕ Descartar partida guardada</button>
            </div>
          </div>
        )}

        <label className="field">
          <span>Jugadores</span>
          <div className="pills">
            {[2, 3, 4, 5].map((n) => (
              <button key={n} className={count === n ? 'pill on' : 'pill'} onClick={() => changeCount(n)}>{n}</button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Humanos (el resto serán IA)</span>
          <div className="pills">
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <button key={n} className={humans === n ? 'pill on' : 'pill'} onClick={() => setHumans(n)}>{n}</button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Tablero oficial (6 islas S7 M9 L11)</span>
          <div className="boards">
            {BOARDS.filter(b=> b.id.endsWith('p')).map((b) => (
              <button key={b.id} className={boardId === b.id ? 'board on' : 'board'} onClick={() => setBoardId(b.id)}>
                <strong>{b.name}</strong>
                <em>{b.desc}</em>
              </button>
            ))}
          </div>
          <div style={{marginTop:8, fontSize:12, opacity:.7}}>
            Islas: {ISLANDS.map(i=> `${i.name} ${i.desc}`).join(' · ')} — selección aleatoria por partida según nº jugadores (oficial)
          </div>
        </label>

        <div className="field">
          <span>Nombres</span>
          <div className="names">
            {Array.from({ length: count }, (_, i) => (
              <div className="nameRow" key={i}>
                <i className="swatch" style={{ background: PLAYER_COLORS[i] }} />
                <input
                  value={names[i]}
                  onChange={(e) => setNames((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <em>{i < humans ? 'humano' : 'IA'}</em>
              </div>
            ))}
          </div>
        </div>

        <button className="primary big" onClick={start}>
          Comenzar · {ROUNDS_BY_PLAYERS[count]} rondas
        </button>
        <button className="ghost big" onClick={onTutorial}>
          🎓 ¿Primera vez? Tutorial interactivo
        </button>

        <p className="hint" style={{ marginTop: 14, textAlign: 'center' }}>
          El juego se guarda solo. Puedes abandonar en cualquier momento desde el botón ⏻.
        </p>
      </div>

      {showDiscard && (
        <div className="modal" onClick={() => setShowDiscard(false)}>
          <div className="modalbox small" onClick={(e) => e.stopPropagation()}>
            <h2>¿Descartar partida guardada?</h2>
            <p>Borrará la partida de {saved?.players.map(p => p.name).join(', ')} en ronda {saved?.round}/{saved?.maxRounds}. No se puede recuperar.</p>
            <div className="modalActions">
              <button className="ghost danger" onClick={discard}>Sí, borrar</button>
              <button className="primary" onClick={() => setShowDiscard(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
