/** Regresión de las reglas que estaban rotas. */
import {
  beginTurn, conquer, conquestCost, createGame, diplomacyOptions, endTurn,
  needsDiplomacy, selectCombo, setPeace, startRedeploy,
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

console.log(ok ? '\nREGLAS CORRECTAS ✅' : '\nHAY FALLOS ❌')
process.exit(ok ? 0 : 1)
