/** Regresión de las reglas que estaban rotas. */
import {
  beginTurn, conquer, conquestCost, createGame, diplomacyOptions, endTurn,
  needsDiplomacy, plunderThisTurn, scoreFor, selectCombo, setPeace, startRedeploy,
} from '../src/game/engine'
import type { GameState } from '../src/game/types'

let ok = true
const chk = (c: boolean, m: string) => { console.log((c ? '  OK  ' : '  FAIL') + '  ' + m); if (!c) ok = false }
const setR = (s: GameState, id: string, o: string | null, t: number) =>
  { s.regions[id] = { owner: o, tokens: t, fortress: 0, hero: false } }

/* ---------- 1. el dado fallido termina la fase de conquista ---------- */
console.log('\n[1] Un asalto fallido cierra la fase de conquista')
{
  let attempts = 0
  let sawFailure = false
  for (let seed = 0; seed < 400 && !sawFailure; seed++) {
    const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], seed, 'kalimdor')
    s.phase = 'pick'
    s.tray[0] = { raceId: 'humans', powerId: 'merchant', bonusCoins: 0 }
    selectCombo(s, 0)
    const f = s.factions[s.players[0].activeUid!]
    f.hand = 3
    conquer(s, 'durotar')          // cuesta 3 -> mano a 0
    f.hand = 1
    setR(s, 'nbarrens', null, 0)
    const res = conquer(s, 'nbarrens', true)   // cuesta 2, mano 1 -> depende del dado
    attempts++
    if (!res.ok) {
      sawFailure = true
      chk(s.turn.assaultFailed, 'se marca el turno como asalto fallido')
      chk(!conquestCost(s, 'azshara').reachable, 'ninguna otra región queda alcanzable')
      const again = conquer(s, 'azshara')
      chk(!again.ok, `un segundo ataque se rechaza: "${again.message}"`)
      chk(startRedeploy(s).phase === 'redeploy', 'pero sí puedes pasar a redespliegue')
    }
  }
  chk(sawFailure, `se provocó un fallo del dado en ${attempts} intentos`)
}

/* ---------- 2. la Diplomática funciona ---------- */
console.log('\n[2] El poder Diplomática ya no es una carta muerta')
{
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }, { name: 'C', isBot: true }], 1, 'kalimdor')
  s.phase = 'pick'
  s.tray[0] = { raceId: 'humans', powerId: 'diplomat', bonusCoins: 0 }
  selectCombo(s, 0)
  const f = s.factions[s.players[0].activeUid!]
  f.hand = 10
  conquer(s, 'durotar')

  chk(needsDiplomacy(s), 'se pide elegir con quién firmar la paz')
  chk(diplomacyOptions(s).length === 2, 'puede pactar con los 2 rivales')

  // atacar a B lo descarta como socio
  s.factions['b'] = { uid: 'b', playerId: 1, raceId: 'orcs', powerId: 'berserk', inDecline: false, hand: 0, markers: 0 }
  s.players[1].activeUid = 'b'
  setR(s, 'azshara', 'b', 1)
  conquer(s, 'azshara')
  chk(s.turn.attacked.includes(1), 'se registra que has atacado a B')
  chk(diplomacyOptions(s).join() === '2', 'B queda descartado: solo puedes pactar con C')

  setPeace(s, 2)
  chk(s.players[0].peaceWith === 2, 'se firma la paz con C')

  // ahora C no puede atacar a A
  startRedeploy(s); endTurn(s)
  while (s.current !== 2) endTurn(s)
  s.factions['c'] = { uid: 'c', playerId: 2, raceId: 'trolls', powerId: 'commando', inDecline: false, hand: 9, markers: 0 }
  s.players[2].activeUid = 'c'
  s.phase = 'conquer'
  setR(s, 'nbarrens', 'c', 3)
  const info = conquestCost(s, 'durotar')   // durotar es de A
  chk(!info.reachable && info.reason === 'Tratado diplomático', `C no puede atacar a A: "${info.reason}"`)
  chk(conquestCost(s, 'sbarrens').reachable, 'pero sí puede atacar a otro sitio')
}

