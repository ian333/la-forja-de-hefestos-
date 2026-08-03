# PLIEGO DE UI v2 — Software de diseño y revisión de moldes de inyección

**Cliente:** casa de diseño de moldes de clase mundial. **Dos objetivos declarados por el cliente:**
(1) que sus ingenieros **APRENDAN** su proceso; (2) que puedan **REVISAR MUCHOS MODELOS** (decenas de
piezas por lote, no una).

**Dos fuentes, cero invención:** el LIBRO del cliente (proceso documentado paso a paso, caps. 1–13 +
Apéndices A–F) y las GRABACIONES MUDAS de sus ingenieros trabajando en SolidWorks (54 sesiones
catalogadas; 8 observadas a detalle, ~245 min). **Toda afirmación de este pliego cita § del libro o
sesión @ minuto. Lo no observado se declara. Las extensiones se marcan [EXTENSIÓN DECLARADA].**

Documentos hermanos (todos en este mismo folder): `sesiones-ingenieros.md` (anexo de evidencia:
catálogo, fichas completas, mapa de tiempo, límites del estudio), `cruce.md` (el cruce libro×sesiones
con el detalle completo de N-01…N-32 — cuando este pliego dice "el cruce", es ese archivo) y los 4
tomos `libro-caps1-3.md` / `libro-caps4-6.md` / `libro-caps7-9.md` / `libro-caps10-13.md` (requisitos
R-xx extraídos del libro; ahí resuelven las citas R-090 de N-18 y R122 de N-28/E-12). Ojo: los
`pliego-caps*.md` de este folder son respaldos del experimento 2026-07-31 — documentos DISTINTOS que
NO usan la numeración R-xx de este pliego. Este pliego NO sustituye al `pliego-UI.md` original; es la
versión conjunta libro×sesiones.

---

## 1. Resumen ejecutivo

El libro del cliente es un método **CALCULADO**: cada subsistema del molde (alimentación, agua,
expulsión, contracción, estructura) tiene su cadena de fórmulas, sus checklists de cierre y sus
decisiones documentadas (§1.5, Fig. 1.9). Las 8 sesiones observadas muestran la práctica real de sus
ingenieros: **~48% del tiempo se va en modelar placas prismáticas y teclear barrenos de catálogo a
mano** (~118 de ~245 min; fichas 004/007/013/020/025/028/040/048), y las fases donde el libro
concentra su ingeniería consumen minutos de TALLADO pero **cero minutos de CÁLCULO en pantalla**
(`cruce.md`; anexo §4, mapa de tiempo). La verificación es 100% ocular: en 8 sesiones y ~245 minutos, Interference
Detection aparece **cero** veces (013 @ 32.1; 025 D4).

El software tiene por eso dos modos que responden exactamente al hueco entre libro y práctica:

- **Modo APRENDER** — el proceso del libro como flujo navegable de pantallas, con cada fórmula VIVA
  (números intermedios + § visible), las piezas de ejemplo del libro (bezel, cup/lid, contenedor)
  como recorridos reproducibles número por número (§3.3–3.4 Tabla 3.2; §9.2.2–9.2.5; §10.1–10.3), y
  el conocimiento tácito que las sesiones revelan pero jamás explican (Feature Scope, Move Face
  0.50 mm, la convención cuerpo→archivo) convertido en lecciones explícitas.
- **Modo REVISAR EN VOLUMEN** — los checklists del libro (§7.4, §8.4, §9.4, §12.5, §4.3.3) corridos
  AUTOMÁTICOS sobre un lote de N modelos: tabla con semáforo por criterio, orden por severidad,
  drill-down a la evidencia, y las verificaciones que hoy el experto hace girando un wireframe
  (alineación de stack, simetría, agua vs cavidad) ejecutadas por regla sobre decenas de archivos.

### Top-5 de necesidades (doble respaldo: § del libro + sesión @ minuto)

| # | Necesidad | El libro dice | Las sesiones muestran |
|---|-----------|---------------|------------------------|
| 1 | **N-15 Base paramétrica de catálogo** | El mold base se ESPECIFICA y se COMPRA estándar (§4.3.2); proveedor con 7 criterios, custom ≤1 semana (§4.3.4) | ~10 min/molde modelando placas desde cero, en 8/8 sesiones; cero bibliotecas DME/HASCO en ningún frame (013 min 18.5–27.8; 048 m 19.2–23.6; 007 min 23.3–26.4, cotas 246/266/286 de memoria) |
| 2 | **N-16 Hardware por receta funcional** | Cada familia de barreno tiene función y regla: unión §12.4.2, dowels §12.4.3, retorno §11.3.8, agua Rc §9.1.6, armella por peor caso de grúa §12.4.2 | Hole Wizard es LA actividad: 21/59 frames en 004, ≥18/60 en 020, ≥12 en 040; cada barreno se especifica y posiciona uno por uno (004 dolor 1: "trabajo repetitivo de catálogo, no de diseño") |
| 3 | **N-29 Revisión batch con los checklists del libro** | Checklists de cierre §7.4 (gates), §8.4 (venteo), §9.4 (agua), §12.5 (estructural, 3 veredictos) + 4 semáforos de máquina §4.3.3 | Cero Interference Detection en 8 sesiones; inspección = isos translúcidos, Section View y wireframe girado (013 @ 32.1; 028 @ 21:52–22:24; 020 @ 25:04) |
| 4 | **N-22/N-23 Agua calculada y verificada** | Flujo de 7 pasos §9.2: t_c → potencia → caudal → D → profundidad → pitch → ruteo; ½D de acero contra todo componente §9.2.7; el warpage por pitch NO se cura con ciclo (§9.2.6) | El cap. 9 completo está ausente: 25% de la sesión 007 en taps Rc uno por uno (min 5.7–14.5); la única verificación del circuito es mirarlo por transparencia (013 min 30.9) |
| 5 | **N-19 Solver de alimentación alimentando el CAD** | Cadena caudal→ΔP→diámetro por segmento→estándar→steel-safe (ecs. 6.7–6.9, §6.5.4–6.5.5); 3 semáforos de gate (Tablas 7.2–7.4) | Cotas de memoria sin un solo cálculo: R3×10×30 (007 min 1.6), 2.50 mm/~20° (048 m 1.2), 30° sobre la sección (028 h3-f44 min 23:28) |

---

## 2. Método

- **Fuente 1 — el libro del cliente:** 4 tomos analizados por separado (caps. 1–3, 4–6, 7–9,
  10–13 + Apéndices A–F), leídos íntegros; cada requisito extraído cita su § literal. Los tomos
  producen ~470 requisitos fuente (74 + 132 + 119 + 127 + transversales) que este pliego consolida.
