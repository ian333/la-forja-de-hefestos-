# ESCUELA DE MECÁNICA — Currícula maestra (Bethune → La Forja)

**Fuente:** Bethune & Brown, *Engineering Design and Graphics with SolidWorks 2023* (1,824 pp, 11 caps).
PDF + texto por capítulo: `docs/forja-research/manuales/bethune/` (`ch01.txt`…`ch11.txt`).
**Misión:** el libro COMPLETO como lecciones de La Forja. La mejor escuela de mecánica del mundo:
gratis, en español, en el navegador, con un CAD real (kernel OCCT) y verificación exacta por invariantes.

## La regla de oro: UNA lección = UN archivo de datos → TRES salidas

Cada lección vive en `src/escuela/mecanica/lecciones/<id>.json` (pasos: narración + gestos + checks) y de ahí salen:

1. **CLASE EN VIDEO** — `scripts/escuela/clase-drive.cjs` maneja La Forja real en pantalla (cursor
   visible + hint bar + subtítulos quemados) mientras la voz Matilda (XTTS iangpu) narra cada paso.
   Master 4K HEVC 10-bit (MANDATO 4K). Sale a YouTube; recortes → reels.
2. **TUTORIAL INTERACTIVO** — overlay dentro de `forja-brep.html` que muestra el MISMO paso y valida
   con los MISMOS checks (invariantes del kernel: vol/euler/ops/DOF). El alumno lo hace con SUS manos.
3. **RETO CALIFICADO** — los "Chapter Projects" del libro con auto-calificación exacta: el kernel mide
   volumen/masa/topología de la pieza del alumno y compara contra la respuesta. Nadie más tiene esto.

**Método del libro (regla dura, ya validada en tut-proof):** dibujar A OJO → restringir → **ACOTAR**
(las cotas manejan la geometría). NUNCA teclear coordenadas. Ver [[feedback_sketch_cotas_no_coords]].

## Las 11 unidades (59 lecciones)

### U1 · Tu primera pieza (cap 1 — Getting Started) — 3 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u1-l1 | El lienzo: croquis, cota, extrusión, barreno (pieza completa en 5 min) | §1-2..1-6, 1-10, 1-13 | ✅ todo existe |
| u1-l2 | Navegar y orientar: zoom, órbita, vistas, el árbol de operaciones | §1-7..1-8 | ✅ |
| u1-l3 | SP1-1/SP1-2: perfil en L a ojo → totalmente restringido → sólido | §1-9, 1-12 | ✅ (probado c3/c4) |

### U2 · El croquis es el idioma (cap 2 — Sketch Entities and Tools) — 6 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u2-l1 | Círculos, rectángulos y sus variantes; el origen | §2-3..2-5, 2-7 | ✅ |
| u2-l2 | Ranuras (slots) y arcos (3 tipos) | §2-6, 2-8 | ⚠️ slot como lazo; arcos ✅ |
| u2-l3 | Polígonos, spline, elipse, cónicas | §2-9..2-11 | ⚠️ hexágono ✅ (tut hex), spline/elipse por puntos |
| u2-l4 | Fillet/chamfer 2D + texto en croquis | §2-12..2-14 | ⚠️ texto falta (etiquetar) |
| u2-l5 | Trim, extend, offset, mirror | §2-15..2-18 | ⚠️ offset ✅ kernel; trim/mirror 2D parciales |
| u2-l6 | Patrones lineal/circular 2D + mover/copiar/rotar/escalar; SP2-1..3 | §2-19..2-31 | ✅ patrón; edición parcial |

### U3 · Del croquis al sólido (cap 3 — Features) — 8 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u3-l1 | Extrude boss/cut + draft (ángulo de salida) | §3-2..3-4 | ✅ (btn-extrude/btn-draft) |
| u3-l2 | Barrenos: pasantes, ciegos, hole wizard | §3-5..3-7 | ✅ hole; wizard simplificado |
| u3-l3 | Fillet (variable, face, full-round) y chamfer (3 modos) | §3-8..3-9 | ⚠️ base ✅; variantes por arista |
| u3-l4 | Revolve boss/cut (flechas, poleas) | §3-10..3-11 | ✅ (probado c3-T2, c4-T2) |
| u3-l5 | Planos de referencia + croquis sobre cara | §3-12 | ✅ (input-plane-offset) |
| u3-l6 | Loft, Shell, Sweep | §3-13..3-15 | ✅ (tuts loft/sweep/shell) |
| u3-l7 | Hélices y resortes (compresión/torsión/extensión) + Wrap | §3-20..3-24 | ⚠️ sweep-helix ✅; wrap falta |
| u3-l8 | Editar features + patrones curve-driven; SP3-1..3 | §3-25..3-28 | ⚠️ editar ✅; curve-driven falta |

