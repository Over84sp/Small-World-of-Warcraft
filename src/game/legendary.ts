import type { GameState, RegionData } from './types'

export type LegendaryEffectKind =
  | { kind: 'flat'; value: number }
  | { kind: 'per_other_same_terrain' }
  | { kind: 'double_faction' }
  | { kind: 'per_adjacent' }
  | { kind: 'per_mountain' }
  | { kind: 'per_coastal' }
  | { kind: 'per_plunder' }
  | { kind: 'per_fortress' }
  | { kind: 'per_5_regions'; value: number }

export interface LegendaryDef {
  id: string
  name: string
  isArtifact: boolean
  lore: string
  effectDesc: string
  effect: LegendaryEffectKind
  mustBeCoastal?: boolean
  icon: 'place' | 'artifact'
}

export const LEGENDARY_DEFS: LegendaryDef[] = [
  // 7 Lugares legendarios
  {
    id: 'karazhan',
    name: 'Karazhan',
    isArtifact: false,
    lore: 'Torre del Guardián, llena de ecos arcanos.',
    effectDesc: '+1 por cada otra región tuya del mismo terreno que Karazhan',
    effect: { kind: 'per_other_same_terrain' },
    icon: 'place',
  },
  {
    id: 'dark_portal',
    name: 'Portal Oscuro',
    isArtifact: false,
    lore: 'La puerta entre mundos, siempre hambrienta.',
    effectDesc: '+2 monedas',
    effect: { kind: 'flat', value: 2 },
    icon: 'place',
  },
  {
    id: 'battlefield',
    name: 'Campo de Batalla',
    isArtifact: false,
    lore: 'Donde Alianza y Horda miden su odio.',
    effectDesc: 'Tu botín de facción cuenta doble',
    effect: { kind: 'double_faction' },
    icon: 'place',
  },
  {
    id: 'well_of_eternity',
    name: 'Pozo de la Eternidad',
    isArtifact: false,
    lore: 'Debe estar junto al mar. Las mareas lo arrastran a la costa.',
    effectDesc: '+3 monedas. Siempre en costa',
    effect: { kind: 'flat', value: 3 },
    mustBeCoastal: true,
    icon: 'place',
  },
  {
    id: 'frozen_throne',
    name: 'Trono Helado',
    isArtifact: false,
    lore: 'El frío conquista lo adyacente.',
    effectDesc: '+1 por cada región adyacente que controles',
    effect: { kind: 'per_adjacent' },
    icon: 'place',
  },
  {
    id: 'black_temple',
    name: 'Templo Oscuro',
    isArtifact: false,
    lore: 'Cada montaña bajo tu control susurra poder.',
    effectDesc: '+1 por cada montaña que controles',
    effect: { kind: 'per_mountain' },
    icon: 'place',
  },
  {
    id: 'world_tree',
    name: 'Árbol del Mundo',
    isArtifact: false,
    lore: 'Cuanto más creces, más te nutre.',
    effectDesc: '+1 +1 por cada 3 regiones',
    effect: { kind: 'per_5_regions', value: 1 },
    icon: 'place',
  },
  // 5 Artefactos
  {
    id: 'doomhammer',
    name: 'Martillo Maldito',
    isArtifact: true,
    lore: 'Pesa, pero paga. Se queda aunque abandones.',
    effectDesc: '+2 monedas. Artefacto: permanece',
    effect: { kind: 'flat', value: 2 },
    icon: 'artifact',
  },
  {
    id: 'frostmourne',
    name: 'Filoescarcha',
    isArtifact: true,
    lore: 'Hambre de botín.',
    effectDesc: '+1 extra por cada región saqueada este turno',
    effect: { kind: 'per_plunder' },
    icon: 'artifact',
  },
  {
    id: 'ashbringer',
    name: 'Crematoria',
    isArtifact: true,
    lore: 'Brilla donde hay fortalezas y héroes.',
    effectDesc: '+1 por cada fortaleza/héroe',
    effect: { kind: 'per_fortress' },
    icon: 'artifact',
  },
  {
    id: 'eye_of_sargeras',
    name: 'Ojo de Sargeras',
    isArtifact: true,
    lore: 'Ve todas las costas.',
    effectDesc: '+1 por cada costa que controles',
    effect: { kind: 'per_coastal' },
    icon: 'artifact',
  },
  {
    id: 'heart_of_azeroth',
    name: 'Corazón de Azeroth',
    isArtifact: true,
    lore: 'Late con el mundo.',
    effectDesc: '+1, +1 extra si controlas 5+ regiones',
    effect: { kind: 'per_5_regions', value: 1 },
    icon: 'artifact',
  },
]

export const LEGENDARY_BY_ID: Record<string, LegendaryDef> = Object.fromEntries(
  LEGENDARY_DEFS.map((d) => [d.id, d])
)

export function computeLegendaryBonus(
  state: GameState,
  playerId: number,
  tileRegionId: string,
  def: LegendaryDef,
  regionById: Record<string, RegionData>
): number {
  const player = state.players[playerId]
  if (!player) return 0
  const ownedRegionIds = new Set<string>()
  for (const fid of [player.activeUid, player.declineUid]) {
    if (!fid) continue
    const f = state.factions[fid]
    if (!f) continue
    for (const [rid, rs] of Object.entries(state.regions)) {
      if (rs.owner === f.uid) ownedRegionIds.add(rid)
    }
  }
  const ownedCount = ownedRegionIds.size

  switch (def.effect.kind) {
    case 'flat':
      return def.effect.value
    case 'per_other_same_terrain': {
      const center = regionById[tileRegionId]
      if (!center) return 0
      let c = 0
      for (const rid of ownedRegionIds) {
        if (rid === tileRegionId) continue
        const rd = regionById[rid]
        if (rd && rd.terrain === center.terrain) c++
      }
      return c
    }
    case 'double_faction':
      return 0
    case 'per_adjacent': {
      const center = regionById[tileRegionId]
      if (!center) return 0
      let c = 0
      for (const nb of center.neighbors) {
        if (ownedRegionIds.has(nb)) c++
      }
      return c
    }
    case 'per_mountain': {
      let c = 0
      for (const rid of ownedRegionIds) {
        const rd = regionById[rid]
        if (rd?.mountain) c++
      }
      return c
    }
    case 'per_coastal': {
      let c = 0
      for (const rid of ownedRegionIds) {
        const rd = regionById[rid]
        if (rd?.coastal) c++
      }
      return c
    }
    case 'per_plunder': {
      if (state.current !== playerId) return 0
      let extra = 0
      for (const rid of state.turn.conquered) {
        const rd = regionById[rid]
        if (rd?.faction) extra++
      }
      return extra
    }
    case 'per_fortress': {
      let c = 0
      for (const rid of ownedRegionIds) {
        const rs = state.regions[rid]
        if (rs.fortress > 0 || rs.hero) c++
      }
      return c
    }
    case 'per_5_regions': {
      if (def.id === 'world_tree') {
        return 1 + Math.floor(ownedCount / 3)
      }
      if (def.id === 'heart_of_azeroth') {
        return 1 + (ownedCount >= 5 ? 1 : 0)
      }
      return def.effect.value
    }
  }
}