- **Fuente 2 — las sesiones:** 54 grabaciones mudas de SolidWorks catalogadas (duración medida con
  ffprobe); muestra de **8 sesiones — en 8 familias del catálogo, la más larga de cada una** (la
  más completa): 004 cuchara 27.5 min, 007 hair clip 31.3, 013 base multi-cavidad
  37.4, 020 crystal cup 31.7, 025 bracket 24.3, 028 tres placas/handle 32.1, 040 slider 36.9,
  048 bottle cap 24.2 — total ≈ 245 min, muestreados a 1 frame cada 24–37 s en hojas de contacto.
  **La muestra NO cubre todas las familias del catálogo** (declarado): spool, water bottle, moffler,
  slider hidráulico/phone holder y tres placas Horn (076: 46.79 min, la sesión MÁS LARGA de todo el
  corpus) quedaron sin representante, además de sesiones sueltas como 050 (38.52 min) y 062/063
  (bases estándar por título) — lista completa y consecuencias en el anexo §2 y §5.3/§5.8.
- **Cruce por taxonomía compartida de 12 fases:** pieza | dfm-draft-escala | particion |
  superficies | tooling-split | mecanismos | base-placas | alimentacion | agua | expulsion |
  planos | revision. Por cada fase: (a) el libro dice [§], (b) las sesiones muestran [sesión @
  minuto + costo en minutos], (c) necesidad de UI conjunta (N-01…N-32).
- **Regla dura:** nada inventado. Los videos son MUDOS: la intención solo es visible en ~33 rótulos
  quemados en total (conteo de las fichas del anexo: 004:5, 007:7, 013:4, 020:5, 025:3, 028:1,
  040:3, 048:5); todo "porqué" ausente se trata como ausente. Los minutos son aproximados
  (derivan de frames muestreados). Lo ilegible se marca "no legible"; lo que no aparece, "no
  observado". Límites completos del estudio: ver anexo `sesiones-ingenieros.md` §5.

---

## 3. Roles / personas

**Del libro** (los dueños de cada palanca, §10 intro — la dimensión final es responsabilidad
COMPARTIDA):

- **Diseñador de molde** — el usuario principal del software; decide partición, alimentación, agua,
  expulsión, estructura (§1.5) y emite la recomendación de contracción (§10.1.7).