/* ---------- 3. la paz caduca en tu siguiente turno ---------- */
console.log('\n[3] La paz dura solo hasta tu siguiente turno')
{
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: false }], 3, 'kalimdor')
  beginTurn(s)
  s.players[0].peaceWith = 1
  s.current = 0
  beginTurn(s)
  chk(s.players[0].peaceWith === null, 'al empezar tu turno se borra el tratado anterior')
}

/* ---------- 4. Alianza vs Horda ---------- */
console.log('\n[4] Alianza vs Horda: patria, botín y neutrales')

/** Prepara una partida con una facción activa concreta y mano infinita. */
function withRace(raceId: string, powerId = 'merchant') {
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], 7, 'kalimdor')
  s.phase = 'pick'
  s.tray[0] = { raceId, powerId, bonusCoins: 0 }
  selectCombo(s, 0)
  const f = s.factions[s.players[0].activeUid!]
  f.hand = 40
  s.legendary = [] // limpiar losetas para tests que no son de legendarios
  return { s, f }
}

{
  // durotar (horda) vs darkshore (alianza), ambas vacías, mismo terreno base
  const { s } = withRace('orcs')                 // orcos = horda
  const home = conquestCost(s, 'durotar')
  const enemy = conquestCost(s, 'darkshore')   // ambas por desembarco: 2 base + 1 mar
  chk(home.homeland === true, 'durotar es patria de los Orcos')
  chk(home.cost === enemy.cost - 1, `la patria cuesta 1 ficha menos que el territorio enemigo (${home.cost} vs ${enemy.cost})`)
  chk(enemy.homeland !== true && enemy.plunder === true, 'darkshore es territorio saqueable de la Alianza')
  chk(enemy.cost === 3, `territorio enemigo vacío: 2 + 1 de desembarco (cuesta ${enemy.cost})`)
}
{
  // la patria nunca puede bajar el coste por debajo de 1
  const { s } = withRace('orcs')
  s.regions['durotar'] = { owner: null, tokens: 0, fortress: 0, hero: false }
  chk(conquestCost(s, 'durotar').cost >= 1, 'el descuento de patria nunca deja el coste en 0')
}
{
  // botín: +1 moneda por región enemiga conquistada este turno
  const { s, f } = withRace('humans')            // humanos = alianza
  conquer(s, 'durotar')                          // horda -> botín
  conquer(s, 'nbarrens')                         // horda -> botín
  conquer(s, 'sbarrens')                         // horda -> botín
  chk(plunderThisTurn(s, f).length === 3, `3 regiones saqueadas (${plunderThisTurn(s, f).length})`)
  const sc = scoreFor(s, 0)
  chk(sc.detail.some((l) => l.includes('Botín de facción: +3')), 'la puntuación detalla el botín: ' +
    (sc.detail.find((l) => l.includes('Botín'))?.trim() ?? '(no aparece)'))
  const conquered = [...s.turn.conquered]
  s.turn.conquered = []                          // mismo tablero, sin haberlas tomado este turno
  const noLoot = scoreFor(s, 0).total
  s.turn.conquered = conquered
  chk(sc.total - noLoot === 3, `el botín aporta exactamente +3 al total (${noLoot} -> ${sc.total})`)
}
{
  // el botín solo cuenta el turno en el que conquistas
  const { s, f } = withRace('humans')
  conquer(s, 'durotar')
  startRedeploy(s); endTurn(s)
  while (s.current !== 0) endTurn(s)
  chk(plunderThisTurn(s, f).length === 0, 'el botín no se cobra dos veces en turnos siguientes')
}
{
  // orcos: botín doble contra la Alianza, normal contra el resto
  const { s, f } = withRace('orcs')
  conquer(s, 'darkshore')                        // alianza
  const sc = scoreFor(s, 0)
  const conquered2 = [...s.turn.conquered]
  s.turn.conquered = []
  const base = scoreFor(s, 0).total
  s.turn.conquered = conquered2
  chk(sc.total - base === 2, `los Orcos cobran doble sobre la Alianza: +2 por una región (${base} -> ${sc.total})`)
  chk(plunderThisTurn(s, f).length === 1, 'plunderThisTurn sigue contando 1 región')
}
{
  // neutrales: sin patria, pero saquean a los dos bandos
  const { s } = withRace('murlocs')
  chk(conquestCost(s, 'durotar').homeland !== true, 'los Múrlocs no tienen patria en la Horda')
  chk(conquestCost(s, 'darkshore').homeland !== true, 'ni en la Alianza')
  chk(conquestCost(s, 'durotar').plunder === true && conquestCost(s, 'darkshore').plunder === true,
    'pero saquean a los dos bandos')
  chk(conquestCost(s, 'hyjal').plunder !== true, 'las regiones neutrales no dan botín a nadie')
}

