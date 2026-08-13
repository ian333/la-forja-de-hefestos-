# ORDEN: EL LLENADO DESDE EL OPERADOR — Hele-Shaw/FAN con las caras como oráculos

BASE: 1864d1d

OBJETIVO: ian pidió leer TODOS sus papers del Operador 𝔄 y de ahí "una implementación
mínima pero poderosa". La lectura completa (13 papers + lab) está en la cápsula/artifact
"La Lectura del Operador". El estrato que se exporta HOY es el MÉTODO DE LAS CARAS
(PROCESO_CARAS.md, 6 pasos con auditoría obligatoria; probado en producción: MHD 4.6×):
simetría → cara diagonal → trabajo solo en el canal residual → AUDITAR con el invariante.

Aplicado al llenado: el frente deja de ser heurística (orden de resistencia Dijkstra) y
se vuelve FÍSICA — Hele-Shaw ∇·(k∇p)=0 con k = h²/12η por vóxel (Darcy de lubricación
sobre el grafo YA existente), avance FAN por volúmenes de control, presión real, tiempo
real, short-shot real (si p toca el tope de máquina, el frente SE PARA).

## LO QUE SE CONSTRUYE (el diff mínimo)
1. **`src/forja/mold/fan.ts`** (CREA — el ÚNICO archivo nuevo, puro, cero deps nuevas):
   `resolverLlenadoFAN(campo, o)` → `{frente, tArrivalS, pMaxMPa, tFillS, shortShot,
   incompleto, conservacionMaxRel, ...}`. Newtoniano EFECTIVO: η_eff calibrada a la
   Eq 5.22 del libro en el punto de operación (H=pared, v=la del lazo Cross-WLF) —
   §5.6 avala ("aptly used"); power-law no lineal queda como N2. CG matrix-free con
   warm-start; p=0 en el frente (celdas frontera), caudal Q en la boquilla.
   AUDITORÍA INTERNA por paso: |ΣF_frontera − Q|/Q (el Parseval discreto).
2. **Gate** (TOCA `scripts/ciclo-dado-test.cjs`) — las CARAS como oráculos:
   - cara-1D (traslación): tira sintética H=1.5 → pMax ≈ 83.2 MPa (el número impreso).
   - cara-radial (escala): disco con gate central → t(2r)/t(r) ≈ 4 y anillo
     Δp ≈ (6ηQ/πh³)·ln(r2/r1).
   - pipeline completo: measureFlowLength + FAN sobre la tira (mide el sesgo EDT,
     tolerancia declarada de lo MEDIDO).
   - conservación: max |ΣF − Q|/Q bajo umbral.
   - CONTROL NEGATIVO (lección del ENJAMBRE — no sembrar la respuesta): dominio
     partido en dos → `incompleto` DEBE dispararse; tope de máquina bajo →
     `shortShot` DEBE dispararse con llenado parcial.
3. **El swap** (TOCA `src/forja/brep/useMoldStudio.ts`, cicloEstacion5): la ranura
   `frenteGrid`/`fvJ` pasa de `n1J.frente` a `fanJ.frente` + se guarda `e5fan`
   (pMax/tFill/shortShot/conservación) en el estado. La superficie, el reloj, el juez
   del video y las alarmas NO se tocan: solo ven el arreglo.

## EXCLUIDO (disciplina)
- Nice-constants π/e/φ en los gates del molde (E5 del propio catálogo de caras).
- Térmica acoplada / capa congelada / power-law no lineal (N2). Empaque (E6).
- Cara-DCT como solve directo (N2, si el CG lo pide). UI nueva: nada.

## YA-EXISTE
- `measureFlowLength` (voxelizador + EDT `thicknessMm` + gate snap) · `convergeVelocityCross`
  + `ABS_CROSS` (validados contra el libro) · `pressureDropSegment` (Eq 5.22, el oráculo)
- la ranura universal `frente: Float32Array` (superficie/reloj/juez/alarmas la consumen)
- las alarmas de tubería (unreachable + snap) y balance — quedan intactas

