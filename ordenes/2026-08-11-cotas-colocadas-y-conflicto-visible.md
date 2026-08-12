# ORDEN: las COTAS se mueven con la pieza · y el CONFLICTO del sprue se VE

BASE: 279cda5

OBJETIVO: la revisión visual pendiente (iangpu revivido vía su host Windows) encontró
tres defectos que los números no enseñaban:

1. **Cotas huérfanas.** En E3/E4/E5, `boca X`, `draft`, `alto`, `piso`, `pared`,
   `Hc compra` y `cavidad X` flotan sobre espacio VACÍO abajo-izquierda, con sus líneas
   guía apuntando a nada — quedaron ancladas en el marco viejo. `cotasCicloE3` hornea
   literales (`[0,-12,40]`, `[46,-6,0]`, `[-40,-52,-20.5]`…). Tercera instancia de la
   familia "coordenadas absolutas que asumen la pieza en el origen".
2. **El conflicto del sprue es REAL, VISIBLE… y mudo.** El bebedero centrado (Fig 6.4)
   atraviesa la BOCA de la pieza y muere dentro del hueco — que en acero significa
   PERFORAR EL MACHO. `datumsColada` lo declara (`modo='requiere-offset'` + texto en
   `conflictos`) pero NI el panel NI el gate lo enseñan. La decisión (desplazar la
   cavidad o voltear la pieza) es de ian = retorno a la E3; lo que no puede pasar es
   que el CAD lo dibuje sin decirlo.
3. **Un check DECLARADO que nunca se implementó.** La orden del generador prometía
   *"colada ∩ macho = ∅ (interseccionMitades-style)"* como evidencia — se me fue. Aquí
   se implementa, y su lectura honesta es al revés: para ESTA pieza (boca a la
   partición, cavidad al centro) la intersección DEBE dar > 0 — es la prueba medida de
   que el conflicto existe y de que el retorno a la E3 va en serio.

## YA-EXISTE (prueba de ausencia)
- `colada.ts::datumsColada` ya detecta y redacta el conflicto (`modo`, `conflictos`).
- `estudio-molde-datos.ts::interseccionMitades(oc, a, b)` — la intersección booleana
  medida en mm³, ya probada en la prueba del rayo.
- `AceroE3.colocacion` (dx, dy, dz) ya viaja en el resultado de `construirAceroE3`.
- `ciclo.e5datums` ya guarda los datums en el estado del ciclo.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/llenado-video.cjs

> ENMIENDA (a media obra, antes de tocar): el PROPIO JUEZ del video REPROBÓ la primera
> corrida del entregable (imagen cambia 0.12·0.11·0.07 vs umbral 0.10) — con la pieza
> colocada dentro de la base, la cámara del ciclo orbita el ORIGEN (viewTarget solo usa
> el bbox del CROQUIS, y el ciclo no tiene croquis) y el molde queda arrinconado y CHICO,
> violando el mandato de PANTALLA COMPLETA. Investigado: el fallback del viewTarget al
> bbox del molde YA EXISTÍA (`meshBBox`) — el defecto es que la cámara INICIAL nace
> mirando al origen y el ciclo nunca pide una vista. El arreglo: `orbitTo` acepta un
> target OPCIONAL en coords CAD (`ForgeBRepStudio.tsx`) y el video lo pide
> (`llenado-video.cjs`).

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
- **captura nueva con OJOS**: las cotas anclan A LA PIEZA colocada (ninguna línea guía
  apuntando al vacío), en E3 y en E5.
- **el panel E5 muestra el conflicto en ROJO**, con el texto de `datumsColada` (las dos
  salidas: desplazar cavidad ≥ X mm = retorno E3, o voltear la pieza = sprue directo).
- **gate**: `modo === 'requiere-offset'` DETECTADO para esta pieza · `colada ∩ macho
  > 0` MEDIDO (la prueba de que el conflicto es real) · y las 17 cotas E3 + 9 de la
  colada siguen pasando.
- **video 4K** del estado colocado (E5=1) juzgado por `llenado-video.cjs` (7 criterios)
  y entregado a `Downloads\FORJA-DADO` de AMBAS PCs + `/mnt/e/forja-videos`.
- `node scripts/orden-gate.cjs` VERDE · censo IGUAL.

## CIERRE (2026-08-12)

