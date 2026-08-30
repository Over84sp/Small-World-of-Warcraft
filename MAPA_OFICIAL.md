# Mapa Oficial Small World of Warcraft - Transcripción exacta

Basado en fotos alta resolución wiki + regla oficial + crops 1000px Amazon.

## Estructura oficial (6 islas doble cara, 2 por tamaño)

| Tamaño | Regiones | Islas | ID en código |
|--------|----------|-------|--------------|
| S pequeña | 7 | 2 | small_a, small_b |
| M mediana | 9 | 2 | medium_a, medium_b |
| L grande | 11 | 2 | large_a, large_b |
| **Total** | **54** | **6** | |

### Distribución por jugadores (regla oficial p3 y p5)
- **2j**: 1L + 1S = 18 regiones · 10 rondas
- **3j**: 1L + 1M + 1S = 27 regiones · 10 rondas
- **4j**: 1L + 2M + 1S = 36 regiones · 9 rondas
- **5j**: 2L + 1M + 2S = 45 regiones · 8 rondas
- **6j experimental**: todas = 54 regiones

Selección aleatoria: de cada tamaño se elige al azar qué cara/isla concreta entra.

## Componentes oficiales
- **Montañas**: 10 fichas (en nuestro mapa 13 por aproximación, ajustar a 10)
- **Murlocs (tribus perdidas)**: 15 fichas (en nuestro mapa 13, ajustar a 15)
- **Muros Wisp**: 9 muros que bloquean fronteras entre regiones (no implementado aún, TODO)
- **Fortalezas**: 10
- **Héroes**: 5
- **Lugares legendarios**: 7 (★) + **Artefactos**: 5 (🔮) = 12 losetas, se colocan 1 por jugador boca abajo, al conquistar se revela, no da defensa, permanece vacía, bonus mientras la ocupas.
- **Entry / Ancla**: todas las regiones costeras (toca borde isla) son entrada marítima, coste +1 salvo Murlocs y Marinero.
- **Banderas**: Alianza / Horda / Neutral para bonus facción.

## Transcripción de islas (fotos)

### Isla Pequeña A (small_a) - 7 regiones - crop_leftmid2.png + small_board.jpg
1. Cima del Vigía - mountains + montaña impresa
2. Campos de Westfall - fields - S legendario - Alianza
3. Colinas de Hillsbrad - hills - Murloc
4. Bosque de Elwynn - forest - Alianza
5. Montañas Crestagrana - mountains + montaña
6. Llanos de Mulgore - fields - Horda
7. Pantano de los Zánganos - swamp - Murloc

### Isla Pequeña B (small_b) - 7 regiones - crop_bottom.png
1. Montañas de Alterac - mountains + montaña
2. Campos de Arathi - fields - S
3. Bosque de Argénteos - forest - Alianza
4. Claro de Tirisfal - forest - Murloc
5. Montañas de Colmillo - mountains + montaña
6. Praderas de Loch Modan - fields
7. Ciénaga de Dustwallow - swamp - Murloc

### Isla Mediana A (medium_a) - 9 regiones - medium_board.jpg
1. Pantano de las Penas - swamp
2. Campos de Trabalomas - fields - M
3. Bosque de Terokkar - forest
4. Caverna de Desolace - swamp (cavern) - Murloc
5. Montañas de Cumbre Borrascosa - mountains + montaña
6. Colinas de Feralas - hills
7. Bosque de Frondavil - forest - Alianza
8. Praderas de Vallefresno - hills - Murloc
9. Campos de Costasur - fields

### Isla Mediana B (medium_b) - 9 regiones - crop_top.png (top island)
1. Bosque de Ashenvale - forest - Alianza
2. Ciénaga de Marjal Revolcafango - swamp
3. Campos de Vega de Tuercespina - fields - M
4. Montañas de Filospada - mountains + montaña
5. Colinas de Desolace - hills - Murloc
6. Bosque de Vega Crepuscular - forest - Murloc
7. Campos de los Baldíos Sur - fields
8. Montañas de Sierra Espolón - mountains + montaña
9. Bosque de Claro de la Luna - forest

### Isla Grande A (large_a) - 11 regiones - large_board.jpg + board_page3.png
1. Pantano de Zangarmar - swamp
2. Campos de Elwynn - fields - L
3. Montañas de Dun Morogh - mountains + montaña
4. Colinas de Loch Modan - hills - Alianza
5. Campos de Westfall - fields
6. Montañas de Crestagrana - mountains + montaña
7. Bosque de Tuercespina - forest - Murloc
8. Montañas de Vega de Tuercespina - mountains + montaña
9. Praderas de Mulgore - hills
10. Bosque de Claros de Tirisfal - forest - Horda
11. Ciénaga de las Mil Agujas - swamp - Murloc

### Isla Grande B (large_b) - 11 regiones - board_page3.png + crop_right.png
1. Bosque de Cuna del Invierno - forest
2. Pantano de Feralas - swamp
3. Campos de Tanaris - fields - L
4. Montañas de Cuna del Invierno - mountains + montaña
5. Colinas de Silithus - hills - Murloc
6. Bosque de Frondavil - forest - Murloc
7. Campos de Vega de Tuercespina Sur - fields
8. Montañas de Silithus - mountains + montaña
9. Bosque de Claro de la Luna Sur - forest
10. Pantano de Dustwallow - swamp - Murloc
11. Montañas de Tanaris - mountains + montaña

