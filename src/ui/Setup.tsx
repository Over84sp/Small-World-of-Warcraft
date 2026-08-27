import { useState } from 'react'
import { BOARDS, ROUNDS_BY_PLAYERS, defaultBoardFor } from '../game/engine'
import { PLAYER_COLORS, PLAYER_NAMES } from './theme'

export interface SetupResult {
  players: { name: string; isBot: boolean }[]
  boardId: string
  seed: number
}

export function Setup({ onStart }: { onStart: (r: SetupResult) => void }) {
  const [count, setCount] = useState(3)
  const [humans, setHumans] = useState(1)
  const [boardId, setBoardId] = useState(defaultBoardFor(3))
  const [names, setNames] = useState<string[]>([...PLAYER_NAMES])

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

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Small World <span>of Azeroth</span></h1>
        <p className="tagline">
          Un mundo demasiado pequeño para tantos pueblos. Conquista, exprime a tu raza y mándala
          al declive antes de que se desangre.
        </p>

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
          <span>Tablero</span>
          <div className="boards">
            {BOARDS.map((b) => (
              <button key={b.id} className={boardId === b.id ? 'board on' : 'board'} onClick={() => setBoardId(b.id)}>
                <strong>{b.name}</strong>
                <em>{b.desc}</em>
              </button>
            ))}
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
      </div>
    </div>
  )
}
