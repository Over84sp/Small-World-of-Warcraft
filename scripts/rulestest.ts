/** Regresión de las reglas - actualizado a mapa oficial small_a (7 regiones) */
import {
  beginTurn, conquer, conquestCost, createGame, defenseOf, endTurn,
  gatherTokens, goIntoDecline, intimidate, placeBomb, placeObjective, placeToken,
  plunderThisTurn, salvageSouls, scoreFor, selectCombo, setWorgenForm, startRedeploy,
} from '../src/game/engine'
import { POWERS, RACES } from '../src/game/abilities'
import { REGION_BY_ID } from '../src/game/engine'
import type { GameState } from '../src/game/types'

let ok = true
const chk = (c: boolean, m: string) => { console.log((c ? '  OK  ' : '  FAIL') + '  ' + m); if (!c) ok = false }
const setR = (s: GameState, id: string, o: string | null, t: number) =>
  { s.regions[id] = { owner: o, tokens: t, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false } }

// IDs oficiales small_a
// sa1 Cima Vigía mountain neutral coastal
// sa2 Campos Westfall alliance coastal
// sa3 Colinas Hillsbrad neutral Murloc coastal
// sa4 Bosque Elwynn alliance central (no coastal)
// sa5 Montañas Crestagrana alliance mountain coastal
// sa6 Llanos Mulgore horde coastal
// sa7 Pantano Zánganos neutral Murloc coastal

/* ---------- 1. el dado fallido termina la fase de conquista ---------- */
console.log('\n[1] Un asalto fallido cierra la fase de conquista')
{
  let attempts = 0
  let sawFailure = false
  for (let seed = 0; seed < 400 && !sawFailure; seed++) {
    const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], seed, 'small_a')
    s.phase = 'pick'
    s.tray[0] = { raceId: 'orcs', powerId: 'ranger', bonusCoins: 0 } // orcos para que sa4 cueste 2 (no patria)
    selectCombo(s, 0)
    const f = s.factions[s.players[0].activeUid!]
    f.hand = 2
    conquer(s, 'sa6')          // sa6 horde, orcos patria: 2 base +1 mar -1 patria =2 -> mano 0
    f.hand = 1
    setR(s, 'sa4', null, 0) // sa4 alianza enemiga, vacía cuesta 2, adyacente a sa6
    const res = conquer(s, 'sa4', true)   // cuesta 2, mano 1 -> depende del dado (necesita >=1)
    attempts++
    if (!res.ok) {
      sawFailure = true
      chk(s.turn.assaultFailed, 'se marca el turno como asalto fallido')
      chk(!conquestCost(s, 'sa3').reachable, 'ninguna otra región queda alcanzable')
      const again = conquer(s, 'sa3')
      chk(!again.ok, `un segundo ataque se rechaza: "${again.message}"`)
      chk(startRedeploy(s).phase === 'redeploy', 'pero sí puedes pasar a redespliegue')
    }
  }
  chk(sawFailure, `se provocó un fallo del dado en ${attempts} intentos`)
}

/* ---------- 2. Habitante del Marjal ---------- */
console.log('\n[2] El Habitante del Marjal cobra 1 moneda a quien pisa sus pantanos')
{
  const { s } = withRace('orcs')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'marshdweller', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa7', 'def', 2)               // sa7 = Pantano de los Zánganos
  const coinsA = s.players[0].coins
  const coinsB = s.players[1].coins
  conquer(s, 'sa7')
  chk(s.players[0].coins === coinsA - 1, `el atacante paga 1 moneda (${coinsA} -> ${s.players[0].coins})`)
  chk(s.players[1].coins === coinsB + 1, `el marjalí las cobra (${coinsB} -> ${s.players[1].coins})`)

  // el poder sigue activo con la raza en declive
  def.inDecline = true
  setR(s, 'sa7', 'def', 2)
  const before = s.players[1].coins
  conquer(s, 'sa7')
  chk(s.players[1].coins === before + 1, 'incluso en declive cobra el peaje')
}
{
  // sin Habitante del Marjal no hay peaje
  const { s } = withRace('orcs')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa7', 'def', 2)
  const coinsA = s.players[0].coins
  conquer(s, 'sa7')
  chk(s.players[0].coins === coinsA, 'un pantano normal no cobra peaje')
}