## TOCA
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs

## CREA
- src/forja/mold/fan.ts

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
- src/comando/
- scripts/comando-scan.cjs

## EVIDENCIA (declarada antes de trabajar)
- gate: tira pura ≈ 83.2 MPa (±2 %) · disco radial t(2r)/t(r) ≈ 4 (±10 %) y anillo
  ln(r2/r1) (±5 %) · pipeline EDT+FAN con tolerancia declarada de lo medido ·
  conservación ≤ 1e-6 · control negativo `incompleto` · control `shortShot`.
- `node --import tsx scripts/ciclo-dado-test.cjs` → 0 fallan (los 82 existentes + los nuevos).
- `node scripts/orden-gate.cjs` VERDE.
- E5 en vivo: el campo conjunto sigue llenando colada→pieza; tiempos/presión reportados.
- video 4K re-renderizado y juzgado si el visual del entregable cambia — a AMBAS PCs.

## CIERRE (2026-08-12)

- **gate 92 pasan · 0 fallan** (los 82 existentes intactos + 10 del FAN) · orden-gate VERDE
  · **VIDEO 4K APROBADO 8/8** → `dado-llenado-4k.mp4`, entregado a AMBAS PCs
  (`Downloads\FORJA-DADO`) + `/mnt/e/forja-videos`. Con OJOS: el bebedero llena de
  arriba abajo y al tocar la base el frente se abre RADIAL (la cara radial EN VIVO,
  Fig 7.2 literal) → baja por las 4 paredes → las patas al final.

- **TRES bugs reales cazados por los ORÁCULOS (las caras), en secuencia**:
  1. **El desfase de capas (1.69×)** — con el hueco resuelto por 2 vóxeles, cada capa
     como celda FAN independiente (frontera p=0) se desfasaba y la presión salía
     140 vs 83 MPa. Fix = EL COLAPSO DEL ESPESOR: p es constante a través del hueco
     (Hele-Shaw) ⇒ super-nodos columna por el eje local de espesor (la corrida más
     corta); Σ caras discretas = h³/12η EXACTO. Después: Δp 62.4 vs 62.4 MPa.
  2. **El reloj de flujos se inflaba 40 %** — al saturarse la frontera se perdía el
     flujo del anillo nuevo. Fix = RELOJ DE VOLUMEN (incompresible: t = V/Q exacto);
     el disco clavó t(r) = πr²h/Q en todos los radios. Los flujos deciden el ORDEN;
     la conservación decide el TIEMPO.
  3. **CG estancado en el dado real (conservación 9.4e-4)** — rango de conductancias
     16× (bebedero ⌀8 vs pared 2). Fix = PCG Jacobi (diagonal estática rowK):
     conservación 1.6e-9. Lo delató la AUDITORÍA del paso 6, no un tester externo.

- **la física del dado real**: p_max 2.83 MPa (máquina de 140: sobra) · t_fill 1.0 s ·
  7,620 super-nodos · conservación ≤ 1.6e-9 · una tubería (colada 98.3 % antes de que
  la pieza moje — criterio del juez).

- **el primer render REPROBÓ por el criterio de ojos** (primer tercio 0.00 de cambio
  de imagen): la cámara (target z=127) cortaba el bebedero — el sprue llenaba FUERA
  de cuadro. Frames 1-35 byte-idénticos. Fix: ORBIT 38,18,210,98,98,190. No era el
  solver — era el encuadre; el juez de píxeles hizo su trabajo.

- **sesgo del voxelizador MEDIDO y declarado** (no escondido en tolerancia gorda): a
  c=0.7 la placa de 1.5 queda de 2 celdas = 1.40 mm; el FAN reproduce la física de SU
  geometría (109.5 vs 102.3 MPa esperado con h=1.40, ±10 %). El nominal 83.2 es a h=1.5.

- deploy: build en iangpu + `publicar-sitio.sh` → la E5 viva usa el FAN (mismo enchufe
  `frente`; superficie/reloj/juez/alarmas sin tocar, como declaraba la orden).
