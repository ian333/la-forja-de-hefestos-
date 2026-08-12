# ORDEN: RETORNO a la E3 — desplazar la cavidad · y el sprue TERMINA en la partición

BASE: a4631af

OBJETIVO: ian decidió el retorno ("hay que desplazar la cavidad") y pidió volver al libro
a ver POR QUÉ los resultados no fueron los esperados. Releído §6.1–6.3 completo. Tres
causas, con página:

## POR QUÉ NO DIO LO ESPERADO (la lectura)

1. **MEZCLÉ DOS MODELOS DEL LIBRO.** §6.2.1 (p.119) es literal: *"The sprue is used to
   guide the polymer melt from the nozzle **to the parting plane**. Runners **in the
   parting plane** are then used to guide the melt **across the parting plane** to the
   cavities."* Y §6.3.1 (p.123) lo repite. En un molde de dos placas con runners, **el
   bebedero TERMINA EN LA PARTICIÓN** (L = top clamp + placa A = 36+66 = 102 mm).
   Yo apliqué la regla del sprue DIRECTO (zGate = base cerrada de la pieza — la del caso
   de la flanera centro-inyectada, §7.2.1) a un layout CON runner: por eso L_sprue salió
   141.5, por eso el cono siguió 39.5 mm debajo de la partición, y **por eso perforaba el
   macho: los 3,997 mm³ de interferencia SON ese tramo de más**. El "bug ya pagado" de los
   45.8 mm³ era del caso directo; lo generalicé mal.

2. **EL PRESUPUESTO DE PRESIÓN NO ERA DEL LIBRO.** §6.2.2 (p.121): si no se conoce la
   máquina, *"the mold designer can assume a maximum pressure drop through the feed
   system of **50 MPa** (7,200 psi)… this specification will result in a **steel-safe
   design with smaller feed system diameters and lower material utilization**"*. Yo
   repartí 20 (del ejemplo p.147) + 10 (inventado). El default del libro existe JUSTO
   para empujar diámetros chicos y menos regrind.

3. **EL REGRIND ALTO ES ESTRUCTURAL, no un bug — y el libro lo dice.** §6.2.3 (p.121):
   el 30 % *"translates directly to a specification on the maximum volume of the feed
   system"* → para nuestra pieza de 14.14 cc el tope es **4.24 cc** de colada. El cono
   del bebedero lo fija el STACK (102 mm) + la boquilla (⌀5) + el taper: eso solo ya pesa
   ~4.9 cc. Ni con presión infinita baja: **el taper no obedece al ΔP**. Las salidas del
   libro: placas más delgadas (E3), más ΔP donde sí aplica, o colada caliente (E2 —
   §6.2.3 y p.148). El VIOLA es información, no falla del motor.

   Y un hallazgo de honestidad: el `taperDeg = 1.5°/lado` del código cita "§6.3.1" — el
   capítulo **NO da ese número** (el bushing es componente de compra). Se re-etiqueta
   como EXTENSIÓN DECLARADA.

4. **BUG LATENTE DEL DESTINO** (visto al planear el offset): `datumsColada` manda el
   runner a `pieza.x1` (el labio LEJANO). Con la pieza desplazada a +x del bushing, el
   runner debe llegar al labio CERCANO (`x0`) — a x1 cruzaría por debajo de la pieza
   otra vez. Se corrige a "el labio que MIRA al bushing".

## LO QUE SE CONSTRUYE

- **E3 · `colocacionEnLaBase`**: la cavidad se DESPLAZA en +x del centro de la base el
  `offset` mínimo = semiancho + rBase del bebedero + holgura (los mismos datums que ya
  declara el conflicto). El bushing queda sobre ACERO pleno de la partición.
- **`datumsColada`**: en modos con runner, el bebedero termina EN LA PARTICIÓN
  (`zGate = zPart`, §6.2.1); la base cerrada queda SOLO para `sprue-directo`. Y el
  destino del runner = labio CERCANO.
- **El arco esperado, verificable**: `modo` pasa de `requiere-offset` a `sprue+runner`
  SIN conflicto; **`colada ∩ macho = ∅` por fin se cumple** (la evidencia declarada en la
  orden del generador, que hasta hoy daba >0 a propósito); `L_sprue` medido = 102;
  el banner rojo del panel se apaga SOLO. El detector se conserva con un control:
  la pieza SIN offset debe seguir dando `requiere-offset` + interferencia > 0.

## YA-EXISTE
- `colada.ts::datumsColada` — detecta el conflicto y calcula `offsetMin`; se reusa.
- `estudio-molde-datos.ts::colocacionEnLaBase` — la fuente única del offset; se extiende.
- `feed.ts::designSprueFeed` — los radios; no se toca.
- El gate y `verificacionColada` — las mismas mediciones, con expectativas nuevas.

