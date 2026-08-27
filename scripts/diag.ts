import { createGame, beginTurn, REGIONS, regionsOf } from '../src/game/engine'
import { chooseAction, applyBotAction } from '../src/ai/bot'
const s = createGame([{name:'A',isBot:true},{name:'B',isBot:true},{name:'C',isBot:true}], 4242)
beginTurn(s)
let g=0
while (s.phase!=='gameover' && g++<4000) applyBotAction(s, chooseAction(s))
for (const p of s.players) {
  const a = p.activeUid?regionsOf(s,p.activeUid).length:0
  const d = p.declineUid?regionsOf(s,p.declineUid).length:0
  console.log(p.name, 'coins', p.coins, 'active', a, 'decline', d, p.activeUid&&s.factions[p.activeUid].raceId, p.activeUid&&s.factions[p.activeUid].powerId)
}
console.log('empty regions', REGIONS.filter(r=>!s.regions[r.id].owner).length, '/', REGIONS.length)
console.log(s.log.slice(0,12).map(l=>`r${l.round} p${l.playerId}: ${l.text}`).join('\n'))