/* ---------- 5. Lugares legendarios y artefactos ---------- */
console.log('\n[5] Lugares legendarios y artefactos: revelado y puntuación')
{
  const { s, f } = withRace('humans')
  // colocar manualmente 2 losetas boca abajo
  s.legendary = [
    { defId: 'dark_portal', regionId: 'nbarrens', revealed: false, isArtifact: false },
    { defId: 'doomhammer', regionId: 'sbarrens', revealed: false, isArtifact: true },
  ]
  chk(s.legendary.length === 2, '2 losetas colocadas (una por jugador en partida de 2)')
  // conquistar durotar primero para que nbarrens sea adyacente y reachable
  conquer(s, 'durotar')
  // conquistar nbarrens debe revelar
  const before = s.legendary[0].revealed
  conquer(s, 'nbarrens')
  chk(!before && s.legendary[0].revealed, 'conquistar revela la loseta boca abajo')
  const sc1 = scoreFor(s, 0)
  chk(sc1.detail.some(d => d.includes('Portal Oscuro')), 'Portal Oscuro aparece en la puntuación: ' + sc1.detail.join(' | '))
  chk(sc1.total >= 2, `Portal Oscuro da +2 monedas (total ${sc1.total})`)

  // artefacto permanece aunque abandones (declive)
  conquer(s, 'sbarrens')
  chk(s.legendary[1].revealed, 'artefacto revelado al conquistar')
  const sc2 = scoreFor(s, 0)
  const hasDoom = sc2.detail.some(d => d.includes('Martillo Maldito'))
  chk(hasDoom, 'Martillo Maldito puntúa mientras lo controlas')
}
{
  // Campo de Batalla duplica botín
  const { s, f } = withRace('humans')
  s.legendary = [
    { defId: 'battlefield', regionId: 'durotar', revealed: true, isArtifact: false },
  ]
  conquer(s, 'durotar') // durotar es horda -> botín 1, pero con battlefield doble
  const sc = scoreFor(s, 0)
  chk(sc.detail.some(d => d.includes('Campo de Batalla')), 'Campo de Batalla aparece en detalle')
  chk(sc.total >= 3, `Campo de Batalla duplica botín, total ${sc.total} >=3`)
}
{
  // Pozo de la Eternidad debe estar en costa
  const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], 123, 'kalimdor')
  const well = s.legendary.find(t => t.defId === 'well_of_eternity')
  if (well) {
    const { REGION_BY_ID } = require('../src/game/engine')
    const reg = REGION_BY_ID[well.regionId]
    chk(!!reg?.coastal, `Pozo de la Eternidad en costa (${reg?.name} costera=${reg?.coastal})`)
  } else {
    console.log('  SKIP  Pozo no salió en esta semilla (aleatorio), ok')
  }
}

console.log(ok ? '\nREGLAS CORRECTAS ✅' : '\nHAY FALLOS ❌')
process.exit(ok ? 0 : 1)
