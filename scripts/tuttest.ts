import { createGame, selectCombo, conquer, conquestCost, startRedeploy, autoRedeploy, goIntoDecline, scoreFor, regionsOf } from '../src/game/engine'
import type { GameState } from '../src/game/types'

const HORDE='tut-horde'
const setR=(s:GameState,id:string,o:string|null,t:number)=>{s.regions[id]={owner:o,tokens:t,fortress:0,hero:false}}
let ok=true
const chk=(c:boolean,m:string)=>{console.log((c?'  OK  ':'  FAIL')+'  '+m); if(!c) ok=false}

const s = createGame([{name:'Tú',isBot:false},{name:'Horda',isBot:true}], 20260828, 'kalimdor')
s.phase='pick'
s.legendary=[] // limpiar aleatorias para test determinista

// step: board
setR(s,'winterspring','lost-tribe',1); setR(s,'felwood','lost-tribe',1)

// step: pick
s.tray[0]={raceId:'humans',powerId:'merchant',bonusCoins:0}
selectCombo(s,0)
chk(!!s.players[0].activeUid,'elige Humanos Mercaderes')
const f=()=>s.factions[s.players[0].activeUid!]

// step: first conquest
if(regionsOf(s,f().uid).length===0) f().hand=20
console.log('  ..   ejército del tutorial: 20 fichas (anunciado en pantalla)')
let i=conquestCost(s,'durotar'); chk(i.reachable&&i.cost===3,`Durotar por mar (2 base + 1 desembarco), coste ${i.cost} (esperado 3)`)
chk(conquer(s,'durotar').ok,'conquista Durotar')

// step: adjacency
i=conquestCost(s,'azshara'); chk(i.reachable&&i.cost===2,`Azshara adyacente, coste ${i.cost} (esperado 2)`)
chk(conquer(s,'azshara').ok,'conquista Azshara')

// step: legendary (nuevo)
s.legendary=[{defId:'dark_portal', regionId:'nbarrens', revealed:false, isArtifact:false}]
i=conquestCost(s,'nbarrens'); chk(i.reachable&&i.cost===2,`Northern Barrens con loseta boca abajo, coste ${i.cost} (esperado 2)`)
chk(conquer(s,'nbarrens').ok,'conquista Northern Barrens y revela Portal Oscuro')
chk(s.legendary[0].revealed,'loseta revelada')
chk(f().hand===13,`tras Durotar+Azshara+Northern Barrens quedan ${f().hand} fichas (20-3-2-2=13)`)

// step: mountain
i=conquestCost(s,'hyjal'); chk(i.reachable&&i.cost===3,`Hyjal montaña, coste ${i.cost} (esperado 3)`)
chk(conquer(s,'hyjal').ok,'conquista Monte Hyjal')

// step: lost tribe  (SIN rellenar la mano: debe salir la cuenta sola)
chk(f().hand===10,`tras Hyjal quedan ${f().hand} fichas (13-3=10)`)
i=conquestCost(s,'felwood'); chk(i.reachable&&i.cost===3,`Felwood tribu perdida, coste ${i.cost} (esperado 3)`)
chk(conquer(s,'felwood').ok,'somete Felwood')

// step: combat
s.factions[HORDE]={uid:HORDE,playerId:1,raceId:'orcs',powerId:'berserk',inDecline:false,hand:0,markers:0}
s.players[1].activeUid=HORDE
setR(s,'ashenvale',HORDE,2)
chk(f().hand===7,`tras Felwood quedan ${f().hand} fichas (10-3=7)`)
i=conquestCost(s,'ashenvale'); chk(i.reachable&&i.cost===3&&i.homeland===true,`Ashenvale con 2 defensores en patria de la Alianza, coste ${i.cost} (esperado 3 = 2+2-1)`)
chk(conquer(s,'ashenvale').ok,'expulsa a la Horda')
chk(s.turn.pendingReturns[HORDE]===1,'el defensor recupera 1 ficha (pierde 1)')

chk(f().hand===4,`tras Ashenvale quedan ${f().hand} fichas (7-3=4)`)

// step: dice  (staging deliberado y anunciado)
f().hand=3
i=conquestCost(s,'winterspring'); chk(i.reachable&&i.cost===4,`Winterspring montaña+tribu, coste ${i.cost} (esperado 4)`)
const roll=conquer(s,'winterspring',true)
chk(s.turn.diceUsed===1,`dado lanzado (sacó ${roll.rolled}, ${roll.ok?'éxito':'fallo'}) — el paso avanza igual`)

// step: redeploy
if(s.phase==='conquer'){ f().hand=Math.max(f().hand,3); startRedeploy(s) }
chk(s.phase==='redeploy','entra en redespliegue')
autoRedeploy(s)
chk(f().hand===0,'reparte todas las fichas')

// step: score
const sc=scoreFor(s,0)
chk(sc.total>0,`puntúa ${sc.total} monedas -> ${sc.detail.join(' | ')}`)
chk(sc.detail.some(d=>d.includes('Botín de facción: +3')),'el botín de Durotar, Azshara y Northern Barrens (Horda) aparece: +3')
chk(sc.detail.some(d=>d.includes('Portal Oscuro')),`Portal Oscuro aparece en puntuación: ${sc.detail.join(' | ')}`)

// step: decline
goIntoDecline(s)
chk(!!s.players[0].declineUid && !s.players[0].activeUid,'los Humanos entran en declive')
chk(regionsOf(s,s.players[0].declineUid!).every(r=>s.regions[r.id].tokens===1),'conserva 1 ficha por región')

console.log(ok?'\nTUTORIAL COMPLETO ✅':'\nHAY FALLOS ❌')
process.exit(ok?0:1)