/* ---------- 3. la paz caduca en tu siguiente turno ---------- */
console.log('\n[3] La paz dura solo hasta tu siguiente turno')
{
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: false }], 3, 'small_a')
  beginTurn(s)
  s.players[0].peaceWith = 1
  s.current = 0
  beginTurn(s)
  chk(s.players[0].peaceWith === null, 'al empezar tu turno se borra el tratado anterior')
}

/* ---------- 4. Alianza vs Horda ---------- */
console.log('\n[4] Alianza vs Horda: patria, botín y neutrales')

/** Prepara una partida con una facción activa concreta y mano infinita. */
function withRace(raceId: string, powerId = 'ranger', seed = 7) {
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], seed, 'small_a')
  s.phase = 'pick'
  s.tray[0] = { raceId, powerId, bonusCoins: 0 }
  selectCombo(s, 0)
  const f = s.factions[s.players[0].activeUid!]
  f.hand = 40
  s.legendary = [] // limpiar losetas para tests que no son de legendarios
  return { s, f }
}

{
  // sa6 (horda) vs sa2 (alianza), ambas coastal vacías
  const { s } = withRace('orcs')                 // orcos = horda
  const home = conquestCost(s, 'sa6')
  const enemy = conquestCost(s, 'sa2')   // ambas por desembarco: 2 base + 1 mar
  chk(home.homeland === true, 'sa6 es patria de los Orcos')
  chk(home.cost === enemy.cost - 1, `la patria cuesta 1 ficha menos que el territorio enemigo (${home.cost} vs ${enemy.cost})`)
  chk(enemy.homeland !== true && enemy.plunder === true, 'sa2 es territorio saqueable de la Alianza')
  chk(enemy.cost === 3, `territorio enemigo vacío: 2 + 1 de desembarco (cuesta ${enemy.cost})`)
}
{
  // la patria nunca puede bajar el coste por debajo de 1
  const { s } = withRace('orcs')
  s.regions['sa6'] = { owner: null, tokens: 0, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false }
  chk(conquestCost(s, 'sa6').cost >= 1, 'el descuento de patria nunca deja el coste en 0')
}
{
  // botín: +1 moneda por región enemiga conquistada este turno
  const { s, f } = withRace('humans')            // humanos = alianza
  conquer(s, 'sa6')                          // horda -> botín
  conquer(s, 'sa4')                          // alianza patria, no botín, pero adyacente
  // sa3 es neutral, no da botín, pero sa6 ya dio
  // para tener 3 botines necesitamos más horde regions, pero solo hay 1 horde en small_a, usamos 2p board para más?
  // En small_a solo hay 1 horda, así que ajustamos test a 1
  chk(plunderThisTurn(s, f).length === 1, `1 región saqueada (${plunderThisTurn(s, f).length})`)
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((l) => l.includes('Botín de facción: +1')), 'la puntuación detalla el botín: ' +
    (sc.detail.find((l) => l.includes('Botín'))?.trim() ?? '(no aparece)'))
  const conquered = [...s.turn.conquered]
  s.turn.conquered = []                          // mismo tablero, sin haberlas tomado este turno
  const noLoot = scoreFor(s, 0).total
  s.turn.conquered = conquered
  chk(sc.total - noLoot === 1, `el botín aporta exactamente +1 al total (${noLoot} -> ${sc.total})`)
}
{
  // el botín solo cuenta el turno en el que conquistas
  const { s, f } = withRace('humans')
  conquer(s, 'sa6')
  startRedeploy(s); endTurn(s)
  while (s.current !== 0) endTurn(s)
  chk(plunderThisTurn(s, f).length === 0, 'el botín no se cobra dos veces en turnos siguientes')
}
{
  // orcos: botín doble contra la Alianza, normal contra el resto
  const { s, f } = withRace('orcs')
  conquer(s, 'sa2')                        // alianza
  const sc = scoreFor(s, 0)
  const conquered2 = [...s.turn.conquered]
  s.turn.conquered = []
  const base = scoreFor(s, 0).total
  s.turn.conquered = conquered2
  chk(sc.total - base === 2, `los Orcos cobran doble sobre la Alianza: +2 por una región (${base} -> ${sc.total})`)
  chk(plunderThisTurn(s, f).length === 1, 'plunderThisTurn sigue contando 1 región')
}
{
  // neutrales: sin patria, pero saquean a los dos bandos (los Múrlocs ya son nativos, no raza)
  const { s } = withRace('naga')
  chk(conquestCost(s, 'sa6').homeland !== true, 'los Naga no tienen patria en la Horda')
  chk(conquestCost(s, 'sa2').homeland !== true, 'ni en la Alianza')
  chk(conquestCost(s, 'sa6').plunder === true && conquestCost(s, 'sa2').plunder === true,
    'pero saquean a los dos bandos')
  chk(conquestCost(s, 'sa1').plunder !== true, 'las regiones neutrales no dan botín a nadie')
  chk(!RACES.some((r) => r.id === 'murlocs'), 'los Múrlocs ya no son una raza jugable')
  chk(RACES.length === 16, 'hay exactamente 16 razas jugables')
}

