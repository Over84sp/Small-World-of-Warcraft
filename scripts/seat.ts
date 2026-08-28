import { createGame, beginTurn } from '../src/game/engine'
import { chooseAction, applyBotAction } from '../src/ai/bot'
const bySeat = [0,0,0]; const coinsBySeat=[0,0,0]
const N=300
for (let g=0; g<N; g++) {
  const s = createGame([{name:'S0',isBot:true},{name:'S1',isBot:true},{name:'S2',isBot:true}], 5000+g)
  beginTurn(s)
  let guard=0
  while (s.phase!=='gameover' && guard++<4000) applyBotAction(s, chooseAction(s))
  const best = Math.max(...s.players.map(p=>p.coins))
  s.players.forEach((p,i)=>{ coinsBySeat[i]+=p.coins; if(p.coins===best) bySeat[i]++ })
}
console.log('  victorias por asiento:', bySeat.map((w,i)=>`asiento ${i+1}: ${(100*w/N).toFixed(0)}%`).join('  '))
console.log('  monedas medias      :', coinsBySeat.map((c,i)=>`asiento ${i+1}: ${(c/N).toFixed(1)}`).join('  '))