## Generación técnica
- `scripts/mapOfficialSeeds.ts`: define 6 LANDMASSES con outline rect 300-400px y seeds x,y en espacio 0..1400
- `scripts/genOfficialMap.ts`: Voronoi (d3-delaunay) + clipping (polygon-clipping) con outline, vecinos por arista compartida, coastal si toca outline
- Output: `src/game/mapData.generated.ts` con 54 regiones, cada una con polygon, center, neighbors, mountain, coastal, lostTribe, landmark S/M/L
- `src/game/engine.ts`: ISLANDS + BOARDS por nº jugadores + selectOfficialIslands() aleatorio con rng mulberry32
- `src/ui/Setup.tsx`: muestra tableros 2p-6p y lista de islas

## Bloque 1 — Razas oficiales (HECHO ✅)

Las 16 razas jugables reproducen los efectos del juego oficial
([fuente](https://en.namu.wiki/w/Small_World_of_Warcraft/세부_내용)):

- **Múrlocs ya no son jugables**: son los nativos del mapa (los "tribu perdida").
  **Dragonmaw/Dragón Negro** eliminado. **Etéreos** y **Kobolds** entran como neutrales.
- Humanos: 2 Objetivos Militares por turno (+2 a quien las conquiste, +2 a los Humanos si no son ellos).
- Enanos: montañas −2. Gnomos: asalto aéreo 1/turno + dado extra. Elfos de la Noche: bosques −1
  y Muro Wisp (+1 defensa) en cada bosque, sobrevive al declive. Draenei: primera ficha perdida
  por turno se redespliega. Huargen: forma humana (+2) o huargo (−1 coste, −1 moneda).
- Orcos: botín doble Alianza. Tauren: mínimo 2 fichas por región (y 2 en declive). Trolls: −1
  en regiones ocupadas. Renegados: 1 alma (ficha descartada) = 1 ficha por 1 moneda en redespliegue.
  Elfos de Sangre: +1 por región Mágica (pendiente de terreno). Goblins: 12 bombas (50% explotan).
- Etéreos: −2 1/turno en región con loseta. Kobolds: cavernas como adyacentes (pendiente de terreno).
  Pandaren: Armonía (atacarles cuesta 2 monedas). Naga: Mares/Lagos (pendiente de terreno).

Aproximaciones declaradas (texto oficial no verificado al 100%): colocación de Objetivos
Militares (aquí: cualquier región ajena), dado extra Gnomo modelado como +1 dado/turno,
y Armonía limitada a 1 ficha por jugador a la vez.

## Bloque 2 — Poderes oficiales (HECHO ✅)

Los 20 poderes especiales son ahora los del juego oficial
([fuente](https://en.namu.wiki/w/Small_World_of_Warcraft/세부_내용)); fuera los heredados del
Small World clásico (Alquimista, Berserker, Comando, Voladora, Mercader, Montada, Saqueadora,
Fortificada, Heroica, Resistente, Rica, Diplomática, Espiritual…):

- **Monedas extra**: Arqueóloga (+1/loseta), Granjera, Pescadora (costera o junto a lago),
  Herborista (colinas), Montañesa (montañas), Guardabosques (bosques), Caminante de Pantanos,
  Minera (cavernas, latente), Exploradora (+1/isla), Maestre de Guerra (+1/región ocupada
  conquistada), Enfurecida (+monedas por cada defensor en regiones con 2+).
- **Descuentos**: Herrero (todo −1), Navegante (desembarco sin +1).
- **Defensa**: Defensiva (Torre de Vigía 1/turno en llanura rodeada: no conquistable),
  Guarnición (10 fuertes, +1 defensa y +1 moneda cada uno), Habitante del Marjal (peaje de
  1 moneda en sus pantanos, activo en declive).
- **Acciones**: Campeón (1/turno conquista adyacente con 1 ficha; defiende +1; rescate de
  1 moneda al ser capturado), Maestra de Bestias (+1 ficha/colina al empezar el turno, máx 5),
  Intimidadora (3/turno mueve 1 ficha rival adyacente), Maga de Portales (intercambia fichas
  entre regiones mágicas 2/turno, latente hasta el mapa con magia).

Aproximaciones declaradas: costes de fichas de cada poder (los oficiales no constan en las
fuentes), fichas de bestia fundidas en la mano, Torre de Vigía autocolocada y retirada al
declinar, Campeón que no apila fichas de raza en su región, y el peaje del Marjal cobrado
solo al conquistar (no al usar habilidades sobre la región).

## Pendiente para 100% fiel
- [x] ~~Bloque 1: razas oficiales~~ (16 razas con efectos oficiales; Múrlocs = nativos; Etéreos y Kobolds entran)
- [x] ~~Bloque 2: poderes oficiales~~ (los 20 del juego oficial; fuera los del Small World clásico)
- [ ] Bloque 3: Wisp Walls de frontera impresas + Fuertes neutrales del setup
- [ ] Bloque 4: terrenos Mar/Lago, Caverna y Mágica en el generador (activa Naga, Kobolds, Elfos de Sangre y Etéreos plenos)
- [ ] Bloque 5: lugares legendarios y artefactos oficiales (Capilla de la Luz, Piedra de Reunión, Espíritu Sanador, Égida, Cenizas de Al'ar)
- [ ] Bloque 6: bestias, Campeón, torres de vigía y Armonía como componentes físicos con pool
- [ ] Ajustar Murlocs de 13 a 15 exactos según foto alta res
- [ ] Ajustar montañas de 13 a 10 exactos
- [ ] Implementar 9 Wisp Walls como bloqueo de adyacencia (lista de pares bloqueados) — los de raza ya existen
- [ ] Entry cost: en oficial, desembarco cuesta 1 extra salvo Murlocs/Marinero, ya implementado
- [ ] Revisar terrenos exactos de cada región con fotos wiki high-res (ahora aproximado)
- [ ] Doble cara: cada isla tiene 2 caras, ahora solo 1 cara por isla (necesitaríamos 12 caras totales, 6 usadas por partida)
- [ ] Colocar S/M/L legendario en regiones marcadas con landmark, no aleatorio total