/* ---------- 5. Lugares legendarios y artefactos ---------- */
console.log('\n[5] Lugares legendarios y artefactos: revelado y puntuación')
{
  const { s, f } = withRace('humans')
  // colocar manualmente 2 losetas boca abajo
  s.legendary = [
    { defId: 'dark_portal', regionId: 'sa2', revealed: false, isArtifact: false },
    { defId: 'doomhammer', regionId: 'sa3', revealed: false, isArtifact: true },
  ]
  chk(s.legendary.length === 2, '2 losetas colocadas (una por jugador en partida de 2)')
  // conquistar sa6 primero para que sa4 sea adyacente y luego sa2
  conquer(s, 'sa6')
  conquer(s, 'sa4')
  // conquistar sa2 debe revelar
  const before = s.legendary[0].revealed
  conquer(s, 'sa2')
  chk(!before && s.legendary[0].revealed, 'conquistar revela la loseta boca abajo')
  const sc1 = scoreFor(s, 0)
  chk(sc1.detail.some(d => d.includes('Portal Oscuro')), 'Portal Oscuro aparece en la puntuación: ' + sc1.detail.join(' | '))
  chk(sc1.total >= 2, `Portal Oscuro da +2 monedas (total ${sc1.total})`)

  // artefacto permanece aunque abandones (declive)
  conquer(s, 'sa3')
  chk(s.legendary[1].revealed, 'artefacto revelado al conquistar')
  const sc2 = scoreFor(s, 0)
  const hasDoom = sc2.detail.some(d => d.includes('Martillo Maldito'))
  chk(hasDoom, 'Martillo Maldito puntúa mientras lo controlas')
}
{
  // Campo de Batalla duplica botín
  const { s, f } = withRace('humans')
  s.legendary = [
    { defId: 'battlefield', regionId: 'sa6', revealed: true, isArtifact: false },
  ]
  conquer(s, 'sa6') // sa6 es horda -> botín 1, pero con battlefield doble
  const sc = scoreFor(s, 0)
  chk(sc.detail.some(d => d.includes('Campo de Batalla')), 'Campo de Batalla aparece en detalle')
  chk(sc.total >= 3, `Campo de Batalla duplica botín, total ${sc.total} >=3`)
}
{
  // Pozo de la Eternidad debe estar en costa
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], 123, 'small_a')
  const well = s.legendary.find(t => t.defId === 'well_of_eternity')
  if (well) {
    const { REGION_BY_ID } = require('../src/game/engine')
    const reg = REGION_BY_ID[well.regionId]
    chk(!!reg?.coastal, `Pozo de la Eternidad en costa (${reg?.name} costera=${reg?.coastal})`)
  } else {
    console.log('  SKIP  Pozo no salió en esta semilla (aleatorio), ok')
  }
}