## TOCA
- src/forja/mold/colada.ts
- src/forja/mold/estudio-molde-datos.ts
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `L_sprue` MEDIDO del sólido = `topClamp + placa A` = **102 mm** (§6.3.1 p.123) — ya no
  141.5. El bebedero acaba EN z = 146 (la partición), medido.
- `modo = 'sprue+runner'` y `conflictos = []` para la cavidad desplazada; el gate lo exige.
- **`colada ∩ macho = 0 mm³`** — la evidencia original por fin en verde, medida.
- CONTROL conservado: la pieza centrada (sin offset) sigue dando `requiere-offset` +
  interferencia > 0. Si el detector deja de detectar, no es evidencia.
- el runner llega al labio CERCANO: `x_compuerta = pieza.x0` cuando el bushing queda a −x.
- el regrind se REPORTA con el número nuevo y su lectura §6.2.3 (tope 4.24 cc); si sigue
  VIOLA se anuncia (E3 placas / E2 colada caliente), no se maquilla.
- `fuente.taper` = EXTENSIÓN DECLARADA (el libro no da el valor).
- captura del CAD con OJOS (banner apagado, colada en la partición) ANTES del 4K; video
  juzgado y entregado a AMBAS PCs si pasa.
- `node scripts/ciclo-dado-test.cjs` 0 fallan · `node scripts/orden-gate.cjs` VERDE.

## CIERRE (2026-08-12)

- **gate 77 pasan · 0 fallan**, y el arco que la lectura predijo se cumplió medido:

  | | antes del retorno | después |
  |---|---|---|
  | modo | requiere-offset + conflicto | **sprue+runner · 0 conflictos** |
  | L_sprue | 141.5 mm (regla equivocada) | **102.0 = 36 + 66** (§6.3.1) |
  | colada ∩ macho | 3,997.5 mm³ | **0.0 mm³** ← la evidencia original, por fin |
  | ⌀ bebedero base | 12.41 mm | **10.34 mm** |
  | runner | ⌀6 | **⌀5** (freeze 6.73 s > 3.25 s de la compuerta, §7.1.5) |
  | regrind | 68.4 % | **36.7 %** — VIOLA estructural, anunciado a E3/E2 |
  | centro de la pieza | (98, 98) = centro base | **(127.2, 98)** = centro + offset 29.2 |

- **offset aplicado: 29.17 mm** = semiancho 20 + rBase 5.17 (del MISMO motor, con
  L=102) + holgura 4 — el mínimo que `datumsColada` ya declaraba en su conflicto.
  `colocacionEnLaBase` lo calcula y es fuente única: E3, E4, cotas y gate lo heredaron
  sin tocarlos.

- **el DETECTOR se conservó**: control sintético con la pieza CENTRADA → sigue acusando
  `requiere-offset` con su texto. El retorno no borró al juez.

- **inconsistencia latente cazada al planear** (no en producción): al mover la selección
  del ⌀ de runner a `datumsColada` se había PERDIDO el criterio de congelamiento §7.1.5
  que la vieja E5 sí tenía — con el rBase nuevo habría elegido ⌀5 con freeze 2.99 s…
  no: medido 6.73 s > 3.25 ✓. El criterio quedó restaurado DONDE vive la decisión, y la
  fila `freeze` del panel lo sigue vigilando.

- **bug latente del destino, cazado al planear**: el runner iba SIEMPRE a `pieza.x1`
  (labio lejano) — con la cavidad desplazada habría cruzado por debajo de la pieza otra
  vez. Ahora va al labio que MIRA al bushing, y el caso a −x se declara como conflicto
  en vez de construirse mal.

- **honestidad de citas**: el `taper 1.5°/lado` citaba "§6.3.1" y el capítulo NO da ese
  número (el bushing es componente de compra). Re-etiquetado EXTENSIÓN DECLARADA en
  `fuente.taper`.

- **VISUAL con ojos**: banner `e5-conflicto` AUSENTE (se apagó solo, sin tocarlo) y la
  captura muestra la pieza desplazada, el bebedero sobre acero pleno terminando EN la
  partición, sin columna dentro del hueco.

- **regrind 36.7 %**: como la lectura predijo (~36 %), el cono del bebedero (fijado por
  stack+boquilla+taper) pesa ~4.9 cc contra un tope §6.2.3 de 4.24 cc — no hay ΔP que lo
  baje. Sigue VIOLA y sigue ANUNCIADO: placas más delgadas (E3) o colada caliente (E2).

- **VIDEO 4K APROBADO 7/7** → `dado-retorno-e3-4k.mp4` (3840×2160, 170 frames):
  monótono · 0.01 % → 100 % · la imagen cambia 3.74 · 2.94 · 0.73. Revisado con ojos a
  media película: el bebedero baja FUERA de la pieza, muere en la partición y entra por
  el labio cercano — cero columna dentro del hueco. Entregado a `Downloads\FORJA-DADO`
  de AMBAS PCs + `/mnt/e/forja-videos`.
