# ORDEN: EL SWITCHOVER V/P — la frontera rota a su variable conjugada

BASE: 7e155e0

OBJETIVO: la última dinámica visiblemente falsa del N1: al tocar el tope de máquina el
frente MUERE EN SECO. La máquina real conmuta de control por VELOCIDAD (impone Q, la
presión responde) a control por PRESIÓN (impone P, el caudal responde y DECAE) — el
V/P switchover, objeto de primera clase del solver comercial (nuestro pliego P2_42:
`FlowRate → SwitchOver → Pressure`). Ian autorizó tras la justificación de 3 patas:
- INDUSTRIA: P2_42 + el fill-only de RJG + el paper DTU 2017 (hallar el punto V/P fue
  central a su validación) + la patente de la espiral (velocidad 1 in/s + limitador =
  un sistema V/P leído a la letra).
- FÓRMULA: en la fase de presión, dL/dt = h²P₀/(12ηL) ⇒ **L² = L₀² + (h²P₀/6η)(t−t₀)**
  ⇒ L ∝ √t (Washburn 1921) y v decae como 1/√t — la desaceleración de los videos.
- OPERADOR 𝔄: Q y P son variables CONJUGADAS del mismo puerto; las dos fases son las
  dos CARAS de la condición de frontera. El switchover = rotar la boquilla de fuente
  (Q en el vector b) a Dirichlet (p = P₀) — MISMO Laplaciano, se intercambia dato y
  respuesta en UN nodo (~25 líneas). Y el exponente ½ sale de la simetría de escala
  de la cara-presión (sin tasa impuesta, L única longitud): dimensional puro.

## ALCANCE ACOTADO (declarado en la justificación, no a lo wey)
- El creep ISOTERMO no sabe parar (lo frena la congelación = N2). Por eso:
  - default `modo: 'stop'` → los 105 porteros existentes deben quedar IDÉNTICOS
    (el dado nunca conmuta: p_max 2.83 ≪ 140).
  - la ESPIRAL conserva su protocolo de patente (stop en el limitador) y gana una
    línea MEDIDA del creep desbocado (rebasa la herramienta) = el caso de aceptación
    del N2, impreso, con los 75 mm faltantes (552−477) repartidos por nombre.
- Sin cambios de UI ni video: la desaceleración se ENSEÑARÁ cuando tenga su física
  completa (E6 empaque en el dado / N2 en la espiral).

## LO QUE SE CONSTRUYE
1. `fan.ts`: opción `switchover: { modo: 'stop'|'presion', tMaxS?, qMinFrac? }`.
   En fase 2: la boquilla sale de las incógnitas (Dirichlet P₀ vía el vector b),
   Q_in se MIDE del solve, el reloj pasa de volumen/Q a flujo integrado (Q varía),
   termina por: lleno · t ≥ tMaxS · Q < qMinFrac·Q₀. AUDITORÍA fase 2:
   |Σ flujos al frente − Q_in| / Q_in ≤ 1e-6 (ambos calculados — consistencia
   interna del operador con frontera rotada).
2. Gate:
   - ORÁCULO WASHBURN: tira sintética con conmutación temprana (P₀=8 MPa) →
     L²(t) lineal con pendiente h²P₀/6η (±3 % en 3 instantes).
   - CONTINUIDAD: ni p ni v saltan en la conmutación (v antes ≈ v después ±10 %).
   - los 105 existentes verdes SIN CAMBIO (default 'stop').
   - CREEP DESBOCADO (informativo-medido): espiral 238 °C con 'presion' y tMax 10 s
     protocolo → L rebasa la herramienta (≥799 mm) — la térmica del N2, cuantificada.

## YA-EXISTE
- el CG con Jacobi y la auditoría (solo rota la frontera) · el reloj de volumen
  (fase 1 intacta) · etaEfectiva · la tira y la espiral de los gates.

## TOCA
- src/forja/mold/fan.ts
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
- scripts/comando-scan.cjs
- scripts/narracion-gen.py
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
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- gate: Washburn ±3 % · continuidad ±10 % · 105 existentes idénticos · creep
  desbocado medido e impreso · orden-gate VERDE.
- `node scripts/ciclo-dado-test.cjs` sin pipe (exit code real).
- build+deploy (paridad del bundle) — sin cambio visual esperado.

## CIERRE (2026-08-14)

- **gate 110 pasan · 0 fallan** (105 + 5 del switchover) · orden-gate VERDE ·
  build+deploy de paridad.

- **WASHBURN CLAVADO**: en la cara de presión, L sigue √t con peor error **0.5 %**
  en 3 instantes · continuidad en la conmutación 0.675 vs 0.697 m/s (la v decae
  DENTRO de la ventana — no hay salto) · el caudal decae a 10.8 % de Q₀ ·
  auditoría fase 2 (Σflujos = Q_in MEDIDO) 9.4e-10.

- **UN BUG PROPIO CAZADO POR EL ORÁCULO ANTES DE ENTREGAR**: la primera versión
  del reloj de fase 2 integraba dt por flujos y salió 10× lenta contra Washburn
  (−62 %) — EL MISMO bug del disco que ya habíamos matado (la cola débil del lote
  infla el tiempo), reintroducido por mí. Fix: el reloj de fase 2 es volumen
  colocado / Q_in medido del solve — "los flujos deciden el ORDEN; la conservación
  decide el TIEMPO", segunda vez que la regla cobra. El oráculo cerrado pagó su
  boleto en la misma sesión en que nació.

- **EL CREEP DESBOCADO, IMPRESO**: espiral 238 °C en modo presión con los 10 s del
  protocolo → 799.8 mm (rebasa la herramienta) vs 477 en stop vs 552 medidos.
  El reparto queda cuantificado con nombre: fase de velocidad = 477 (nuestro),
  creep-hasta-congelar = los ~75 mm que faltan, y el freno es TÉRMICO — el caso
  de aceptación del N2, medido antes de escribirse.

- El dado NO conmuta (2.83 ≪ 140): los 105 porteros previos idénticos, como
  exigía el alcance. La fase-presión queda lista como infraestructura de la
  estación 6 (empaque ES control por presión) y del benchmark de Ljubljana
  (P1 impuesta + 1,075 muestras de sensores).