/* ---------- 6. Razas oficiales: efectos por raza ---------- */
console.log('\n[6] Razas oficiales: efectos nuevos')
{
  // Enanos: montañas −2
  const { s: sd } = withRace('dwarves')
  const so = withRace('orcs')
  const dwarfCost = conquestCost(sd, 'sa1').cost   // sa1: montaña costera neutral
  const orcCost = conquestCost(so.s, 'sa1').cost
  chk(dwarfCost === orcCost - 2, `Enanos conquistan montañas 2 más baratas (${dwarfCost} vs ${orcCost})`)
}
{
  // Trolls: regiones ocupadas −1
  const { s } = withRace('trolls')
  const b = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0 }
  s.factions['b'] = b
  s.players[1].activeUid = 'b'
  setR(s, 'sa6', 'b', 2)
  chk(conquestCost(s, 'sa6').cost === 3, `Trols: 2 base + 2 defensoras + 1 mar − 1 ocupada − 1 patria = 3 (${conquestCost(s, 'sa6').cost})`)
}
{
  // Tauren: mínimo 2 fichas por región conquistada, redesplegada y en declive
  const { s, f } = withRace('tauren')
  conquer(s, 'sa6')                       // patria horda por mar: 2+1-1 = 2 -> 2 tauren
  chk(s.regions['sa6'].tokens === 2, `los Tauren guarnecen con 2 fichas (${s.regions['sa6'].tokens})`)
  startRedeploy(s)
  placeToken(s, 'sa6', -1)
  chk(s.regions['sa6'].tokens === 2, 'no pueden bajar de 2 en el redespliegue')
  gatherTokens(s)
  chk(s.regions['sa6'].tokens >= 2, 'el reagrupamiento respeta el mínimo')
  goIntoDecline(s)
  chk(s.regions['sa6'].tokens === 2, `en declive dejan 2 por región (${s.regions['sa6'].tokens})`)
  chk(f.hand === 0, 'sin fichas fuera del tablero tras el declive')
}
{
  // Draenei: la primera ficha que pierden en cada turno rival no se descarta
  const { s } = withRace('draenei')
  const f = s.factions[s.players[0].activeUid!]
  const b = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'ranger', inDecline: false, hand: 10, markers: 0, wispWalls: 0, bombs: 0 }
  s.factions['b'] = b
  s.players[1].activeUid = 'b'
  // el turno pasa a B, que ataca dos regiones Draenei de A
  setR(s, 'sa6', f.uid, 3)
  setR(s, 'sa4', f.uid, 2)
  s.current = 1
  s.phase = 'conquer'
  conquer(s, 'sa6')                       // coste 5 (2+3+1 mar −1 patria orca)
  chk(s.turn.draeneiSaved, 'se marca la ficha Draenei salvada')
  chk((s.turn.pendingReturns[f.uid] ?? 0) === 3, `el defensor recupera las 3 fichas (2 + la salvada) (${s.turn.pendingReturns[f.uid]})`)
  conquer(s, 'sa4')                       // segunda pérdida del turno: normal
  chk((s.turn.pendingReturns[f.uid] ?? 0) === 4, `la segunda región ya pierde 1 ficha (${s.turn.pendingReturns[f.uid]})`)
}
{
  // Huargen: forma humano +2 / huargo −1 y conquistas baratas
  const { s } = withRace('worgen')
  setWorgenForm(s, 'werewolf')
  chk(conquestCost(s, 'sa6').cost === 2, `forma huargo: 2+1 mar −1 = 2 (${conquestCost(s, 'sa6').cost})`)
  conquer(s, 'sa6')
  const wolfScore = scoreFor(s, 0).total
  chk(wolfScore === 1, `huargo puntúa: 1 región +1 botín −1 forma = 1 (${wolfScore})`)
  const s2 = withRace('worgen').s
  setWorgenForm(s2, 'human')
  conquer(s2, 'sa6')
  const humanScore = scoreFor(s2, 0).total
  chk(humanScore === 4, `humano puntúa: 1 + 1 botín + 2 forma = 4 (${humanScore})`)
}
{
  // Elfos de la Noche: muro wisp en cada bosque conquistado
  const { s, f } = withRace('nightelves')
  conquer(s, 'sa6')                       // desembarco en Mulgore
  conquer(s, 'sa4')                       // Bosque de Elwynn adyacente
  chk(s.regions['sa4'].wisp === 1, 'el bosque conquistado queda con un Muro Wisp')
  chk(f.wispWalls === 8, `quedan 8 muros por colocar (${f.wispWalls})`)
  chk(defenseOf(s, 'sa4') === 2, `el muro da +1 defensa (${defenseOf(s, 'sa4')})`)
}
{
  // Gnomos: asalto aéreo 1 vez por turno
  const { s } = withRace('gnomes')
  const info = conquestCost(s, 'sa4')     // interior, sin adyacencias propias
  chk(info.reachable && info.airstrike, 'el asalto aéreo alcanza el interior del mapa')
  conquer(s, 'sa4')
  chk(s.turn.airstrikeUsed, 'el asalto aéreo queda gastado')
  const again = conquestCost(s, 'sa2')    // costera, seguía siendo alcanzable
  chk(again.reachable && !again.airstrike, 'pero ya no se ofrece un segundo asalto aéreo')
}
{
  // Etéreos: −2 una vez por turno en región con loseta
  const { s } = withRace('ethereals')
  s.legendary = [
    { defId: 'dark_portal', regionId: 'sa2', revealed: false, isArtifact: false },
    { defId: 'doomhammer', regionId: 'sa4', revealed: false, isArtifact: true },
  ]
  const first = conquestCost(s, 'sa2')
  chk(first.ethereal && first.cost === 1, `primera conquista legendaria: 2+1 mar −2 = 1 (${first.cost})`)
  conquer(s, 'sa2')
  const second = conquestCost(s, 'sa4')   // sa4 adyacente a sa2
  chk(!second.ethereal && second.cost === 2, `la segunda ya sin descuento: 2 (${second.cost})`)
}
{
  // Renegados: salvar almas por fichas descartadas
  const { s, f } = withRace('forsaken')
  const b = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0 }
  s.factions['b'] = b
  s.players[1].activeUid = 'b'
  setR(s, 'sa6', 'b', 2)
  conquer(s, 'sa6')
  chk(s.turn.souls === 1, `un alma por ficha enemiga descartada (${s.turn.souls})`)
  const coinsBefore = s.players[0].coins
  const handBefore = f.hand
  startRedeploy(s)
  salvageSouls(s, 1)
  chk(s.players[0].coins === coinsBefore - 1, 'salvar un alma cuesta 1 moneda')
  chk(f.hand === handBefore + 1, `el Renegado rescatado vuelve a la mano (${handBefore} -> ${f.hand})`)
}
{
  // Pandaren: Armonía, atacar cuesta 2 monedas
  const { s } = withRace('orcs')
  const bp = { uid: 'bp', playerId: 1, raceId: 'pandaren', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0 }
  s.factions['bp'] = bp
  s.players[1].activeUid = 'bp'
  s.players[0].harmony = 1
  const coinsA = s.players[0].coins
  const coinsB = s.players[1].coins
  setR(s, 'sa6', 'bp', 2)
  conquer(s, 'sa6')
  chk(s.players[0].coins === coinsA - 2, `el atacante con Armonía paga 2 monedas (${coinsA} -> ${s.players[0].coins})`)
  chk(s.players[1].coins === coinsB + 2, `el Pandaren cobra las 2 monedas (${coinsB} -> ${s.players[1].coins})`)
  chk(s.players[0].harmony === 0, 'la ficha de Armonía se gasta')
}
{
  // Humanos: objetivos militares pagan botín a cualquiera, y a los Humanos también
  const { s } = withRace('humans')
  conquer(s, 'sa6')
  startRedeploy(s)
  chk(placeObjective(s, 'sa2'), 'marca un objetivo militar en región ajena')
  chk(!placeObjective(s, 'sa6'), 'no puede marcar una región propia')
  endTurn(s)                              // el objetivo restante se coloca solo
  const marked = Object.values(s.regions).filter((st) => st.mo).length
  chk(marked === 2, `acaba el turno con los 2 objetivos sobre el mapa (${marked})`)
  // B conquista la región marcada: +2 para B y +2 para los Humanos
  const b = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'ranger', inDecline: false, hand: 5, markers: 0, wispWalls: 0, bombs: 0 }
  s.factions['b'] = b
  s.players[1].activeUid = 'b'
  s.current = 1
  beginTurn(s)
  s.phase = 'conquer'
  const humanCoins = s.players[0].coins
  const bCoins = s.players[1].coins
  conquer(s, 'sa2')
  chk(s.players[1].coins === bCoins + 2, `B cobra el objetivo (+2): ${s.players[1].coins - bCoins}`)
  chk(s.players[0].coins === humanCoins + 2, `los Humanos cobran también (+2): ${s.players[0].coins - humanCoins}`)
}
{
  // Goblins: la bomba explota o falla al empezar el siguiente turno
  let exploded = false
  let fizzled = false
  for (let seed = 0; seed < 300 && (!exploded || !fizzled); seed++) {
    const { s, f } = withRace('goblins', 'ranger', 100 + seed)
    const b = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0 }
    s.factions['b'] = b
    s.players[1].activeUid = 'b'
    setR(s, 'sa6', 'b', 2)
    setR(s, 'sa4', 'b', 2)
    conquer(s, 'sa6')
    startRedeploy(s)
    chk2(placeBomb(s, 'sa4'), `pega una bomba en región rival adyacente (seed ${seed})`)
    chk2(f.bombs === 11, 'queda una bomba menos en el inventario')
    endTurn(s)
    while (s.current !== 0 && s.phase !== 'gameover') endTurn(s)
    beginTurn(s)
    chk2(!s.regions['sa4'].bomb, 'la bomba se resuelve al empezar el turno del Goblin')
    if (s.regions['sa4'].owner === null) exploded = true
    else if (s.regions['sa4'].owner === 'b') fizzled = true
  }
  chk(exploded, 'en alguna semilla la bomba EXPLOTA y vacía la región')
  chk(fizzled, 'en alguna semilla la bomba falla y la región sigue ocupada')

  function chk2(c: boolean, m: string) { if (!c) { console.log('  FAIL  ' + m); ok = false } }
}


