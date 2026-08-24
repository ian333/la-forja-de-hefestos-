# ORDEN: LA JABONERA — tercera figura del ciclo (costillas + bosses)

BASE: f3d068d

OBJETIVO: encargo de ian — "añadamos una tercera figura". Elegida (con ian):
la JABONERA, un ejemplo del PROPIO libro (banco del kernel: cup/lid/jabonera/
bezel). Prueba un EJE de forma que ni el cubo ni el vaso tocan: el DFM de
COSTILLAS (§2.3.2) y BOSSES (§2.3.3). Es el tercer producto de la máquina ya
separada (PiezaSpec), por el MISMO camino que el vaso: corre E1/E2 con sus
propios números y carga como proyecto del lobby.

## COTAS (literales del banco + extensión DECLARADA)
- Base LITERAL del libro (`kazmer-parts-build.cjs`): box 120×80×30, pared 2,
  shell tapa abierta, fillet R3 (→R1.8 resiliente por la pared).
- EXTENSIÓN declarada (una jabonera real las lleva): 3 costillas de piso
  (§2.3.2: base ≤0.7·pared, alto ≤4·pared, paso ≥10·pared, draft ≥0.5) + 4
  bosses de montaje (§2.3.3: pared ≤0.7·nominal). Son las features que hacen
  que la jabonera EJERZA §2.3.2/§2.3.3 — el motivo de elegirla.

## LO QUE SE CONSTRUYE
1. `JABONERA_SPEC` + `JABONERA_PIEZA` en `estudio-molde-datos.ts`: rect
   120×80×30 pared 2 ABS, con la DFM de costillas+bosses. macizo = bloque
   sólido 120×80×30 (control negativo).
2. Gate: la MISMA máquina corre la jabonera —
   - E1: macizo REPROBADO (bloque 30 mm), pieza APROBADA, y su DFM CONTIENE
     hallazgos §2.3.2 (costilla) + §2.3.3 (boss) — el eje que cubo/vaso NO
     tienen. CONTROL: cubo/vaso NO traen esos hallazgos (ejerció rama nueva).
   - E2: cotiza el rect 120×80 grande → molde ≠ cubo Y ≠ vaso.
3. `jaboneraDoc()` + tarjeta `st-jabonera` en el lobby (patrón ProjectSwitcher,
   como el vaso): rect 120×80 → extrude 30 → shell 2 tapa abierta. Editable.
   (La cara de la tapa se determina MANEJANDO la UI, no a ciegas.)

## LO QUE NO SE HACE (sigue igual, incremental)
- E3→E12 NO se parametrizan aún (siguen bindeadas al cubo). La jabonera, como
  el vaso, corre E1/E2; el resto del ciclo espera el incremento de E3.
- Las costillas/bosses viven en la DFM (JABONERA_PIEZA); el sólido cargable es
  el box+shell del banco (igual que el vaso: draft en spec, no en el sólido 0°).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- scripts/ciclo-dado-test.cjs
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
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
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
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
- `JABONERA_PIEZA` corre E1/E2; gate con bloque de la jabonera (DFM §2.3.2 +
  §2.3.3 presentes, ausentes en cubo/vaso; molde ≠ cubo ≠ vaso) · los 187
  previos verdes · orden-gate VERDE
- la jabonera CARGA como proyecto #3 en el lobby (screenshot) · deploy
