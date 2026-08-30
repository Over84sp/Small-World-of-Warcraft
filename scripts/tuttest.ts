import { createGame, selectCombo, conquer, conquestCost, startRedeploy, autoRedeploy, goIntoDecline, scoreFor, regionsOf } from '../src/game/engine'
import type { GameState } from '../src/game/types'

const HORDE='tut-horde'
const setR=(s:GameState,id:string,o:string|null,t:number)=>{s.regions[id]={owner:o,tokens:t,fortress:0,hero:false,wisp:0,bomb:false,mo:false}}
let ok=true
const chk=(c:boolean,m:string)=>{console.log((c?'  OK  ':'  FAIL')+'  '+m); if(!c) ok=false}

// small_a oficial
const s = createGame([{name:'Tú',isBot:false},{name:'Horda',isBot:true}], 20260828, 'small_a')
s.phase='pick'
s.legendary=[]

// step: board - sa7 y sa3 con tribu
setR(s,'sa7','lost-tribe',1); setR(s,'sa3','lost-tribe',1)

// step: pick
s.tray[0]={raceId:'humans',powerId:'merchant',bonusCoins:0}
selectCombo(s,0)
chk(!!s.players[0].activeUid,'elige Humanos Mercaderes')
const f=()=>s.factions[s.players[0].activeUid!]

// step: first conquest sa6
if(regionsOf(s,f().uid).length===0) f().hand=20
console.log('  ..   ejército del tutorial: 20 fichas (anunciado en pantalla)')
let i=conquestCost(s,'sa6'); chk(i.reachable&&i.cost===3,`Llanos Mulgore por mar (2 base + 1 desembarco), coste ${i.cost} (esperado 3)`)
chk(conquer(s,'sa6').ok,'conquista Llanos Mulgore')

// step: adjacency sa4 (central, patria alianza)
i=conquestCost(s,'sa4'); chk(i.reachable&&i.cost===1,`Bosque Elwynn adyacente patria, coste ${i.cost} (esperado 1)`)
chk(conquer(s,'sa4').ok,'conquista Bosque Elwynn')

// step: legendary sa2
s.legendary=[{defId:'dark_portal', regionId:'sa2', revealed:false, isArtifact:false}]
i=conquestCost(s,'sa2'); chk(i.reachable&&i.cost===1,`Campos Westfall con loseta boca abajo patria, coste ${i.cost} (esperado 1)`)
chk(conquer(s,'sa2').ok,'conquista Campos Westfall y revela Portal Oscuro')
chk(s.legendary[0].revealed,'loseta revelada')
chk(f().hand===15,`tras 3 conquistas quedan ${f().hand} fichas (20-3-1-1=15)`)

// step: mountain sa1
i=conquestCost(s,'sa1'); chk(i.reachable&&i.cost===3,`Cima Vigía montaña, coste ${i.cost} (esperado 3)`)
chk(conquer(s,'sa1').ok,'conquista Cima Vigía')

// step: lost tribe sa3
chk(f().hand===12,`tras Cima quedan ${f().hand} fichas (15-3=12)`)
i=conquestCost(s,'sa3'); chk(i.reachable&&i.cost===3,`Colinas Hillsbrad tribu perdida, coste ${i.cost} (esperado 3)`)
chk(conquer(s,'sa3').ok,'somete Colinas Hillsbrad')

// step: combat sa5
s.factions[HORDE]={uid:HORDE,playerId:1,raceId:'orcs',powerId:'berserk',inDecline:false,hand:0,markers:0}
s.players[1].activeUid=HORDE
setR(s,'sa5',HORDE,2)
chk(f().hand===9,`tras Hillsbrad quedan ${f().hand} fichas (12-3=9)`)
i=conquestCost(s,'sa5'); chk(i.reachable&&i.cost===4&&i.homeland===true,`Crestagrana con 2 defensores en patria + montaña, coste ${i.cost} (esperado 4 = 2+2+1-1)`)
chk(conquer(s,'sa5').ok,'expulsa a la Horda')
chk(s.turn.pendingReturns[HORDE]===1,'el defensor recupera 1 ficha (pierde 1)')

chk(f().hand===5,`tras Crestagrana quedan ${f().hand} fichas (9-4=5)`)

// step: dice sa7 tribu -> forzamos dado con mano 2 vs coste 3
f().hand=2
i=conquestCost(s,'sa7'); chk(i.reachable&&i.cost===3,`Pantano Zánganos tribu, coste ${i.cost} (esperado 3)`)
const roll=conquer(s,'sa7',true)
chk(s.turn.diceUsed===1,`dado lanzado (sacó ${roll.rolled}, ${roll.ok?'éxito':'fallo'}) — el paso avanza igual`)

// step: redeploy
if(s.phase==='conquer'){ f().hand=Math.max(f().hand,3); startRedeploy(s) }
chk(s.phase==='redeploy','entra en redespliegue')
autoRedeploy(s)
chk(f().hand===0,'reparte todas las fichas')

// step: score
const sc=scoreFor(s,0)
chk(sc.total>0,`puntúa ${sc.total} monedas -> ${sc.detail.join(' | ')}`)
chk(sc.detail.some(d=>d.includes('Botín de facción: +1')),'el botín de Llanos Mulgore (Horda) aparece: +1')
chk(sc.detail.some(d=>d.includes('Portal Oscuro')),`Portal Oscuro aparece en puntuación: ${sc.detail.join(' | ')}`)

// step: decline
goIntoDecline(s)
chk(!!s.players[0].declineUid && !s.players[0].activeUid,'los Humanos entran en declive')
chk(regionsOf(s,s.players[0].declineUid!).every(r=>s.regions[r.id].tokens===1),'conserva 1 ficha por región')

console.log(ok?'\nTUTORIAL COMPLETO ✅':'\nHAY FALLOS ❌')
process.exit(ok?0:1)