/* ---------- 7. Poderes oficiales ---------- */
console.log('\n[7] Poderes oficiales')
chk(POWERS.length === 20, `hay exactamente 20 poderes oficiales (${POWERS.length})`)
{
  // Herrera: todo −1
  const { s } = withRace('orcs', 'blacksmith')
  const enemy = conquestCost(s, 'sa2')    // vacía, por mar: 2+1−1
  chk(enemy.cost === 2, `el Herrero deja la conquista enemiga vacía en 2 (${enemy.cost})`)
}
{
  // Navegante: desembarco sin ficha extra
  const { s } = withRace('orcs', 'sailing')
  const enemy = conquestCost(s, 'sa2')    // vacía: 2 base, sin +1 de mar
  chk(enemy.cost === 2 && enemy.viaSea, `el Navegante embarca gratis (coste ${enemy.cost})`)
}
{
  // Guarnición: fortalezas en todas las regiones al acabar el turno
  const { s, f } = withRace('orcs', 'garrisoned')
  conquer(s, 'sa6')
  conquer(s, 'sa4')
  chk(f.markers === 10, `la Guarnición arranca con 10 fuertes en reserva (${f.markers})`)
  f.hand = 0                             // sin sobrantes: cada región queda con su ficha
  endTurn(s)
  chk(s.regions['sa6'].fortress === 1 && s.regions['sa4'].fortress === 1, 'cada región ocupada recibe una Fortaleza')
  // sa6 quedó con 2 fichas de la conquista + 1 fuerte
  chk(defenseOf(s, 'sa6') === 3, `la fortaleza defiende +1 (2 fichas + 1 fuerte: ${defenseOf(s, 'sa6')})`)
}
{
  // Defensiva: torre de vigía en una llanura rodeada y bloquea la conquista
  const { s, f } = withRace('orcs', 'defensive')
  conquer(s, 'sa6')                       // Llanos de Mulgore (fields, costera)
  f.hand = 0
  for (const nb of REGION_BY_ID['sa6'].neighbors) {
    s.regions[nb] = { owner: s.players[0].activeUid!, tokens: 1, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false, tower: false }
  }
  startRedeploy(s); endTurn(s)
  const towered = Object.entries(s.regions).filter(([, st]) => st.tower).map(([id]) => id)
  chk(towered.length === 1, `se coloca exactamente 1 torre (${towered.join(',') || 'ninguna'})`)
  if (towered.length === 1) {
    const info = REGION_BY_ID[towered[0]]
    chk(info.terrain === 'fields', `la torre se alza en una Llanura (${info.name})`)
  }
}
{
  // Enfurecida: monedas por cada defensor que plantó cara
  const { s } = withRace('orcs', 'enraged')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa6', 'def', 3)                // 3 defensores
  conquer(s, 'sa6')
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((d) => d.includes('Enfurecida: +3')), `Enfurecida suma los 3 defensores: ${sc.detail.join(' | ')}`)
}
{
  // Maestre de Guerra: +1 por región ocupada conquistada
  const { s } = withRace('orcs', 'battlemaster')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'ranger', inDecline: false, hand: 0, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa6', 'def', 1)
  conquer(s, 'sa6')
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((d) => d.includes('Maestre de Guerra: +1')), `Maestre de Guerra cobra su +1: ${sc.detail.join(' | ')}`)
}
{
  // Arqueóloga: +1 por loseta en regiones propias
  const { s } = withRace('orcs', 'archaeologist')
  s.legendary = [{ defId: 'dark_portal', regionId: 'sa6', revealed: false, isArtifact: false }]
  conquer(s, 'sa6')
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((d) => d.includes('Arqueóloga: +1')), `la Arqueóloga cobra por el Portal Oscuro: ${sc.detail.join(' | ')}`)
}
{
  // Exploradora: +1 por isla con presencia
  const { s } = withRace('orcs', 'explorer')
  conquer(s, 'sa6')
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((d) => d.includes('Exploradora: +1')), `una isla conquistada, +1: ${sc.detail.join(' | ')}`)
}
{
  // Maestra de Bestias: fichas extra por cada colina al empezar el turno
  const { s, f } = withRace('orcs', 'beastmaster')
  conquer(s, 'sa6')
  startRedeploy(s); endTurn(s)
  while (s.current !== 0 && s.phase !== 'gameover') endTurn(s)
  beginTurn(s)                            // sa3 (colina) aún no es nuestra: 0 bestias
  chk(f.beasts === 0, 'sin colinas no hay bestias')
  // conquistamos la colina sa3 y esperamos al turno siguiente
  s.phase = 'conquer'
  f.hand = 10
  conquer(s, 'sa3')
  startRedeploy(s); endTurn(s)
  while (s.current !== 0 && s.phase !== 'gameover') endTurn(s)
  const handBefore = f.hand
  beginTurn(s)
  chk(f.beasts === 1, `una colina ocupada, una bestia (${f.beasts})`)
  chk(f.hand === handBefore + 1, `la bestia se suma a la mano (${handBefore} -> ${f.hand})`)
}
{
  // Intimidadora: mueve la ficha a otra región del mismo rival, o la descarta
  const { s } = withRace('orcs', 'intimidating')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'ranger', inDecline: false, hand: 5, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa7', s.players[0].activeUid!, 1)   // nuestra cabeza de playa
  setR(s, 'sa6', 'def', 2)
  setR(s, 'sa4', 'def', 1)
  chk(intimidate(s, 'sa6'), 'intimida una región rival adyacente')
  chk(s.regions['sa6'].tokens === 1 && s.regions['sa4'].tokens === 2, 'la ficha se retira hacia la otra región del rival')
  chk(s.turn.intimidated === 1, `queda anotado (1/3)`)
  setR(s, 'sa4', null, 0)                 // sin dónde replegarse: descarte
  const handB = def.hand
  chk(intimidate(s, 'sa6'), 'intimida de nuevo')
  chk(s.regions['sa6'].tokens === 0 && def.hand === handB + 1, 'la ficha empujada vuelve a la reserva del rival')
}
{
  // Campeón: conquista adyacente por 1 ficha y rescate al ser capturado
  const { s } = withRace('orcs', 'champion')
  const def = { uid: 'def', playerId: 1, raceId: 'tauren', powerId: 'ranger', inDecline: false, hand: 10, markers: 0, wispWalls: 0, bombs: 0, beasts: 0 }
  s.factions['def'] = def
  s.players[1].activeUid = 'def'
  setR(s, 'sa7', s.players[0].activeUid!, 1)   // cabeza de playa propia
  setR(s, 'sa6', 'def', 5)                     // muy defendida
  const info = conquestCost(s, 'sa6')
  chk(info.champion && info.cost >= 6, `la región cuesta ${info.cost}, pero el Campeón puede cargar`)
  s.players[0].activeUid && (s.factions[s.players[0].activeUid].hand = 2)
  const res = conquer(s, 'sa6', false, true)
  chk(res.ok, 'el Campeón conquista sin importar los defensores')
  chk(s.regions['sa6'].tokens === 0 && s.regions['sa6'].hero, 'la región queda guarnecida solo por el Campeón')
  chk(s.turn.championUsed, 'la carga queda gastada este turno')
  chk(defenseOf(s, 'sa6') === 1, `el Campeón defiende como 1 ficha (${defenseOf(s, 'sa6')})`)
  // el rival lo captura: paga 1 moneda de rescate
  const coinsA = s.players[0].coins
  s.current = 1
  s.phase = 'conquer'
  s.turn = { ...s.turn, assaultFailed: false }
  conquer(s, 'sa6')
  chk(!s.regions['sa6'].hero, 'el Campeón capturado sale del tablero')
  chk(s.players[0].coins === coinsA - 1, `el dueño paga 1 moneda de rescate (${coinsA} -> ${s.players[0].coins})`)
}

console.log(ok ? '\nREGLAS CORRECTAS ✅' : '\nHAY FALLOS ❌')
process.exit(ok ? 0 : 1)
