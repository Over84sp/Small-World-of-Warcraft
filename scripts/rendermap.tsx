import React from 'react'
/** Renderiza el mapa a SVG estático para revisar el arte sin abrir el navegador. */
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'node:fs'
import { createGame } from '../src/game/engine'
import { MapView } from '../src/ui/MapView'
import { conquer, selectCombo } from '../src/game/engine'

const s = createGame([{ name: 'A', isBot: false }, { name: 'B', isBot: true }], 20260828, process.env.BOARD ?? 'kalimdor')
s.phase = 'pick'
s.tray[0] = { raceId: 'humans', powerId: 'fortified', bonusCoins: 0 }
selectCombo(s, 0)
const f = s.factions[s.players[0].activeUid!]
f.hand = 30
for (const id of (process.env.BOARD === 'azeroth' ? ['durotar','azshara','hyjal','tirisfal','silverpine'] : ['durotar','azshara','hyjal'])) conquer(s, id)
s.regions['durotar'].fortress = 1
s.regions['azshara'].hero = true
s.factions['x'] = { uid: 'x', playerId: 1, raceId: 'orcs', powerId: 'berserk', inDecline: false, hand: 0, markers: 0 }
s.players[1].activeUid = 'x'
s.regions['nbarrens'] = { owner: 'x', tokens: 3, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false }
if (process.env.BOARD === 'azeroth') { s.regions['elwynn'] = { owner: 'x', tokens: 2, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false }; s.regions['duskwood'] = { owner: 'x', tokens: 4, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false } }
s.regions['mulgore'] = { owner: 'x', tokens: 2, fortress: 0, hero: false, wisp: 0, bomb: false, mo: false }

const html = renderToStaticMarkup(
  <MapView state={s} selected={null} onSelect={() => {}} highlightTargets markerMode={false} compact={false} />,
)
const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6)
  .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1100"')
writeFileSync(process.env.OUT ?? '/home/user/map-art.svg', svg)
console.log('escrito /home/user/map-art.svg', svg.length, 'bytes')
