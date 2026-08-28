import {
  REGION_BY_ID, autoRedeploy, canDeclineNow, comboTokens, conquer, conquestCost,
  ctxOf, diplomacyOptions, endTurn, goIntoDecline, legalTargets, needsDiplomacy,
  ownerPlayer, placeMarker, regionsOf, scoreFor, selectCombo, setPeace, startRedeploy, sideOf } from '../game/engine'
import { RACE_BY_ID, POWER_BY_ID, isEnemyRegion } from '../game/abilities'
import type { GameState } from '../game/types'

export type BotAction =
  | { kind: 'pick'; index: number; label: string }
  | { kind: 'conquer'; regionId: string; useDie: boolean; label: string }
  | { kind: 'marker'; regionId: string; label: string }
  | { kind: 'decline'; label: string }
  | { kind: 'peace'; targetId: number; label: string }
  | { kind: 'endTurn'; label: string }

/** value of holding a region for this faction, ignoring conquest cost */
function regionValue(state: GameState, regionId: string, uid: string): number {
  const r = REGION_BY_ID[regionId]
  const f = state.factions[uid]
  const ctx = ctxOf(state, f)
  let v = 1
  const race = RACE_BY_ID[f.raceId]
  const power = POWER_BY_ID[f.powerId]
  for (const a of [race, power]) {
    if (!a?.scoreBonus) continue
    // marginal value: score with this region added
    const before = a.scoreBonus(ctx)
    const after = a.scoreBonus({ ...ctx, owned: [...ctx.owned, r] })
    v += after - before
  }
  // faction warfare: plundering the enemy flag is worth a coin this turn
  if (isEnemyRegion(sideOf(f), r)) v += f.raceId === 'orcs' && r.faction === 'alliance' ? 2 : 1
  if (r.landmark) v += 0.3
  if (r.mountain) v += 0.2 // easier to defend
  // clustering bonus: adjacency to our own regions is safer
  const mine = r.neighbors.filter((n) => state.regions[n].owner === uid).length
  v += mine * 0.15
  return v
}

export function chooseAction(state: GameState): BotAction {
  const player = state.players[state.current]

  if (state.phase === 'pick') {
    let bestIdx = 0
    let bestScore = -Infinity
    state.tray.forEach((c, i) => {
      const race = RACE_BY_ID[c.raceId]
      const power = POWER_BY_ID[c.powerId]
      if (!race || !power) return
      const tokens = comboTokens(c)
      let s = tokens * 1.0 + c.bonusCoins * 0.8 - i * 0.6
      // late in the game fewer tokens matter, scoring powers matter more
      const remaining = state.maxRounds - state.round
      if (remaining <= 2) s += 3 - tokens * 0.4
      if (power.scoreBonus || race.scoreBonus) s += 2
      if (power.ignoresAdjacency || race.ignoresAdjacency) s += 1.5
      if (c.powerId === 'wealthy' && remaining <= 1) s += 5
      if (player.coins < i) s = -Infinity
      if (s > bestScore) { bestScore = s; bestIdx = i }
    })
    return { kind: 'pick', index: bestIdx, label: `elige la combinación #${bestIdx + 1}` }
  }

  if (state.phase !== 'conquer') return { kind: 'endTurn', label: 'termina el turno' }

  const uid = player.activeUid
  if (!uid) return { kind: 'endTurn', label: 'termina el turno' }
  const f = state.factions[uid]
  const owned = regionsOf(state, uid)

  // should we go into decline instead of fighting?
  if (canDeclineNow(state) && state.turn.conquered.length === 0) {
    const remaining = state.maxRounds - state.round
    const cheapest = legalTargets(state).map((t) => t.cost).sort((a, b) => a - b)
    let budget = f.hand
    let expected = 0
    for (const c of cheapest) {
      if (budget < c) break
      budget -= c
      expected++
    }
    // a race that can barely grow any more is worth trading for a fresh one
    if (remaining >= 2 && expected <= 1 && owned.length <= 8) {
      return { kind: 'decline', label: 'manda su raza al declive' }
    }
  }

  // place heroes / fortresses on the juiciest frontier region
  if (f.markers > 0 && owned.length) {
    const target = [...owned].sort((a, b) => {
      const threat = (r: typeof a) =>
        r.neighbors.filter((n) => {
          const o = state.regions[n].owner
          return o && ownerPlayer(state, o) !== player.id
        }).length
      return threat(b) - threat(a)
    })[0]
    const st = state.regions[target.id]
    if ((f.powerId === 'heroic' && !st.hero) || (f.powerId === 'fortified' && st.fortress === 0)) {
      return { kind: 'marker', regionId: target.id, label: `refuerza ${target.name}` }
    }
  }

  const targets = legalTargets(state)
    .map((t) => ({ ...t, value: regionValue(state, t.id, uid) }))
    .map((t) => ({ ...t, ratio: t.value / Math.max(1, t.cost) }))
    .sort((a, b) => b.ratio - a.ratio)

  const affordable = targets.filter((t) => t.cost <= f.hand)
  if (affordable.length) {
    const best = affordable[0]
    // don't overextend: keep enough tokens to hold what we have late in the turn
    const leftAfter = f.hand - best.cost
    const needed = owned.length + 1
    if (leftAfter >= 0 && (best.ratio > 0.35 || leftAfter >= needed)) {
      return { kind: 'conquer', regionId: best.id, useDie: false, label: `ataca ${REGION_BY_ID[best.id].name}` }
    }
  }

  // last stand: try the reinforcement die on a cheap target
  const maxDice = 1 + (f.powerId === 'berserk' ? 1 : 0)
  if (state.turn.diceUsed < maxDice && f.hand >= 1) {
    const gamble = targets
      .filter((t) => t.cost <= f.hand + 3 && t.cost > f.hand)
      .sort((a, b) => a.cost - b.cost)[0]
    if (gamble && gamble.cost - f.hand <= 2) {
      return { kind: 'conquer', regionId: gamble.id, useDie: true, label: `lanza el dado sobre ${REGION_BY_ID[gamble.id].name}` }
    }
  }

  // sign peace with whoever is best placed to hurt us next turn
  if (needsDiplomacy(state)) {
    const opts = diplomacyOptions(state)
    const contact = (pid: number) =>
      owned.reduce(
        (n, r) => n + r.neighbors.filter((x) => ownerPlayer(state, state.regions[x].owner) === pid).length,
        0,
      )
    const best = opts.reduce((a, b) => {
      const da = contact(a) * 3 + state.players[a].coins / 10
      const db = contact(b) * 3 + state.players[b].coins / 10
      return db > da ? b : a
    })
    return { kind: 'peace', targetId: best, label: `firma la paz con ${state.players[best].name}` }
  }

  return { kind: 'endTurn', label: 'termina el turno' }
}

/** applies one bot action; returns a human readable description */
export function applyBotAction(state: GameState, action: BotAction): string {
  switch (action.kind) {
    case 'pick':
      selectCombo(state, action.index)
      return action.label
    case 'conquer': {
      const res = conquer(state, action.regionId, action.useDie)
      return res.ok ? action.label : `${action.label} — ${res.message}`
    }
    case 'marker':
      placeMarker(state, action.regionId)
      return action.label
    case 'peace':
      setPeace(state, action.targetId)
      return action.label
    case 'decline':
      goIntoDecline(state)
      endTurn(state)
      return action.label
    case 'endTurn':
      startRedeploy(state)
      autoRedeploy(state)
      endTurn(state)
      return action.label
  }
}

export { scoreFor, conquestCost }
