# ORDEN: EL CONO SE VE CONO — ocupación fraccional en la superficie del fundido

BASE: 74de4b8

OBJETIVO: ian, viendo el video del volteo: *"es un sprue cónico; en el llenado no veo un
cono, veo 3 tamaños en el líquido, como un perno con 3 diámetros. Creo que no hay
suficiente resolución"*. Diagnóstico correcto, y la causa es precisa:

`frenteSuperficie` construye la superficie desde una OCUPACIÓN BINARIA (¿el centro del
vóxel cae dentro? 1 : 0). El radio del cono baja 1.64 mm en 62.5 mm — con celda de 1 mm
la huella de vóxeles de la sección circular sólo cambia cuando r(z) cruza una distancia
de la retícula (≈3-4 cruces en todo el largo). Entre cruces, TODAS las rebanadas tienen
la misma huella → cilindro → escalón → cilindro: el perno de 3 diámetros.

**El arreglo NO es fuerza bruta de celdas** (0.5 mm = 8× vóxeles y todavía escalones,
solo más chicos): es la VERDAD SUB-VÓXEL, que ya tenemos gratis — `dentroColada` y
`dentroDadoLocal` son ANALÍTICOS. Se supermuestrea cada celda (2×2×2) y la ocupación
queda FRACCIONAL (0..1): el cruce 0.5 de la isosuperficie interpola entonces el radio
REAL del cono, que varía continuo con z → cono continuo, misma celda de 1 mm, mismo
costo de campo.

## LO QUE SE CONSTRUYE
1. `frenteSuperficie` acepta `ocupacion?: Float32Array` (por celda de la rejilla, 0..1):
   la celda llena aporta su ocupación fraccional en vez de 1. Sin el parámetro, el
   comportamiento de siempre (los checks existentes del gate NO cambian).
2. La E5 supermuestrea `dentroTuberia` (8 muestras/celda) y pasa la ocupación al render.
3. **CHECK DE CONICIDAD en el gate** (el criterio que faltaba y que el ojo de ian supló):
   el radio de la superficie del fundido medido en 3 alturas del bebedero debe DECRECER
   estrictamente (el taper analítico da ~0.39 mm por cada 15 mm). Con la ocupación
   binaria de hoy, dos de las tres alturas salen IGUALES — el check debe reprobar el
   método viejo y aprobar el nuevo.

## YA-EXISTE
- `dentroColada` / `dentroDadoLocal` — los predicados ANALÍTICOS (la verdad sub-vóxel).
- `frenteSuperficie` — surface nets con interpolación en las aristas: ya interpola; lo
  único que le falta es un campo que NO sea binario en la pared.
- el juez de video y la tubería única — sin cambios.

## TOCA
- src/forja/mold/flowlen.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
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
- **CONICIDAD medida**: radio de la superficie en z = 200 / 215 / 230 estrictamente
  decreciente (Δ ≥ 0.15 mm por tramo; el analítico da 0.39). CONTROL: el método binario
  (sin ocupación) REPRUEBA ese mismo check — si no lo distingue, no es evidencia.
- los checks EXISTENTES de superficie (volumen ±2 %/¼ celda, ORIENTADA, CERRADA, control
  vacío) siguen 0 fallan — la ocupación es opt-in y no los toca.
- capturas con OJOS: el bebedero del fundido se ve CONO continuo, sin escalones.
- video 4K re-renderizado, juzgado (8 criterios) y entregado a AMBAS PCs.
- `node scripts/ciclo-dado-test.cjs` 0 fallan · `node scripts/orden-gate.cjs` VERDE.

## CIERRE (2026-08-12)

- **gate 81 pasan · 0 fallan** · orden-gate VERDE · **VIDEO 4K APROBADO 8/8** →
  `dado-cono-4k.mp4`, entregado a AMBAS PCs + `/mnt/e/forja-videos`.

- **EL PERNO DE ian, MEDIDO** — el check de conicidad retrata exactamente lo que su ojo
  vio, y su control lo confirma:
  - ocupación **BINARIA** (el método de ayer): radios `4.00 → 3.26 → 3.26` mm —
    **dos alturas IDÉNTICAS** (Δmin 0.00) = el perno de 3 diámetros. REPRUEBA.
  - ocupación **FRACCIONAL** (9 muestras del predicado analítico): `3.80 → 3.26 → 3.00`
    mm, estrictamente decreciente (Δmin 0.26; el analítico da 0.39 por tramo). CUMPLE.

- **la causa, con precisión**: la superficie se construía desde ocupación binaria (¿el
  CENTRO del vóxel cae dentro?) — la huella de la sección circular solo cambia cuando
  r(z) cruza una distancia de la retícula (~3 cruces en 62.5 mm) → cilindro → escalón →
  cilindro. El diagnóstico de ian ("no hay suficiente resolución") era la causa; el
  arreglo bueno no fue fuerza bruta de celdas (0.5 mm = 8× vóxeles y escalones más
  chicos) sino la VERDAD SUB-VÓXEL que ya era gratis: `dentroColada`/`dentroDadoLocal`
  son analíticos → ocupación fraccional → el cruce 0.5 interpola el radio REAL.

- **opt-in limpio**: sin `ocupacion`, `frenteSuperficie` se comporta idéntico — los
  checks existentes (volumen, ORIENTADA, CERRADA, control vacío) siguen intactos.

- **visto con ojos** (peek + frame del MP4): el cono del fundido baja CONTINUO, y al
  tocar la base se abre en el DISCO RADIAL clásico del centro-inyectado — la física del
  sprue gate §7.2.1 dibujada bien.