### U4 · Vistas ortográficas: el idioma del taller (cap 4) — 5 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u4-l1 | Tercer/primer ángulo; superficies normales, ocultas, inclinadas | §4-1..4-3 | ✅ (drawing.ts HLR real) |
| u4-l2 | Generar el plano: 3 vistas + mover vistas | §4-4 | ✅ (genPlano) |
| u4-l3 | Vistas de sección (+ alineadas) | §4-5..4-7 | ⚠️ section-tool 3D ✅; en plano falta |
| u4-l4 | Vistas rotas, de detalle, auxiliares | §4-8..4-10 | ❌ construir en drawing.ts |
| u4-l5 | Primer ángulo (norma europea) + proyectos | §4-11 | ⚠️ |

### U5 · Ensambles (cap 5) — 6 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u5-l1 | Tu primer ensamble: componentes + mates | §5-1..5-6 | ⚠️ asm/gearbox ✅; mates genéricos parciales |
| u5-l2 | Bottom-up: ensamblar piezas hechas | §5-7 | ⚠️ |
| u5-l3 | Vista explosionada + dibujo isométrico explosionado | §5-8..5-9 | ❌ construir (explode por dirección) |
| u5-l4 | BOM (lista de materiales) + globos | §5-10..5-11 | ⚠️ printReport ✅ base |
| u5-l5 | Cajetín, bloques de título y revisiones | §5-12 | ⚠️ cajetín del plano ✅ |
| u5-l6 | Motion study + detección de interferencias | §5-13..5-17 | ⚠️ gb-motion/verifyMeshing ✅; interferencia genérica ❌ |

### U6 · Roscas y tornillería (cap 6) — 5 lecciones  ← conecta con catálogo Weston (942 SKUs DIN)
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u6-l1 | Terminología de rosca + callouts ANSI métrico/unificado | §6-1..6-4 | ✅ (teoría + plano) |
| u6-l2 | Roscas internas y barrenos ciegos roscados | §6-5..6-8 | ⚠️ cam-tap ✅; rosca cosmética en plano ❌ |
| u6-l3 | La biblioteca de diseño: tornillos DIN reales | §6-9..6-12 | ✅ (fasteners/ 942 SKUs) |
| u6-l4 | Largo de rosca, tuercas, arandelas (smart fasteners) | §6-11..6-13 | ⚠️ |
| u6-l5 | Opresores (set screws) + rosca en costado de cilindro | §6-14..6-16 | ⚠️ |

### U7 · Acotación ANSI (cap 7) — 6 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u7-l1 | Terminología, convenciones y errores comunes | §7-1..7-2 | ✅ (teoría + cotas sketcher) |
| u7-l2 | Acotar en el plano: lineal, baseline, ordinate | §7-3, 7-9..7-10 | ⚠️ cotas en drawing.ts parciales |
| u7-l3 | Barrenos, counterbore, countersink, patrones | §7-6..7-8 | ⚠️ |
| u7-l4 | Escala, unidades, redondeos internos/externos | §7-4..7-5, 7-12..7-14 | ✅ |
| u7-l5 | Polares, chaflanes, símbolos, simetría | §7-16..7-19 | ⚠️ |
| u7-l6 | Acotar secciones y vistas ortográficas completas | §7-20..7-22 | ⚠️ |

### U8 · Tolerancias: el corazón de la manufactura (cap 8) — 8 lecciones
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u8-l1 | ± directas, expresiones, límites | §8-2..8-6 | ❌ anotación en plano (construir) |
| u8-l2 | Angulares, estándar, doble-acotado (error) | §8-7..8-9 | ❌ |
| u8-l3 | Cadena vs baseline + estudios de tolerancia | §8-10..8-11 | ❌ (calculadora = lab propio) |
| u8-l4 | Ajustes estándar métricos e inch (clearance/transition/interference) | §8-17..8-20 | ⚠️ tablas = datos; fea/fit lab |
| u8-l5 | Acabados superficiales + símbolos de superficie | §8-21..8-23 | ❌ |
| u8-l6 | GD&T I: forma (planitud, rectitud, circularidad, cilindricidad) | §8-25..8-32 | ❌ |
| u8-l7 | GD&T II: datums, orientación, perfiles, runout | §8-33..8-39 | ❌ |
| u8-l8 | GD&T III: posición, MMC, condición virtual, fixed/floating fasteners | §8-40..8-48 | ❌ |

