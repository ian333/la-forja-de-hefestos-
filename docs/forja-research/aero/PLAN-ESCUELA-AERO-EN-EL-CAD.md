# ESCUELA DE AERONÁUTICA Y DISEÑO DE AERONAVES — EN LA FORJA CAD

> **La regla que rompí dos veces y ya no:** la escuela vive en `forja-brep.html`,
> el Part Studio. NO en masterclasses cine, NO en los laboratorios de la
> universidad. El alumno CONSTRUYE la geometría con croquis y cotas, y la
> ANALIZA con un estudio del CAD — exactamente como el libro de mecánica
> (59 lecciones: croquis→extrude→FEA→DIN→planos→ensambles, checks del kernel).

## La estructura de mecánica (el molde a copiar, verificado lección por lección)

- **Una lección** = JSON en `public/escuela/lecciones/` con pasos: `dice`
  (la física narrada, desmitificando) + `gestos` que manejan el CAD REAL
  (tclick de botones, clickmm en mm del croquis, fill de cotas, picks de
  caras, orbit) + `check` contra **invariantes del kernel** (vol exacto) o
  del solver (FEA: von Mises).
- **El estudio** (mec-sim-l1, la plantilla): el alumno DIBUJA la viga →
  extrude → pestaña `tab-simulacion` → fija cara → carga → `btn-fea` →
  el campo pintado SOBRE su pieza + número verificado.
- **Lo normalizado se INVOCA** (mec-u6-l3): `btn-din` → DIN 933 M8×16 =
  1,501 mm³ regenerado de la norma. No se dibuja a mano lo que tiene norma.
- **Las features nacen del libro**: rack, rosca, explode, GD&T, motion, DIN
  se construyeron cuando una lección las exigió (libro→módulo→test→gate).
- **Video**: guion → XTTS Matilda → clase-drive graba el CAD manejado →
  4K → Downloads ×2. CLASE_OK antes de cualquier voz.

## Lo nuevo que el libro de aero exige del CAD (en orden)

1. **`panel2d.ts`** — método de paneles Hess-Smith (Anderson §3.17, §4.10):
   flujo alrededor de CUALQUIER sección cerrada. Tests: Cp del cilindro =
   1−4sin²θ exacto; pendiente CL ≈ 2π (+corrección de espesor); Cp del
   NACA 4412 vs Anderson Fig. 4.25. El motor ya construido se reusa:
   `atmosfera.ts` (8/8), `cuna-anderson.ts` (8/8), `potencial.ts` (9/9,
   bug del vórtice del lab cazado por ∮u·dl=Γ).
2. **ESTUDIO VIENTO** en `tab-simulacion` (hermano del FEA, integración
   quirúrgica al monolito): parámetros α, V, **altitud h (ISA integrada:
   ρ, a, q en vivo)**, subsónico (paneles) / supersónico placa-cuña (p, τ
   del Ej. 1.1 + β de θ-β-M). Overlay en el viewport: **Cp pintado sobre
   la piel de la pieza real**, líneas de corriente alrededor del sólido,
   flechas p/τ, vector L. Invariantes expuestos: CL, L′, D′, cd, x_cp, q,
   Re, Γ → los checks de las lecciones.
3. **`btn-naca`** en la biblioteca (patrón btn-din): perfil NACA 4 dígitos
   como CROQUIS real (editable, acotable, extruible). `naca.ts` con camber
   (fórmulas de 1933); test: ordenadas del 2412 vs tabla de Abbott LITERAL.
4. Después (U5+): estela/ala finita (lifting-line sobre el ala EXTRUIDA:
   AR y S medidos del kernel), polar, y el capstone Raymer.

## Las lecciones re-mapeadas (todas EN el CAD; fixtures literales)

- **a1-l1 Las dos manos (Anderson Ej. 1.1)**: DIBUJAS la cuña de 5° con
  cotas (croquis triángulo, c=100 mm) → extrude → estudio Viento M=2 →
  flechas p (constantes tras el choque) y τ (decayendo) SOBRE tus caras →
  la integral converge a D′=1.24×10⁴ N/m, cd=0.022, 85/15.
  Checks: vol del kernel + cd del solver.
- **a1-l4 La atmósfera**: misma cuña, mueves la ALTITUD del estudio:
  ρ/a/q caen con la tabla ISA (22 632 Pa en la tropopausa, isoterma).
  El estudio es el laboratorio; la pieza es TUYA.
- **U2-U3 (ecuaciones y potencial)**: cilindro extruido → estudio → Cp =
  1−4sin²θ; con circulación → L′=ρVΓ. d'Alembert: D=0 y qué significa.
- **U4 (perfiles)**: `btn-naca` 2412 c=100 → estudio → Cp(x) vs datos,
  CL=2πα, α_L0 de la curvatura, stall (dónde la teoría deja de ver).
- **U5-U7 (ala finita y avión)**: extruyes el ALA (planform con taper por
  cotas), costillas por patrón, larguero (FEA + Viento en la MISMA pieza:
  mecánica y aero se encuentran), polar CD=CD0+K·CL².
- **U8-U10 (diseño de aeronaves, Raymer)**: sizing (S y AR medidos del
  kernel de TU ala), ensamble ala+fuselaje+cola, vista explosionada,
  planos con GD&T del ala — el libro de mecánica y el de aero cierran en
  el mismo producto: UN AVIÓN diseñado y analizado en La Forja.

## Qué pasa con lo ya hecho

- `AeroClase.tsx` (cine) y los 2 labs de physics.html: quedan como material
  de la universidad/marketing futuro, **NO son la escuela**. Los 2 videos
  "ESCUELA-AERO-U1L1/U1L4" entregados hoy quedan RECHAZADOS y se rehacen
  en el CAD. La física pura (25 tests) es el motor del estudio: se reusa todo.
