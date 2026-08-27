import { createGame, beginTurn } from '../src/game/engine'
import { chooseAction, applyBotAction } from '../src/ai/bot'

let wins: Record<string, number> = {}
let scores: number[] = []
for (let g = 0; g < 200; g++) {
  const s = createGame([
    { name: 'A', isBot: true }, { name: 'B', isBot: true }, { name: 'C', isBot: true },
  ], 1000 + g)
  beginTurn(s)
  let guard = 0
  while (s.phase !== 'gameover' && guard++ < 4000) {
    const a = chooseAction(s)
    applyBotAction(s, a)
  }
  if (guard >= 4000) { console.log('STUCK at game', g, s.phase, s.round); break }
  scores.push(...s.players.map(p => p.coins))
  const w = s.players[s.winner!].name
  wins[w] = (wins[w] ?? 0) + 1
}
console.log('wins', wins)
console.log('avg score', (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1),
  'min', Math.min(...scores), 'max', Math.max(...scores))