### U9 · Baleros y ajustes (cap 9) — 3 lecciones  ← conecta con la experiencia cicloidal real
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u9-l1 | Baleros de camisa (sleeve) y de bolas; el journal | §9-1..9-4 | ✅ (revolve + asm) |
| u9-l2 | Ajustes para baleros: hole basis / shaft basis | §9-5..9-9 | ⚠️ tablas + lab |
| u9-l3 | Interferencia y ajustes en el ensamble; SP9-1 | §9-10..9-13 | ⚠️ |

### U10 · Engranes (cap 10) — 6 lecciones  ← La Forja YA genera involutas reales
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u10-l1 | Terminología y fórmulas de engranes | §10-1..10-3 | ✅ (gear() paramétrico) |
| u10-l2 | Crear el par de engranes + animarlo | §10-4 | ✅ (gearbox + gb-motion) |
| u10-l3 | Relaciones de transmisión + trenes | §10-5 | ✅ (verifyMeshing) |
| u10-l4 | Engranes + baleros + flecha: transmitir potencia | §10-6..10-8 | ✅ (shaft() + asm) |
| u10-l5 | Cuñas, cuñeros (keyseats) y opresores | §10-9 | ⚠️ keyseat por corte |
| u10-l6 | Piñón-cremallera + engranes métricos; SP10-1 | §10-11..10-12 | ⚠️ rack falta |
| | | | |

### U11 · Certificación Forjador (cap 11 — CSWA prep) — 3 lecciones + examen
| id | Lección | Fuente | Estado Forja |
|---|---|---|---|
| u11-l1 | Cubos y perfiles: leer un dibujo y modelarlo contra reloj | §11-2..11-3 | ✅ |
| u11-l2 | Objetos 3D chicos: la técnica del examen | §11-4 | ✅ |
| u11-l3 | Examen Forjador: N piezas, calificación por invariantes exactos | proyectos | ✅ (auto-grade) |

## Orden de producción (por valor y por brechas)

1. **U1 completa** (todo existe; valida el pipeline de clases en video) ← EN CURSO
2. **U3 + U2** (features y croquis: el corazón; casi todo probado en tut-proof)
3. **U10** (engranes: nuestro diferenciador — involutas reales + animación + mecánica propia)
4. **U4 + U7** (planos y acotación: motor drawing.ts; construir vistas detalle/aux + cotas de plano)
5. **U6 + U9** (tornillería con el catálogo DIN propio; baleros con la experiencia cicloidal)
6. **U5** (ensambles: exige mates genéricos + explode — features nuevas)
7. **U8** (tolerancias/GD&T: exige anotaciones en drawing.ts — features nuevas; la teoría puede
   adelantarse como clases con labs de cálculo)
8. **U11** (examen al final)

## Después del Bethune (misma máquina, otros libros ya comprados)
- **Moldes de inyección** (SOLIDWORKS Advanced cap 6 + Kazmer) — el evaluador de manufactura
- **CAM** (Cimo caps 1-18: torneado/fresado/láser/aditivo) — workspace manufactura ya existe
- **PCB** (EasyEDA / NOVA), **aerodinámica**, **electricidad** — pilares siguientes

## Reglas de autoría de las clases (heredan del proyecto)
- Español mexicano (tú/tienes). Narración con aire (~0.6 s entre frases).
- Gancho en los primeros 5 s (curiosity gap / in-medias-res: la pieza terminada girando ANTES de empezar).
- El video muestra LA HERRAMIENTA REAL manejándose sola (cursor visible + hint bar + subtítulos).
- Verificación SIEMPRE: cada lección cierra con el invariante del kernel (volumen/masa exactos) —
  "el kernel no miente" es el sello de la escuela.
- Master 4K (3840×2160 horizontal para clases) HEVC 10-bit NVENC. 1080 solo preview.
