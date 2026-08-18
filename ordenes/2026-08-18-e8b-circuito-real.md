# ORDEN: E8b — EL CIRCUITO DE AGUA REAL (la enmienda que cazó ian)

BASE: 293f71e

OBJETIVO: ian paró el tren: *"las tuberías de agua están MAL"* — y tiene razón
tres veces. La escena E8a dibujó un DIAGRAMA (6 cilindros flotando), no un
CIRCUITO: (1) las líneas del lado B no enfrían el core (el calor está ARRIBA,
dentro del macho — Fig 9.11); (2) las líneas cruzan las interfaces
inserto↔placa sin sellos (§9.2.7); (3) no hay conexiones, tapones ni in/out
(§9.1.6: un barreno sin tapón es una regadera). Y MEDIDO al preparar esta
orden: la línea A a H=19.04 ROMPÍA el acero (tope del barreno a z=206.92 >
techo del inserto 206 — claro NEGATIVO −0.92 mm) y la línea B quedaba a
0.58 mm del piso del bolsillo del inserto B (½⌀=2.38 exigido). El juez de
interferencia de la E8a solo miraba el bebedero; el de la E8b mira TODO.

## EL DIBUJO (lo que se verá — todo a escala de catálogo, NADA exagerado)
```
   LADO A (inserto de cavidad, z ≈ 201 — H recortada por el TECHO del inserto)
        ┌───────tapón────────┐
     tapón   ┌─────────┐   tapón      ANILLO PERIMETRAL §9.3.1(d):
        │    │  DADO   │    │         4 barrenos cruzados en esquinas
     IN ●    │  (top)  │    ● OUT     alrededor del BEBEDERO (⊘ al centro)
        │    └─────────┘    │         + 2 extensiones por placa A
        └───────tapón───────┘         (1 O-RING cada una, §9.3.2)
   TRAMPA DECLARADA: runner frío ⇒ el CENTRO genera calor — la salida (c)
   hot-sprue de la E8 la elimina (anuncio cruzado).

   LADO B (placa B, z recortada por el PISO del bolsillo del inserto)
     IN ●━━━━━━━━━━━┓          serpentina de 3 líneas + 2 cruces + tapones
        ┃   ╻ BAFFLE┃          y AL CENTRO el BAFFLE (Tabla 9.3): bore ⌀9.53
        ┗━━━┫ (core)┃          SUBE por dentro del MACHO con su lámina —
     OUT ●━━┛ ╹     ┗━━ tapón  el agua sube-y-baja DENTRO del core
```

## LO QUE SE CONSTRUYE
1. `estacion8Circuito(pkg, d, cd)` en `estudio-molde-datos.ts` (puro), y se
   ata al retorno de `estacion8Dado` (campo `circuito`):
   - LADO A: anillo perimetral en el inserto de cavidad (semi 30 del eje —
     libra el bebedero), z = techo del inserto − ⌀ (el RECORTE medido:
     H 19.04 → ~15.7, y se verifica que SIGUE en 2D<H<5D); 4 barrenos + 2
     extensiones por placa A a la cara exterior; 6 tapones NPT; 2 O-rings
     DECLARADOS donde la extensión cruza placa↔inserto; IN/OUT etiquetados.
   - LADO B: serpentina de 3 líneas (x = eje ± W) + 2 cruces + 6 tapones,
     z = piso del bolsillo del inserto B − ⌀ (RECORTE 19.04 → ~21, en rango);
     IN/OUT etiquetados. AL CENTRO el BAFFLE: bore ⌀9.53 (JP-352) que sube por
     el macho hasta ½⌀ del ápice interior, con su LÁMINA; 1 sello donde cruza
     placa↔inserto. El core POR FIN se enfría por dentro (el anuncio de la
     Tabla 9.3 se cumple en el acero, no solo en el panel).
   - EL JUEZ DE INTERFERENCIA TOTAL: claros MEDIDOS de cada segmento contra
     bebedero, techo/piso de insertos y ápice del core — mínimo ½⌀ de acero
     (§9.2.7); los cruces DISEÑADOS (línea∩cruce, línea∩baffle) se excluyen
     explícitos por ser uniones. Conteo §9.1.6: exactamente 2 conexiones por
     mitad. Sellos CONTADOS y declarados (cada O-ring es una fuga futura).
2. `cicloEstacion8` (useMoldStudio): la escena se construye del CIRCUITO —
   segmentos como cilindros reales, tapones (bronce), O-rings (rojos), lámina
   del baffle (latón). Se borra el generador de 6 cilindros de la E8a.
