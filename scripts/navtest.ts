/** Reproduce la máquina de pasos del tutorial sin React para comprobar
 *  que ir hacia atrás rebobina el tablero y no se auto-avanza al llegar. */
import { createGame, selectCombo, conquer } from '../src/game/engine'
import { STEPS } from '../src/ui/Tutorial'
import type { GameState } from '../src/game/types'

let ok = true
const chk = (c: boolean, m: string) => { console.log((c ? '  OK  ' : '  FAIL') + '  ' + m); if (!c) ok = false }

const snaps: Record<number, GameState> = {}
let armed = true
let step = 0
let state = createGame([{ name: 'Tú', isBot: false }, { name: 'Horda', isBot: true }], 20260828, 'small_a')
state.phase = 'pick'

function enterStep(i: number, back = false) {
  const t = STEPS[i]
  let next: GameState
  if (back && snaps[i]) next = structuredClone(snaps[i])
  else { next = structuredClone(state); t.setup?.(next); snaps[i] = structuredClone(next) }
  armed = !(t.done?.(next) ?? false)
  state = next
  step = i
}
const tick = () => { if (armed && STEPS[step].done?.(state)) { armed = false; return true } return false }

enterStep(0)
enterStep(1); enterStep(2)
chk(STEPS[2].id === 'pick', 'paso 3 es "elegir raza"')
chk(!state.players[0].activeUid, 'al llegar, aún no hay raza elegida')
chk(!tick(), 'no auto-avanza al entrar')

selectCombo(state, 0)
chk(!!state.players[0].activeUid, 'el jugador elige Humanos Mercaderes')
chk(tick(), 'ahora sí avanza, porque la meta se cumplió DURANTE el paso')

enterStep(3)
chk(STEPS[3].id === 'firstconquest', 'pasa a "primera conquista"')

// ---- el bug reportado: volver atrás al paso de elegir raza ----
enterStep(2, true)
chk(step === 2, 'volvemos al paso de elegir raza')
chk(!state.players[0].activeUid, 'REBOBINA: la raza vuelve a estar sin elegir')
chk(state.tray.length >= 3 && state.tray[0].raceId === 'humans', 'la bandeja vuelve a estar disponible')
chk(!tick(), 'NO auto-avanza al volver atrás  <-- el bug corregido')

selectCombo(state, 0)
chk(tick(), 'si vuelves a elegir, avanza con normalidad')

// ---- rebobinar una conquista ----
enterStep(3)
const f = state.factions[state.players[0].activeUid!]
if (f) f.hand = 9
snaps[3] = structuredClone(state)
conquer(state, 'sa6')
chk(state.regions['sa6'].owner === f.uid, 'conquista Llanos Mulgore')
enterStep(4); enterStep(3, true)
chk(state.regions['sa6'].owner === null, 'REBOBINA: Llanos Mulgore vuelve a estar vacía')
chk(!tick(), 'y tampoco auto-avanza')

// ---- recorrer todos los pasos adelante sin romperse ----
snaps[0] = undefined as never
let s2 = createGame([{ name: 'Tú', isBot: false }, { name: 'H', isBot: true }], 7, 'small_a')
s2.phase = 'pick'
for (let i = 0; i < STEPS.length; i++) {
  try { STEPS[i].setup?.(s2); STEPS[i].spotlight?.(s2); STEPS[i].done?.(s2) }
  catch (e) { chk(false, `paso ${i + 1} "${STEPS[i].id}" lanza error: ${e}`) }
}
chk(true, `los ${STEPS.length} pasos se preparan sin errores`)

console.log(ok ? '\nNAVEGACIÓN CORRECTA ✅' : '\nHAY FALLOS ❌')
process.exit(ok ? 0 : 1)