- **Moldeador (molder)** — aporta datos de máquina (presión máxima §6.2.2, knock-outs §11.3.8
  R64, ficha de máquina §4.3.3) y valida capacidades (§6.4.1: "verify the capabilities of the
  molder"); ejecuta el tryout.
- **Cliente / diseñador de producto** — entrega worksheets de aplicación, producción, uso final,
  regulatorio y estética (§2.2.1–2.2.3, Tablas 2.1–2.7) y la ficha de material de 18 propiedades
  (§2.2.5, Tabla 2.10); con él se negocian undercuts (§2.3.7) y mejoras de pieza (§2.2.4).
- **Proveedor de material** — datos de resina (PvT, contracción recomendada, shear máximo; §10.1.7,
  §7.3.2) que la UI confronta, no sustituye.
- **Proveedor de mold base** — asigna alturas "S" y "C" (§4.3.2); se elige con 7 criterios (§4.3.4).
- **Contacto técnico interno** — canal para dudas "potencialmente triviales" sin molestar al
  cliente (§2.2.1, Tabla 2.2).

**De lo observado en sesiones:**

- **El ingeniero de detallado** — una sola persona ejecuta todo el detallado en un part multicuerpo,
  en sesiones seriadas por fase ("PART 1 MOLD BASE" 013; "PART 2 MOLD SPOON YT" 004; "PART 2 MOLD
  HC" 007; "PART 3 PLASTIC THREAD" 040): la partición/split se hereda de sesiones previas en 7 de 8
  casos (004 F11; 007 min 0.5; 013 min 0.6; 020 @ 0:32; 028 h1-f4; 040 min 13.6; 048 @ 0.4).
- **El junior (persona objetivo del modo APRENDER)** — quien hoy solo tiene videos mudos donde la
  intención vive en ~33 rótulos quemados; no puede heredar el porqué (007 dolor 7: "cero telemetría
  de intención").
- **El revisor/lead (persona objetivo del modo REVISAR)** — quien hoy revisaría 30 modelos con el
  mismo método observado: girar wireframes a ojo, uno por uno (013 @ 32.1; 040 D4).

---

## 4. El PROCESO como flujo de UI — mapa de pantallas con retornos

Columna vertebral en el orden del libro (§1.5, Fig. 1.9: Layout → Alimentación → Agua → Expulsión →
Estructura → maquinado/pruebas, con los gates "Project OK?" y "Moldings OK?"). Cada pantalla anota
los **minutos reales observados** de esa fase en las 8 sesiones (~245 min totales). Regla global de
navegación: **editar una fase marca STALE todo lo de río abajo** — cita literal §1.5: "the placement
of ejector(s) may require a redesign of the cooling system" (N-32).

```
[P1 PIEZA] intake mínimo 4 campos (§2.1.5) · worksheets vivos (§2.2, Tablas 2.1–2.9)
   │        · ficha de material del CLIENTE (§2.2.5, Tabla 2.10)
   │        (obs.: ~2 min de 245 = solo cold-opens; la pieza llega importada:
   │         025 @ 0.4 Insert Part; 048 @ 0.4; material JAMÁS visible)
   ▼
[P2 DFM-DRAFT-ESCALA] checklist DFM 9 puntos (Tabla 2.8) · draft (Tabla 2.14, §2.3.6)
   │        · detector de undercuts (§2.3.7) · CONTRACCIÓN: cadena PvT→s→banda→acta
   │          (§10.1.1–10.1.7, ecs. 10.2–10.13) · steel-safe (§10.2.2)
   │        (obs.: ~0.4 min — solo 025 min 1.2–1.6: panel Scale de 24 s, factor NO legible;
   │         Draft Analysis: no observado en ninguna sesión)
   │◄────── retorno: el espesor mínimo depende del ΔP del feed (§5.5.2) — si cambia
   │         el feed, se re-dispara el cálculo de espesor
   ▼
[P3 COTIZACIÓN Y CAVIDADES] break-even Ec. 3.1 · escenarios múltiples (§3.2.2)
   │        · costo del molde Ec. 3.2 · GATE "Project OK?" (§1.5, Fig. 1.9)
   │        (obs.: 0 min — cap. 3 completo sin rastro en las 8 sesiones)
   ▼
[P4 PARTICIÓN] dirección de apertura, 2 criterios (§4.1.1) · parting line en borde
   │        no-visual porque SIEMPRE deja witness (§4.1.2) · costo del no-plano
   │        mostrado AL ELEGIR (§4.1.3) · mapa de venteo del plano de partición (§8.2.2)
   │        (obs.: heredada en 7/8 sesiones; solo 025 min 2.0–3.2 en vivo, con el
   │         warning amarillo de shut-off BRINCADO sin resolver — 025 D2)
   ▼
[P5 SUPERFICIES] shut-offs = nº de ventanas (§4.1.4) · interlocks ≥5° (§4.1.3)
   │        (obs.: 025 min 3.2–4.4 superficie plana A MANO, ~1.2 min; 048 = separación
   │         100% booleana sin superficies; Mold Tools Shut-off/Parting Surfaces: 0 usos)
   ▼
[P6 TOOLING-SPLIT] colchón 3×D agua (§4.2.1–4.2.2) · cheek ≥ profundidad (§12.2.4)
   │        · redondeo a incremento estándar (§4.2.1) · material por Tabla 4.1 (§4.4.4)
   │        · fits λ=0.001·C·D^⅓ (§12.4.1, Tabla 12.1)
   │        (obs.: 025 min 4.8 Block Size 40/60 tecleado sin referencia; holguras =
   │         Move Face 0.50 mm cara por cara, 020 @ 13:20 y @ 19:44)
   │◄────── retorno: L/W del inserto solo se reducen si enfriamiento/estructura lo
   │         respaldan (§4.2.3) → invalida mold base si cambian
   ▼
[P7 BASE-PLACAS] spec de compra L×W, A/B/S, carrera E (§4.3.2) · layout <2:1 (§4.3.1)
   │        · holguras ≥½D (§4.3.2) · 4 semáforos de máquina (§4.3.3)
   │        · ═══ GATE DE COMPRA: nada se ordena sin verde (§4.3, "any mistakes…") ═══
   │        (obs.: ~118 min = 48% del total, TODAS las sesiones, 100% a mano:
   │         placa por placa + maratón Hole Wizard + 19 Mirrors en 040)
   │◄────── iteración insertos↔base declarada NORMAL por el libro (§4 intro);
   │         dimensiones firmes vs difusas marcadas para compra concurrente (§1.5)
   ▼
[P8 ALIMENTACIÓN] presupuesto ΔP ≤50%/50 MPa (§6.2.2) · solver ecs. 6.7–6.9 ·
   │        estándar y STEEL-SAFE HACIA ABAJO (§6.5.4–6.5.5) · triple semáforo del
   │        feed (§6.4) · gates: shear/ΔP/freeze independientes (Tablas 7.2–7.4)
   │        (obs.: ~21 min de pura geometría, cero cálculo: 007 min 0.5–2.1 y 16.0–17.1;
   │         013 min 13.6–17.9; 028 tres visitas; 048 m 0.8–3.6)
   │◄────── retorno: gate cae en sección delgada → reconsiderar 3 placas/hot runner
   │         (§7.3.4) — invalida gate y runner dimensionados
   ▼
[P9 AGUA] 7 pasos §9.2 · D∈[D_min,D_max] estándar (§9.2.4) · profundidad 2D–5D (§9.2.5)
   │        · pitch H–2H (§9.2.6) · ½D de acero contra TODO (§9.2.7) · core esbelto
   │        por diámetro (Tabla 9.3) · ≤2 conexiones o etiquetar in/out (§9.1.6)
   │        (obs.: ~17 min de taps Rc y barrenos a pulso: 007 min 5.7–14.5 = 25% de su
   │         sesión; verificación por transparencia 013 min 30.9; cero cálculo)
   │◄────── retorno: layout infeasible → agrandar insertos y base (§9.2.7) → invalida P7
   │◄────── retorno: el runner domina el ciclo (t_c 22.9 s > 18.9 s) → achicar
   │         diámetros del feed (§9.2.1) → invalida P8
   ▼
[P10 EXPULSIÓN] Feject ec. 11.7 (Aeff "liga elástica", NO área proyectada §11.2.2) ·
   │        D por el peor de compresión/cortante/pandeo (§11.2.3, §11.3.1) · layout
   │        donde se genera la fricción (§11.2.5) · pin como VENT (§8.3.2, claro 0.13)
   │        · pines keyed+etiquetados (§11.1.7)
   │        (obs.: ~24 min todo manual: pines a ojo sobre la silueta 004 @ 22:52;
   │         retículas 013 min 22.2–29.7; cotas 97/112/51 de memoria 025)
   │◄────── retorno: pin ↔ línea de agua en conflicto (§11.2.5) → renegociar P9
   ▼
[P11 MECANISMOS] slider: ángulo ≤20°, stroke = L·sin(φ)+~25 mm, la carga la lleva el
   │        HEEL BLOCK (§11.3.7, ec. 11.26) · core pull F=P·A (§11.3.6, ec. 11.24) ·
   │        seguridad: resorte + limit switches (§11.3.6–11.3.7)
   │        (obs.: ~23 min a pulso: 040 min 28.4–29.0 Cut-Revolve del perno con ángulo
   │         NO legible; 025 min 16.0–21.2 ranura+revolve a 7.31° sin pista del porqué)
   │◄────── (la decisión "esta pieza necesita corredera" nace en P2 con el detector
   │         de undercuts §2.3.7 mapeado a mecanismo y costo, Tabla 3.9)
   ▼
[P12 ESTRUCTURA] esfuerzo límite: peor-caso XOR factor (§12.1.1) · deflexión vs venteo
   │        0.02 mm (§12.1.2) · pilares donde se genera fuerza (§12.2.3) · tornillos
   │        por peor caso de grúa (§12.4.2) · dowels (§12.4.3)
   │        (obs.: 0 min de cálculo estructural en 245 min)
   │◄────── retorno: pilares chocan con eyección → reacomodar layout de pines (§12.2.3)
   ▼
[P13 PLANOS] fits mín/máx y tabla de eyectores bajan AUTOMÁTICO al plano por placa,
   │        sin retecleo (§12.4.1/§12.4.3/§11.2.6)
   │        (obs.: 0 frames de drawing en 8 sesiones y 245 min — el hueco de evidencia
   │         más grande del corpus; declarado, no rellenado)
   ▼
[P14 REVISIÓN Y CIERRE] checklists §7.4/§8.4/§9.4/§12.5 · GATE "Moldings OK?" (§1.5:
            tweak vs fatal flaw) · plan de tryout steel-safe unificado (§7.3.2+§8.3.1+
            §9.2.7) · acta de tecnología (§13.10) · cierre administrativo
            (obs.: ~15 min: inspección a ojo transversal + renombrar 14 cuerpos y
             Save Bodies → un .SLDPRT por placa: 007 min 27.9–31.0; 013 @ 32.7–37.0)
```

**Nota sobre el orden real observado:** el detallado NO sigue un orden fijo entre familias (agua
primero en 028 @ 0:32; resortes primero en 040 min 1.2; runner primero en 007 min 0.5). El flujo de
pantallas ordena por el libro; la navegación es libre con invalidación STALE, no un wizard rígido
(declarado en `cruce.md`, sección de huecos).

---

## 5. Modo APRENDER — requisitos

### 5.1 Fórmulas vivas (nada de caja negra)

- **A-01** Toda fórmula del libro se muestra VIVA: entrada → números intermedios → resultado, con su
  § pegado al número. Cadenas guía completas: alimentación (ecs. 6.7–6.9 con reparto ΔP
  proporcional a longitud), gates (Tablas 7.2–7.4), agua (la cadena 20,900 J → 1,050 W → 260 W/línea
  → 1 GPM → D∈[3.7,20] → 6.35 mm estándar del ejemplo cup/lid, §9.2.2–9.2.5), contracción (PvT Tait
  §10.1.2–10.1.4, cada iteración visible §10.1.5), expulsión (ec. 11.7 → 11.10/11.12 → Euler 11.16,
  señalando CUÁL límite domina), estructura (§12.2.2–12.4.3).
- **A-02** Los lazos de convergencia se iteran VISIBLES: velocidad recomendada del bezel (0.5 → 0.69
  → 0.77 → 0.80 → 0.82 m/s, §5.5.1) y la cúbica anisotrópica (§10.1.5) muestran cada paso.
- **A-03** Cada default lleva su cita y es editable: ΔP 50 MPa si no hay dato del moldeador
  (§6.2.2), melt T = punto medio del rango del proveedor (§5.5.1, §10.1.1), eficiencia de maquinado
  25% (§3.3.1.3). Cambiar un default exige justificación registrada.
- **A-04** Los supuestos conservadores se DECLARAN junto al número y el sistema **prohíbe apilar
  conservadurismos** (peor caso XOR factor de seguridad, §12.1.1; no agregar factor sobre la Feject
  ya conservadora, §11.2.2; regla transversal §10.1.7/§12.2.2).

### 5.2 Recorridos con las piezas de ejemplo del libro

- **A-05** Pieza guía end-to-end: el **bezel** (ABS, 1M piezas, 240×160×10, pared 1.5 mm) reproducible
  número por número: molde $74,800 → parte $0.47–0.48 (§3.3–3.4, Tabla 3.2); cadena de llenado 0.82
  m/s → 0.25 s → 125 cc/s → 83.2 MPa → 99 ton (§5.5.1–5.5.3); shear de gate 111,000 s⁻¹ y sus dos
  salidas (§7.3.2); 12+20 candidatos de venteo (§8.2.2); contracción completa hasta el acta
  (§10.1–10.2); 20 pines por el peor de 3 límites y el core pull de 4 toneladas (§11.2–11.3).
- **A-06** El **cup/lid** como lección de familia: el sprue domina el ciclo (26.7 s > 18.9 s,
  §6.4.7/§9.2.1), balanceo artificial con números (§6.4.6), freeze de gate 1.1 s vs pared 24 s =
  pieza mal empacada con todo lo demás verde (§7.3.4), gradiente de 6 °C del core y sus remedios
  (§9.2.7→§9.3), cheek/interlock/hoop/fits del cap. 12.
- **A-07** El **contenedor 100×160×60** para race-tracking → weld line + gas trap y su cura con flow
  leader 2→1.5 mm que costó +10% de presión (§5.5.4–5.5.5): "el fix nunca es gratis".

### 5.3 Lo que el experto hace sin explicar (observado en sesiones → lecciones explícitas)

- **A-08** **El porqué de cada barreno.** El experto alterna Rc 1/8 (agua, rosca cónica que sella
  sin empaque), CBORE M5–M16 (unión), clearance, dowel Ø16, armella M20 sin una palabra (004 dolor
  1; 020 @ 15:28 dropdown abierto sin pista; 007 min 5.7). La UI etiqueta CADA barreno por FUNCIÓN
  con su § (§12.4.2 unión, §12.4.3 dowels, §11.3.8 retorno, §9.1.6 agua, §12.4.2 armella) — es
  exactamente lo que el editor del video tuvo que sobreponer a mano como rótulos (025, 3 letreros).
- **A-09** **Las reglas silenciosas del multicuerpo:** Feature Scope "Selected bodies" en cada corte
  (olvidarlo perfora placas ajenas — 040 D3; 028 @ 6:56), navegación Isolate/Exit Isolate constante
  (020 dolor 5), color por cuerpo (040 2/7). [EXTENSIÓN DECLARADA: son práctica de taller sin § en
  el libro; se enseñan como "método CAD del cliente", citando sesión.]
- **A-10** **Los números de memoria reciben su regla:** el 0.50 mm de Move Face (020 @ 13:20 →
  fits calculados §12.4.1), el Block Size 40/60 (025 min 4.8 → dimensionador §4.2.1–4.2.2), el
  plano offset a 55 mm del 3 placas (028 h1-f6 min 3:12 → nivel de placa despojadora, §6.3.2), el
  perno inclinado por Cut-Revolve (040 min 28.4–29.0 → geometría cerrada §11.3.7), los 30°/20° de
  sprue y gates (028 h3-f44; 048 m 1.2 → §7.2.7, §6.5.2). Cada cota del CAD liga a su fórmula o
  catálogo.
- **A-11** **Modelos a medio proceso se narran:** al abrir un árbol heredado (Scale1 → Parting Line1
  → Tooling Split1 ya hechos, como en 7/8 sesiones), el modo APRENDER explica cada feature heredado
  y qué fase lo produjo (007 implicación 1; 013: "el arranque es un salto"). La fase activa se
  nombra en pantalla (028: el orden parece arbitrario sin narración).
- **A-12** **La convención de entrega se enseña:** renombrar cuerpos ES definir la estructura de
  entrega (MAIN CORE, CAVITY PLATE, RISER L/R…) porque los nombres de cuerpo se vuelven archivos
  vía Save Bodies (007 min 27.9–31.0: 15 .sldprt; 013 @ 32.7–37.0). [EXTENSIÓN DECLARADA: práctica
  observada sin § en el libro.]
- **A-13** **Trampas contraintuitivas como lecciones interactivas** — los números que "se ven bien"
  y están mal: shear 132,000 s⁻¹ aceptable por shear thinning y semáforos que discrepan (§7.3.3);
  contracción cero = pieza atrapada (§10.1.6); 2 °C de gradiente = 1.6 mm de alabeo (§10.3.1);
  molde conductivo −30% de ciclo, no −87% (§9.1.3); acero "mejor" no flexiona menos (§12.1.3);
  ΔP "buenísimo" de 3.9 MPa con veredicto NEGATIVO (§6.5.1); bajo yield pero muere a 1,000 ciclos
  (§12.2.6).
- **A-14** **Anatomía y cinemática animadas:** glosario visual de componentes con nombres múltiples
  (§1.3.1), recorrido del melt (§1.3.3), secuencia de expulsión completa (§11 intro, Figs.
  11.1–11.4), cinemática del 3 placas (§1.4.1) y cortes de los 3 tipos de molde (§6.3.1–6.3.3).

---

## 6. Modo REVISAR EN VOLUMEN — requisitos

### 6.1 La tabla del lote

- **V-01** Pantalla principal: **tabla de N modelos × criterios del libro**, un semáforo por celda.
  Filas = modelos del lote; columnas = los checklists de cierre del libro por subsistema: gating
  §7.4, venteo §8.4, agua §9.4, estructural §12.5 (3 veredictos independientes: yield, fatiga,
  deflexión-vs-flash), máquina §4.3.3 (4 semáforos), DFM Tabla 2.8, feed §6.4 (triple semáforo),
  gates Tablas 7.2–7.4 (3 semáforos INDEPENDIENTES que pueden discrepar, §7.3.3–7.3.4).
- **V-02** **Orden por severidad**: rojos duros primero (los que el libro marca fatales: ΔP de gate
  >10 MPa §7.3.3, s≤0 sobre-empaque §10.1.6, deflexión > venteo §12.1.2, interferencia de acero),
  luego ámbar, luego faltantes de datos ("sin ficha de material" — N-01). El revisor ve 30 moldes
  en el orden en que importan.
- **V-03** **Drill-down**: clic en cualquier celda → el modelo abierto en la vista que evidencia el
  hallazgo + el § del criterio + los números medidos vs el umbral. Del semáforo a la evidencia en
  un clic.
- **V-04** **Completitud de fases por modelo**: reporte de qué fases de la taxonomía están ausentes
  en cada archivo (025 terminó sin alimentación, agua ni planos — un batch lo reporta por archivo;
  007 cerró sin barrenos de expulsores observados).

### 6.2 Las verificaciones A OJO observadas, corridas en lote

- **V-05** **Alineación del stack**: concentricidad/coaxialidad de cada barreno a través de las
  placas que atraviesa; hoy = Section View + ojo (004 @ 21:56; 028 @ 21:52–22:24; zoom a anillos
  020 @ 25:04). Incluye pareo tipo-tamaño: cada M16 clearance con su M16 tapped coaxial, CBORE con
  profundidad ≥ cabeza (020).
- **V-06** **Interferencias y cortes invasores**: detección entre los 8–32 cuerpos del part
  (Interference Detection: cero usos en 8 sesiones — 013, 025) + cortes que invaden cuerpos ajenos
  por Feature Scope olvidado (040 D3) + holguras ≥½D en el parting plane (§4.3.2).
- **V-07** **Auditor de simetría/patrón**: features sin su espejo (19 Mirrors a mano en 040;
  Mirror2–12 en 020; "olvidar uno = placa asimétrica y nada lo delata", 020 dolor 4) y features
  por-cavidad no replicados a las N cavidades (048: gate por LPattern ×4 — "fácil que a una
  cavidad le falte").
- **V-08** **Agua batch**: continuidad del circuito taladrado; ½D de acero contra cavidad, barrenos
  y expulsores (§9.2.7 — hoy se verifica por transparencia, 013 min 30.9); D/profundidad/pitch en
  rango (§9.2.4–9.2.6); roscas de conexión presentes y accesibles en ambas mitades (007, 048);
  etiquetado in/out si >2 conexiones (§9.1.6); distancia línea↔cavidad por concentración de
  esfuerzos (§12.2.6, ec. 12.19).
- **V-09** **Expulsión batch**: cada pin dentro de la silueta y no sobre pared delgada (004 @ 22:52
  se hace a ojo); acero ≥1D entre barreno y cavidad (§11.2.4); conflicto pin↔agua (§11.2.5);
  venteo presente en last-to-fill vía pin (§5.2.3 + §8.3.2); conteo retorno/resortes contra receta
  de familia (004 @ 14:00).
- **V-10** **Contracción verificable por modelo**: ¿existe Scale?, ¿el factor coincide con la resina
  declarada?, ¿quedó el acta de §10.1.7? Hoy nada de eso es verificable ni mirando el video (el
  factor fue ilegible en 8/8 sesiones; 025 min 1.2; 048 @ 0.4).
- **V-11** **Mecanismos batch**: carrera-vs-ángulo-vs-pocket del slider recomputada — ¿el slider
  libra el undercut? (§11.3.7 vs 040 min 28.4–31.5, hoy nadie lo verifica ni a ojo); checklist de
  seguridad (limit switches, resorte, §11.3.6–11.3.7) por molde-con-slider.
- **V-12** **Linter de higiene del modelo**: croquis Under Defined = 0 (crónico: 048 dolor 5; 020
  4+ veces; 025 en 8 frames; 004 @ 19:36), cotas de 6 decimales sin justificar (028: 471.889457),
  cuerpos con nombre default (020 dolor 8: 60+ features anónimos), guardados (save reminders de
  20+ min: 020 @ 1:36, 028 @ 15:28, 040 ~min 20.3), manifiesto de export completo: un .SLDPRT por
  cuerpo con la convención de nombres (007 min 31.0; 013 @ 36.4).
- **V-13** **Contact-sheet de auditoría**: las MISMAS vistas que el experto genera como firma de
  cierre (sección por el bebedero + top alámbrico + translúcido del stack — 040 min 35.7–36.4,
  "firma" observada) producidas automáticamente por modelo, para que el revisor humano vea 30
  moldes en el tiempo que hoy le toma UNO.
- **V-14** **Gate de compra del mold base en lote**: layout <2:1 (§4.3.1) + colchones (§4.3.2) +
  4 semáforos de máquina (§4.3.3) en verde ANTES de liberar la orden (§4.3: "any mistakes in the
  mold base selection can consume significant time and expense") — ninguna sesión corre ninguno.
- **V-15** **Placas vs catálogo**: espesores/anchos de cada placa del lote contra la tabla de la
  familia estándar (§4.3.2) — hoy se comparan contra la memoria de cada ingeniero (007 min 25.8:
  el dropdown de valores recientes 246/266/286 como único "catálogo").

---

## 7. Decisiones humanas = menús

Cada decisión del libro es una pantalla de menú con las opciones y el criterio LITERAL, y su
elección queda en el registro de decisiones (§13.10). Lista consolidada:

| ID | Decisión | Opciones / criterio | § |
|----|----------|---------------------|---|
| M-01 | Tipo de alimentación | two-plate / three-plate / hot-runner × 6 medidas Poor/Good/Excellent; + Tabla 6.2 (inversión, capacidad del moldeador) | §1.4.3 Tabla 1.1; §6.4.1 |
| M-02 | Número de cavidades | "critical design decision"; escenarios múltiples a volumen intermedio (4/8/16, con o sin HR) | §1.3.2; §3.2.2 |
| M-03 | Undercut: eliminar vs conservar | NO eliminar si la función es vital o si quitarlo obliga a post-molde; trabajar con el diseñador | §2.3.7 |
| M-04 | Espesor: nominal grueso vs delgado+ribs | pared 30% más gruesa ≈ +15% material y +70% ciclo | §2.3.1–2.3.2 |
| M-05 | Acabado superficial | SPI D-3→A-1 vs texturas; propaga TRES efectos a la vez (pre-acabado, +1°/20 μm de draft, costo Tabla 3.6) | §2.3.5–2.3.6; §3.3.1.5 |
| M-06 | Dirección de apertura | mayor área paralela al plano de partición + expulsabilidad | §4.1.1 |
| M-07 | Ubicación del parting line | borde inferior o no-visual; SIEMPRE deja witness; confirmar visibilidad sobre el 3D | §4.1.2 |
| M-08 | Shut-off por ventana | rango válido de ubicación; parting line del shut-off en zona no visible | §4.1.4 |
| M-09 | Forma del inserto | redondo/cuadrado/rectangular; "no hay requisito fundamental": manufactura decide | §4.2.3 |
| M-10 | Layout de cavidades | línea / rejilla / círculo / híbrido, cada una con su criterio; envolvente <2:1 | §4.3.1 |
| M-11 | Spec del mold base | tamaño estándar 200–1000, alturas A/B/S (S y C las asigna el proveedor), carrera E | §4.3.2 |
| M-12 | Proveedor de mold base | 7 criterios (tamaños, componentes, unidades+dibujos, entrega ≤1 sem, calidad, experiencia, precio) | §4.3.4 |
| M-13 | Material de insertos | matriz aplicación×volumen (Tabla 4.1) con alarma anti-default-P20 | §4.4.4; §4.4 |
| M-14 | Ubicación del gate | balancear el flujo sobre el lay-flat ANTES del cálculo de presión; anti gas-trap en orden §5.5.5 | §5.5.2; §5.5.5 |
| M-15 | Sección del runner | full round 100% / round-bottom 87.9% / trapezoidal 78.5% / half-round 61.2%; una placa vs dos | §6.5.1 |
| M-16 | Redondeo a cortador estándar + steel-safe | redondear HACIA ABAJO uno o dos tamaños: crecer es fácil, encoger exige soldadura | §6.5.4–6.5.5 |
| M-17 | Tipo de gate | Tabla 7.1 interactiva: 10 tipos × runner/des-gateo/shear/flujo; método de des-gateo (§7.1.2) | §7.3.1; §7.1.2 |
| M-18 | Venteo por ubicación | obligatorio / opcional / diferido-a-tryout, por los 3 tipos (fin de flujo, knit, dead pocket); solución del dead pocket: inserto/blade/sinterizado | §8.2.2; §8.3.3 |
| M-19 | Arquitectura del circuito de agua | looping serie (MAL) / manifold máquina / manifold interno / perimetral (solo 3 placas u HR) | §9.3.1 |
| M-20 | Enfriamiento de core esbelto | por DIÁMETRO: insert >50, baffle 12–75, bubbler 6–30, heat pipe 5–20, pin <5 mm (Tabla 9.3); baffle preferido sobre insert custom | §9.3.5 |
| M-21 | Recomendación final de contracción | confrontar contra ≥1 de 4 fuentes; acta de QUIÉN acepta el riesgo | §10.1.7 |
| M-22 | Steel-safe de contracción | (A) cavidad baja/corazón alto, (B) media constante, (C) detalles semi-terminados | §10.2.2 |
| M-23 | Sistema de expulsión | menú de tipos (pines/cuchillas/sleeves/stripper/lifters/core pulls/collapsible/…) con coeficientes de costo en vivo; pocos-grandes vs muchos-chicos; opciones bajo costilla | §3.3.3 Tabla 3.9; §11.2.4–11.2.5 |
| M-24 | Actuador de core pull | hidráulico domina (densidad de potencia ~10×); bore con P real de planta | §11.3.6 |
| M-25 | Retorno del eyector | knock-out roscado (positivo, 4 ventajas) vs resortes (límites y desgaste declarados) | §11.3.8 |
| M-26 | Esfuerzo límite estructural | peor-caso con yield XOR presión esperada con factor — PROHIBIDO combinar | §12.1.1 |
| M-27 | Fits por interfaz | LN/FN por FUNCIÓN (localización/interferencia/deslizante), Tabla 12.1; alarma de fuerza de inserción (808 kN) | §12.4.1 |
| M-28 | Tecnología de molde | árbol de selección necesidad→tecnología calcado del flow chart; decisión APROBADA y documentada entre las partes | §13.1 Fig. 13.1; §13.10 |
| M-29 | Regrind | % permitido del cliente; factores por tipo de feed (Tabla 3.12); V_feed ≤ %·V_cavidades | §3.4.2; §6.2.3 |
| M-30 | Máquina de moldeo | clase base + sumadores (Tabla 3.13 de capacidad); 4 semáforos de compatibilidad | §3.4.3; §4.3.3 |

(Ninguna de estas decisiones es visible en las 8 sesiones: en ~245 min no aparece ni una pantalla de
material, máquina, proveedor o tecnología — `cruce.md` las declara como decisiones que hoy viven "en
la cabeza del experto" o en sesiones no grabadas.)

---

## 8. Entregables / exportaciones

| ID | Entregable | Contenido | § |
|----|-----------|-----------|---|
| E-01 | Cotización | términos 1/3-1/3-1/3, garantías con penalizaciones, costo verdadero separado del precio comercial | §3.1; §1.5 |
| E-02 | Comparativa de escenarios | tabla por escenario: cavidades, runner, costo de molde, tcycle, costos por parte (reproducible Tabla 3.1) | §3.2.1; §3.5 |
| E-03 | Hoja de spec del mold base | L×W, A/B/S, carrera E, altura C asignada, stack height, orificio de sprue | §4.3.2 |
| E-04 | Reporte de compatibilidad molde-máquina | los 4 semáforos contra la ficha de la máquina del moldeador | §4.3.3 |
| E-05 | Registro de decisión de materiales | material de cada inserto + base con la celda de Tabla 4.1 que lo justifica | §4.4.4 |
| E-06 | Spec del feed system | layout, longitudes, diámetros por segmento (análisis→estándar→steel-safe), ΔP por segmento, volumen, % regrind/n_turns | §6.4.4–6.4.5 |
| E-07 | Hoja de especificación de gates | tipo y porqué (Tabla 7.1), dims, caudal supuesto, veredictos shear/ΔP/freeze con intermedios | §7.3.2–7.3.5 |
| E-08 | Mapa de venteo | cada candidato con tipo, estado (obligatorio/opcional/diferido), solución y dims land/canal con fuente citada | §8.2.2–8.3.3 |
| E-09 | Spec de enfriamiento | t_c por sección, potencia, caudal, D/H/W con rangos, layout con plugs, diagrama in/out, compatibilidad con controlador | §9.2–9.3; Tabla 9.1 |
| E-10 | Acta de contracción | recomendación final, fuente de confrontación usada, QUIÉN acepta el riesgo | §10.1.7 |
| E-11 | Tabla de eyectores | pines keyed + etiquetados (pin Y posición); PROHIBIDO intercambiables | §11.1.7 |
| E-12 | Planos por placa | límites dimensionales de fits (mín/máx inserto y bolsillo, dowels) y tabla de eyectores vaciados AUTOMÁTICO, sin retecleo | §12.4.1; §12.4.3; §11.2.6 |
| E-13 | Plan de tryout steel-safe unificado | gates chicos que se agrandarán, vents pocos/delgados por engrosar, ubicaciones diferidas, supuestos de caudal por validar | §7.3.2; §8.3.1; §9.2.7 |
| E-14 | Registro de decisiones + acta de tecnología | cada decisión crítica aprobada y documentada entre las partes con costos/beneficios/riesgos | §13.10; §1.5 |
| E-15 | Registro de datos del moldeador | presión máxima de máquina, presión de cavidad y su fuente, knock-outs (ubicación/rosca), o el default documentado | §6.2.2; §11.3.8 |
| E-16 | Manifiesto de entrega CAD | nomenclatura de cuerpos por convención + un archivo por cuerpo verificado (Save Bodies) | [EXTENSIÓN DECLARADA sobre práctica observada: 007 min 27.9–31.0; 013 @ 32.7–37.0] |

Todo documento generado estampa el número de parte/proyecto (§2.2.1).

---

## 9. Las oportunidades ⭐ — donde el libro y la práctica CHOCAN

Ordenadas por (dolor observado en minutos) × (respaldo del libro). Estas son las apuestas del
software; el detalle N-xx completo vive en `cruce.md` (este folder) y se resume aquí:

1. ⭐⭐ **N-15 Base paramétrica de catálogo.** El libro manda COMPRAR la base estándar con una spec
   (§4.3.2, §4.3.4); los ingenieros la MODELAN desde cero ~10 min por molde con números de memoria
   (013 dolor 1; 048 dolor 1; 007 dolor 5). ~48% del tiempo total observado es esta fase. El fix
   más claro y el desperdicio más grande. (Acotación declarada: "cero bibliotecas" vale para las
   8 sesiones OBSERVADAS; los títulos de las sesiones NO analizadas 062 "standar mold Component"
   y 063 "Combines a standard mold base" sugieren que a veces SÍ parten de base estándar — punto
   ciego declarado en anexo §5.8.)
2. ⭐⭐ **N-16 Hardware por receta funcional.** ~20 min de Hole Wizard por sesión, barreno por
   barreno (004 dolor 1), contra familias de hardware con función y regla en el libro (§12.4.2,
   §12.4.3, §11.3.8, §9.1.6): colocar FAMILIAS por receta (patrón de 4 esquinas, retícula de
   expulsión, puertos de agua) con posición derivada y § visible.
3. ⭐⭐ **N-29 El modo REVISAR EN VOLUMEN es el hueco entero entre libro y práctica.** Checklists
   formales (§7.4/§8.4/§9.4/§12.5/§4.3.3) vs cero Interference Detection y pura inspección ocular
   en 8 sesiones. Es LA promesa de "revisar decenas de modelos".
4. ⭐ **N-22/N-23 Agua calculada + verificada.** Capítulo 9 completo ausente de la práctica; 25% de
   una sesión en barrenos a pulso (007) verificados por transparencia (013 min 30.9); el warpage
   por mal pitch NO se cura con ciclo (§9.2.6).
5. ⭐ **N-19 El solver del libro alimenta las cotas del CAD.** Ecs. 6.7–6.9 + steel-safe §6.5.5 vs
   cotas mágicas (R3×10×30 en 007; 2.50/20° en 048; 30° en 028) sin un solo cálculo en 4 sesiones
   que tallan feed.
6. ⭐ **N-17 Simetría declarativa + auditor.** 19 Mirrors a mano en 040; el olvido es silencioso e
   indetectable a ojo (020 dolor 4); declarar la simetría UNA vez y auditar el resto (§4.3.1).
7. ⭐ **N-25 Expulsión por regla.** Pines a ojo sobre la silueta (004 @ 22:52) vs la cadena ec.
   11.7 → 11.10/11.12 → Euler; el cortante EN EL PLÁSTICO gobierna y nadie lo calcula (§11.2.3).
8. ⭐ **N-03 Contracción trazable con acta.** Un Scale de 24 segundos con factor invisible (025 min
   1.2) vs el cap. 10 completo con acta de responsabilidad (§10.1.7); en batch: factor vs resina
   por modelo.
9. ⭐ **N-13 Slider por regla.** Cut-Revolve a pulso con ángulo ilegible (040 min 28.4–29.0) vs
   geometría cerrada (≤20°, stroke ec. 11.26, heel block, §11.3.7); en batch: carrera vs undercut.
10. ⭐ **N-10/N-11 Dimensionador de insertos + fits calculados.** Block Size 40/60 tecleado sin
    referencia (025 min 4.8) vs reglas §4.2.1–4.2.2; Move Face 0.50 mm a mano (020 @ 13:20) vs
    λ=0.001·C·D^⅓ con mín/máx al plano y alarma de fuerza de inserción (§12.4.1).
11. ⭐ **N-07 El warning de shut-off convertido en gate explicado.** El mensaje amarillo que el
    experto brinca (025 min 2.0) y que a un nuevo lo deja perdido → check con diagnóstico y
    reporte batch "parting line completa + shut-offs cerrados" (§4.1.4).
12. ⭐ **N-31 Cierre administrativo automatizado.** ~4 min/molde de renombrar/exportar 100%
    mecanizables (013 dolor 5; 007 min 27.9–31.0) + linter de higiene (under-defined, saves,
    decimales).

---

## 10. Requisitos conjuntos N-01…N-32 (índice)

La columna vertebral del pliego son las 32 necesidades del cruce libro×sesiones, cada una con su
doble respaldo (§ del libro + sesión @ minuto). Se listan por fase; la evidencia de sesión completa
está en el anexo `sesiones-ingenieros.md`:

- **pieza:** N-01 intake mínimo + ficha de material como prerrequisito (§2.1.5, §2.2.5; 048 @ 0.4);
  N-02 DFM/DFA automático sobre geometría importada (Tablas 2.8–2.9; ninguna sesión lo corre).
- **dfm-draft-escala:** N-03 ⭐ contracción trazable (§10.1.2–10.1.7; 025 min 1.2); N-04 check de
  draft (Tabla 2.14; solo incidental en 025 h1-f6); N-05 detector de undercuts mapeado a mecanismo
  y costo (§2.3.7 + Tabla 3.9; la decisión nunca es visible en 040/007).
- **particion:** N-06 asistente de apertura + parting line con criterios visibles (§4.1.1–4.1.2);
  N-07 ⭐ warning de shut-off como gate explicado (§4.1.4; 025 min 2.0).
- **superficies:** N-08 superficie de partición plana automática con escalera a no-planos (§4.1.3;
  025 min 3.2–4.4); N-09 conteo shut-offs vs ventanas + interlocks ≥5° (§4.1.4, §4.1.3).
- **tooling-split:** N-10 ⭐ dimensionador de insertos que produce el Block Size (§4.2.1–4.2.2;
  025 min 4.8); N-11 ⭐ fits calculados en vez de Move Face 0.50 (§12.4.1; 020 @ 13:20/19:44);
  N-12 selector de material con Tabla 4.1 (§4.4.3–4.4.4; material jamás visible en 245 min).
- **mecanismos:** N-13 ⭐ slider por regla (§11.3.7; 040 min 28.4–29.0); N-14 checklist de
  seguridad de mecanismo (§11.3.6–11.3.7; invisible en todas las sesiones).
- **base-placas:** N-15 ⭐⭐ base paramétrica de catálogo (§4.3.2, §4.3.4; 8/8 sesiones a mano);
  N-16 ⭐⭐ hardware por receta funcional (§12.4.2–12.4.3, §11.3.8, §9.1.6; 004 dolor 1);
  N-17 ⭐ simetría declarativa + auditor (040: 19 Mirrors); N-18 verificador del stack + gate de
  compra (§4.3.2–4.3.3, R-090; 004 @ 21:56).
- **alimentacion:** N-19 ⭐ solver del libro → cotas del CAD (ecs. 6.7–6.9, §6.5.4–6.5.5);
  N-20 verificación batch del feed (balance real medido, taper, fillets; §13.6.3; 028 dolor 5);
  N-21 los 3 semáforos de gate como pantalla de cierre (§7.3.3–7.3.4).
- **agua:** N-22 ⭐ el circuito como objeto calculado (§9.2; 007 min 5.7–14.5); N-23 ⭐ checks
  batch de agua (§9.2.5–9.2.7, §9.1.6; 013 min 30.9); N-24 selector de core esbelto (Tabla 9.3;
  020 @ 18:08 lo hace de memoria).
- **expulsion:** N-25 ⭐ expulsión por regla (ec. 11.7, §11.2.3, §11.2.5; 004 @ 22:52);
  N-26 checks batch de expulsión (§11.2.4–11.2.5, §8.3.2); N-27 tabla de eyectores generada
  (§11.1.7; hoy los cuerpos son `Boss-Extrude7` anónimos).
- **planos:** N-28 plano por placa con fits/límites vaciados (R122 = §12.4.1/§12.4.3/§11.2.6;
  0 frames de drawing en 245 min — hueco de evidencia declarado).
- **revision:** N-29 ⭐⭐ revisión batch con los checklists del libro (§7.4/§8.4/§9.4/§12.5/
  §4.3.3); N-30 contact-sheet de auditoría (040 implicación 6); N-31 ⭐ cierre administrativo
  automatizado (013 dolor 5; 007 min 27.9–31.0); N-32 invalidación STALE + registro de decisiones
  (§1.5, §13.10; 020 dolor 8).

---

## 11. Criterios de aceptación del pliego (verificables)

1. **Trazabilidad total:** toda afirmación normativa del pliego cita § del libro o sesión @ minuto;
   un muestreo aleatorio de 20 afirmaciones debe resolver 20/20 contra las fuentes (los tomos
   `libro-caps*.md` y `cruce.md` de este mismo folder, y las fichas del anexo). Las extensiones
   marcadas [EXTENSIÓN DECLARADA] en este pliego son cinco: A-09, A-12, E-16, y las dos de §12
   (el nivel de integración con el CAD; el catálogo completo DME/HASCO como integración futura).
   (La integración de unidades del Apéndice E está marcada como extensión en su tomo —
   `libro-caps10-13.md`, R123 — no en este pliego.)
2. **Cobertura de fases:** las 12 fases de la taxonomía aparecen en el mapa de pantallas (§4 de
   este pliego) con su evidencia de libro Y su costo observado en minutos (o "no observado"
   declarado, como planos = 0 frames).
3. **Doble respaldo del top-5:** cada una de las 5 necesidades del resumen ejecutivo tiene AL MENOS
   una cita de § y una de sesión @ minuto (verificable en la tabla de §1).
4. **Los dos modos tienen requisitos puntuales y numerados:** APRENDER (A-01…A-14) y REVISAR EN
   VOLUMEN (V-01…V-15), más los 32 conjuntos (N-01…N-32), 30 menús de decisión (M-01…M-30) y 16
   entregables (E-01…E-16). Total: **107 requisitos numerados.**
5. **Retornos mapeados:** el mapa ASCII contiene ≥8 retornos con su § (espesor↔feed §5.5.2 en P2;
   L/W de insertos↔enfriamiento/estructura §4.2.3 en P6; iteración insertos↔base §4 intro en P7;
   gate→arquitectura §7.3.4 en P8; runner↔ciclo §9.2.1 y agua↔base §9.2.7 en P9;
   pin↔agua §11.2.5 en P10; pilares↔eyección §12.2.3 en P12) y la regla STALE global (§1.5).
6. **Huecos declarados, no rellenados:** venteo (cap. 8) sin evidencia en sesiones; cotización
   (cap. 3), llenado (cap. 5), estructural calculado (cap. 12), selección de máquina (§4.3.3),
   planos y actas: 0 minutos observados — declarados en §4 y en el anexo, jamás presentados como
   práctica observada.
7. **Cero invención verificable:** ningún valor numérico del pliego carece de fuente; los números
   de sesión ilegibles se presentan como "no legible" (p. ej., factor de Scale en 8/8 sesiones,
   ángulo del perno en 040).
8. **Español mexicano:** tú/tienes; cero voseo (verificable con grep de "vos/tenés/podés").

---

## 12. Anti-alcance (lo NO pedido — y lo que el propio libro prohíbe)

- **No sobre-diseñar el software ni el molde.** Cita literal §1.2: "the tendency among novice
  designers, when in doubt, is to over design… leads to large, costly, and inefficient molds". Los
  conflictos se resuelven por importancia RELATIVA, no sumando todo. El mismo principio aplica al
  software: cada pantalla existe porque una § o una sesión la respalda.
- **No apilar conservadurismos:** el sistema BLOQUEA combinar peor-caso + factor de seguridad
  (§12.1.1) y no agrega factores sobre análisis ya conservadores (§11.2.2).
- **No reemplazar el CAD del cliente.** Las sesiones son SolidWorks (8/8); el software calcula,
  guía, verifica y genera specs/reportes — no compite como modelador general. [EXTENSIÓN DECLARADA:
  el nivel de integración con el CAD es decisión de implementación, no requisito de fuente.]
- **No simulación de flujo propia (Moldflow).** El libro usa análisis de mano y los CONTRASTA con
  simulación declarando las discrepancias (Tabla 5.1, §5.5.3); la pestaña SOLIDWORKS Plastics
  existe en el ribbon de los ingenieros y JAMÁS se abre (004, 013). El software implementa los
  análisis del libro, no un solver numérico nuevo.
- **No auto-corrección silenciosa.** Cuando el cálculo difiere del dato del proveedor (0.31% vs
  0.6% de contracción), la UI muestra la brecha y NUNCA corrige sola (§10.1.4); la decisión es
  humana y queda en acta (§10.1.7).
- **No venteo "total" automático.** El libro admite diferir vents a tryout; el veredicto exige
  PREVISIÓN declarada, no venteo exhaustivo (§8.4: "fewer and smaller vents are preferred", §8.1.2).
- **No tecnologías de gama alta como features.** Dynamic feed, pulsed cooling, induction heating,
  etc. (cap. 13) entran SOLO como pantalla de decisión con barreras de costo declaradas (§13.6.4,
  §13.7.1: $0.30/ciclo solo de energía) — no como módulos a construir.
- **No un cotizador de PRECIO comercial.** El sistema calcula el COSTO verdadero; maquillar la
  cotización por hambre/saturación del taller "should be avoided" (§3.1). El precio es decisión
  humana fuera del alcance.
- **No más tolerancias críticas de las que el libro permite:** una general + unas POCAS críticas;
  más = bandera de sobre-especificación, no un formulario más grande (§2.2.3, Tabla 2.6).
- **No reproducir el catálogo completo de proveedores (DME/HASCO) el día 1.** El requisito es la
  SPEC de compra (§4.3.2) y la validación contra la tabla de la familia (V-15); el catálogo
  completo de terceros es integración futura. [EXTENSIÓN DECLARADA]
- **No planos CAD completos de detalle:** el entregable exigido por el libro son los límites de
  fits y la tabla de eyectores vaciados al plano (R122); el resto del detallado de dibujo queda
  fuera hasta tener evidencia de esa etapa (0 frames observados — pedir al cliente una grabación,
  ver anexo §5).
