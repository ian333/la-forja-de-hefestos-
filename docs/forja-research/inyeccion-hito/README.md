# HITO 2026-07-17 — El motor de inyección de La Forja

> "esto es un hito de otro nivel" (Ian). Las LÍNEAS DE SOLDADURA emergen de
> nuestro propio campo — lo que Moldflow/SolidWorks Plastics venden, saliendo
> de un Dijkstra pesado por la física del libro.

## La cápsula (todo reproducible)

| video (Downloads) | script | cadena iangpu | telemetría del run |
|---|---|---|---|
| `inyeccion-3d-4k.mp4` (tupper) | `scripts/inyeccion-3d-video.cjs` | `scripts/_iny3chain.sh` | (anterior a la telemetría) |
| `inyeccion-bezel-4k.mp4` | `scripts/inyeccion-bezel-video.cjs` | `scripts/_inybzchain.sh` | `telemetria-bezel.json` |
| `inyeccion-familia-4k.mp4` | `scripts/inyeccion-vaso-video.cjs` | `scripts/_inyvzchain.sh` | `telemetria-familia.json` |
| `inyeccion-molde-4k.mp4` | `scripts/inyeccion-molde-video.cjs` | `scripts/_inymdchain.sh` | `telemetria-molde-ab.json` |

Motor: `src/forja/mold/flowlen.ts` (campo de resistencia Eq 5.22 + EDT chamfer +
espesor Hildebrand-Rüegsegger + saltos de caballo + `parent[]` árbol de
alimentación + `root[]`/`computeWeldMask` soldaduras). Colada: `feed.ts` (Eq 6.5,
verificada contra el hot runner del bezel p.139-144). Cada script corre su gate
de telemetría ANTES del raster (`VERIFY_RESULT`, exit 2 si truena).

## Los números que confirman las soldaduras

- **bezel (2 caídas del libro)**: costura entre compuertas a **0.3 mm** del punto
  medio exacto; centroide x̄=119.8 (simetría predice 120); reparto 52/48.
- **familia (vaso+tapa)**: costuras LEJOS de su compuerta (arco del borde de la
  tapa, Y del piso del vaso — topología Moldflow); tapa termina al **99.4 %** del
  tiro (desbalance ΔP 89.9 vs 83.7) → balanceo Eq 6.8: rama tapa **R 2.47 mm**.
- **molde A/B**: compuerta directa al centro ⇒ **sin** soldaduras (axisimetría
  verificada ±0.2 % en 4 puntos del aro) — el control negativo del detector.
- **race tracking del cordón** (hallazgo): en la tapa, el fundido corre el ANILLO
  de la esquina piso-falda (L 226 mm vs 147 "directo") porque la unión es más
  gruesa — el "picture frame effect" real; por eso la ΔP de pieza se calcula con
  la INTEGRAL del campo, no con una L de placa.

## Lo que falta para cerrar

- SEVERIDAD de cada soldadura = a qué T chocan los frentes → integración térmica
  del ciclo completo (task #36).
- Validación lado a lado vs Moldflow / pieza física.