3. Panel `CicloE8` (MoldPanels): caja EL CIRCUITO (conteo de barrenos/tapones/
   sellos por lado + claros del juez + la cadena de RECORTES) y la fila del
   ruteo remite al anillo.
4. **Gate** (`ciclo-dado-test.cjs`):
   - conexiones = 2 por mitad, etiquetadas (§9.1.6) + tapones/sellos contados.
   - JUEZ: TODOS los claros ≥ ½⌀ (la lista impresa).
   - RECORTES: hA y hB recortados por interferencia y AMBOS siguen en 2D..5D.
   - CONTROL NEGATIVO — la escena de AYER: con los z de la E8a el juez mide
     claro NEGATIVO en A (−0.92: rompía el acero) y 0.58 < 2.38 en B. Lo que
     se dibujó ayer REPRUEBA con números; por eso el ojo de ian tenía razón.
   - ANILLO: claro al bebedero ≥ ½⌀ · trampa §9.3.1(d) declarada con anuncio.
   - BAFFLE: rango Tabla 9.3 + claro al ápice ≥ ½⌀bore + sello contado.
   - los 147 existentes verdes.
5. Video 4K `dado-enfriamiento-4k.mp4` RE-RENDIDO (mismo nombre, E8=1+MOLDE=1)
   — juzgado + ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal)
- `coolingDesign` (⌀/H/W/caudal) · `insertDims` (Hc=60, Hk=16, huella 120) ·
  `PLUGS_DME` (JP-250/JP-352) · `TABLA_9_3`/`seleccionCoreTabla93` (baffle) ·
  `estacion8Dado` (t_c/bushing/dinero/ruteo — INTACTOS) · makeCylinder/makeBox
  con eje arbitrario · el patrón estación completo.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- gate: juez total con claros medidos · control negativo = la escena de ayer
  reprueba con números · conexiones/tapones/sellos contados · baffle en rango
  · recortes en 2D..5D · 147 verdes · orden-gate VERDE.
- video 4K re-rendido APROBADO (juez + ojos) → AMBAS PCs · deploy · cierre +
  commit · memoria (la lección: un diagrama no es un circuito).

## CIERRE (2026-08-18)
- **Gate 153/153 verdes** (6 nuevos E8b). ORDEN_GATE VERDE.
- **La caza de ian, confirmada con números** (control negativo permanente en el
  gate): la línea A de la E8a tenía claro **−0.92 mm** contra el techo del
  inserto — EL BARRENO ROMPÍA EL ACERO — y la B quedaba a 0.66 < 2.38 del piso
  del bolsillo. "Si salió mal a la primera, está mal": el ojo primero, el juez
  después, y el juez se queda para siempre.
- **El circuito real**: 12 barrenos · 12 tapones NPT · 3 sellos declarados ·
  IN/OUT ×4 etiquetados (§9.1.6). Lado A: anillo perimetral §9.3.1(d) en el
  inserto (semi 30, claro 23.5 al bebedero; H recortada 19.04→15.74 = 3.31D,
  en rango) + 2 extensiones con O-ring. Lado B: serpentina 3 líneas + 2 cruces
  (H recortada → 20.76 = 4.36D) + **BAFFLE ⌀9.53 subiendo por el macho hasta
  5.24 mm del ápice con su lámina — la Fig 9.11 RESUELTA en el acero**, no
  solo anunciada en el panel. Trampa §9.3.1(d) declarada (runner frío = centro
  caliente) con el anuncio cruzado a la salida (c) hot-sprue.
- **El juez de interferencia total**: 6 claros medidos, todos ≥ ½⌀ (bebedero
  23.48 · techo inserto A 2.38 exacto · techo pieza 13.36 · piso inserto B
  2.38 exacto · ápice 5.24 ≥ 4.76 · salida a cara 68).
- Escena del circuito (segmentos + tapones bronce + O-rings rojos + lámina
  latón), TODO a escala de catálogo — cero exageración, cero bandera.
- Video re-rendido APROBADO + ojos → AMBAS PCs (mismos nombres) · deploy.
- La lección a memoria: **un diagrama no es un circuito** — misma familia que
  el vent-tablón: la geometría se dibuja CON la figura del libro (aquí faltaban
  Fig 9.9/9.11 y el §9.1.6 completo), y el juez debe mirar TODO el acero, no
  solo el componente que ya te preocupaba.
