/** El guardado es un JSON.stringify del estado: comprobamos que sobrevive el viaje. */
import { createGame, beginTurn, scoreFor, legalTargets } from '../src/game/engine'
import { chooseAction, applyBotAction } from '../src/ai/bot'
import type { GameState } from '../src/game/types'

let ok = true
const chk = (c: boolean, m: string) => { console.log((c ? '  OK  ' : '  FAIL') + '  ' + m); if (!c) ok = false }

const s = createGame([{ name: 'A', isBot: true }, { name: 'B', isBot: true }, { name: 'C', isBot: true }], 99)
beginTurn(s)
for (let i = 0; i < 120; i++) applyBotAction(s, chooseAction(s))

const round = JSON.parse(JSON.stringify(s)) as GameState
chk(JSON.stringify(round) === JSON.stringify(s), 'el estado sobrevive intacto a JSON ida y vuelta')
chk(scoreFor(round, 0).total === scoreFor(s, 0).total, 'la puntuación se calcula igual tras recargar')
chk(legalTargets(round).length === legalTargets(s).length, 'los objetivos legales son los mismos')

// y la partida se puede terminar desde el estado recargado
let guard = 0
while (round.phase !== 'gameover' && guard++ < 4000) applyBotAction(round, chooseAction(round))
chk(round.phase === 'gameover', 'la partida recargada se puede terminar')
chk(round.winner !== null, `hay ganador: ${round.players[round.winner!].name}`)

const size = JSON.stringify(s).length
chk(size < 500_000, `tamaño del guardado: ${(size / 1024).toFixed(0)} KB (cabe de sobra en localStorage)`)

console.log(ok ? '\nGUARDADO CORRECTO ✅' : '\nHAY FALLOS ❌')
process.exit(ok ? 0 : 1)