- **iangpu estaba MUERTO, no lento.** El SSH por Tailscale daba `Connection timed out`
  desde el cierre anterior. Diagnóstico por el host Windows (`sebas@100.116.134.86`):
  `wsl -l -v` → **Ubuntu Stopped**. Al arrancarlo, ni `ssh` ni `tailscaled` levantaron
  solos. Se revivió con `wsl -d Ubuntu -u root -- systemctl start ssh tailscaled`.
  **Receta guardada**: si iangpu no responde, entrar por el host y revisar el estado de
  WSL ANTES de dar por perdida la sesión — no es sobrecarga SSH, es la VM apagada.
  (Y `vite` hay que lanzarlo con `cd` al repo: sin él sirve `$HOME` y da 404 en :5178.)

- **LAS TRES COSAS QUE SÓLO SE VEN CON OJOS**, ninguna la enseñaban los números:
  1. **Cotas huérfanas** — `boca X`, `draft`, `alto`, `piso`, `pared`, `Hc compra`,
     `cavidad X` flotando sobre vacío con las guías apuntando a nada. `cotasCicloE3`
     horneaba literales del marco viejo (`[0,-12,40]`, `[46,-6,0]`…). Ahora los anclajes
     pasan por `P()`/`PXY()` con la colocación. **TERCERA instancia** de la familia
     "coordenadas absolutas que asumen la pieza en el origen" (van: rebanadas del draft,
     piso del macho, y estas cotas).
  2. **El conflicto era mudo.** `datumsColada` lo declaraba desde su primer commit y ni
     el panel ni el gate lo enseñaban: el CAD dibujaba un bebedero que PERFORA el macho
     sin decir nada. Ahora el panel abre con una banda roja
     (`⛔ CONFLICTO ESPACIAL (requiere-offset)`) con las dos salidas del libro, y el gate
     lo exige.
  3. **Un check DECLARADO y nunca implementado**: la orden del generador prometía
     "colada ∩ macho = ∅" como evidencia y se me fue. Implementado — y su lectura honesta
     es la inversa: **3,997.5 mm³** de acero compartido. La interferencia DEBE existir
     para esta pieza; es la medida de que el retorno a la E3 va en serio.

- **EL JUEZ DEL VIDEO REPROBÓ MI PRIMER ENTREGABLE**, y tenía razón: `LA IMAGEN CAMBIA`
  daba 0.12 · 0.11 · 0.07 contra un umbral de 0.10. Causa: con la pieza colocada dentro
  de la base 196×196×248, la cámara del ciclo nace mirando al ORIGEN y el ciclo nunca
  pide vista → el molde salía arrinconado y la pieza diminuta (mandato de PANTALLA
  COMPLETA, `docs/FILOSOFIA-CINE.md`). Investigado antes de parchar: el fallback del
  viewTarget al bbox del molde YA EXISTÍA (`meshBBox`); lo que faltaba era PEDIR el
  encuadre. `orbitTo` ahora acepta target opcional en coords CAD y el video encuadra la
  pieza. Tras el arreglo: **1.95 · 2.32 · 1.27**. `ForgeBRepStudio.tsx` sí se tocó
  (el target opcional), y se corrige la enmienda que decía que no.

- **Y un bug que sólo se ve midiendo el artefacto**: `orbitTo` estaba registrado DOS
  veces en `__forgeBrep`; la segunda (3 argumentos) pisaba a la primera y se tragaba el
  target en silencio. Cazado con `orbitTo.length` → decía 3, debía decir 6. Un A/B de
  tres capturas habría salido idéntico sin esa sonda.

- **gate `ciclo-dado-test`: 75 pasan · 0 fallan.** VIDEO 4K **APROBADO 7/7** →
  `dado-colocado-4k.mp4` (3840×2160, 170 frames), entregado a `Downloads\FORJA-DADO` de
  AMBAS PCs + `/mnt/e/forja-videos`.

- **LO QUE EL VIDEO MUESTRA, dicho sin adorno**: está aprobado como VIDEO (monótono,
  0.01 % → 100 %, la imagen cambia), pero lo que documenta es el molde CON su conflicto:
  se ve el bebedero atravesar la boca y bajar por dentro de la pieza. No es un molde
  terminado — es el testigo de que el retorno a la E3 existe y es visible.

- **PENDIENTE**: la decisión de ian en la estación 3 — desplazar la cavidad ≥ 30.2 mm del
  centro, o voltear la pieza para que su base cerrada mire a la placa A (sprue directo).
  Y el regrind al 68.4 %, que pide placas más delgadas o base más chica.
