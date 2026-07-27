# Modelado de la PERCHA (Part237) — el que faltaba: la pieza ANTES del molde

> **Fuente:** Alwis Design — "SolidWorks Tutorial | Hangers design in SolidWorks" (YouTube `FhcyQAuOGh8`, 24:41).
> **Software:** SOLIDWORKS Premium 2022 SP1.0, unidades **MMGS**. Pieza `Part237` = la MISMA percha que se
> moldea en `PROCESO-1` (video `aCc0e8qKWgk`, Core-Cavity Hanger Mold).
> **Por qué existe este doc:** el `curso-flow.ts` v1 usó una silueta de percha INVENTADA (marco triangular +
> aro). El curso enseña la percha REAL parte por parte — este es ese proceso, extraído frame a frame.
> **Estado de la extracción:** tramos t=375–745 s y t=1125–1475 s por agentes (completos); base (t=0–370 s) y
> Shell/Revolve/Rib (t=750–1120 s) re-leídos a mano tras que 2 agentes murieron por créditos. Lo NO capturado
> se marca **[no capturado]** — NUNCA se inventa (regla Kazmer).

---

## 1. QUÉ es la pieza

Una **percha de ropa de plástico**, hueca (shelled), de ~425 mm de ancho, con:
- brazos que **CURVAN hacia abajo en 3D** (silueta frontal con jorobas + planta arqueada) → su línea de
  partición **NO es plana**: trepa por los brazos. Esta es la razón de que el molde (`PROCESO-1`) construya
  la superficie de partición a mano. **La percha inventada v1 era plana y esquivaba justo esta dificultad.**
- una **plataforma de cuello** elevada con una **bolsa rectangular** (40×30) y un boss revolucionado para el
  gancho metálico;
- **muescas trapezoidales** porta-tirantes en cada brazo;
- **nervaduras internas en U** (3 por brazo) barridas sobre curvas compuestas;
- pared delgada uniforme (Shell).

Árbol final (36 features, confirmado en f0283/f0286):
`Boss-Extrude1 · Cut-Extrude1 · Draft1 · Cut-Extrude2 · Fillet1..5 · Cut-Extrude3 · Fillet6 · Fillet7 ·
Shell1 · Revolve1 · Draft4 · Draft5 · Cut-Extrude4 · Fillet8 · Fillet9 · Rib1 · Axis1 · CirPattern1 ·
Split Line1 · CompCurve1 · Plane1 · Sweep1 · CompCurve2 · Plane2 · Sweep2 · CompCurve3 · Plane3 · Sweep3 ·
Move Face1 · Mirror1 · Combine1 · Cut-Extrude5`
(no hay Draft2/Draft3: la numeración salta de Draft1 a Draft4.)

---

## 2. EL PROCESO paso a paso

### Fase A — Silueta FRONTAL + extrusión base (t≈0–370 s)

1. **Sketch2 en Front Plane** — la silueta característica de la percha (perfil cerrado, Fully Defined):
   - **Ancho total 425.00**, **altura 140.00**.
   - Cuello: **85.00** y **70.00** (anchos de la joroba central); brazo: **90.00** y **85.00** (alturas).
   - Arcos: **R60.00** (fondo de brazo), **R80.00** y **R100.00** (hombro del cuello), **R200.00**,
     **R850.00** y **R4000.00** (curvatura suave de los brazos — arcos muy grandes = casi rectos).
   - (Frames f0018–f0052.)
2. **Boss-Extrude1** con Sketch2. Profundidad **[no capturado]** (vista *Top en f0056 = losa rectangular; la
   profundidad debe cubrir el ancho de la planta, ≥320). → **Boss-Extrude1**, Solid Bodies(1).

### Fase B — Planta arqueada que talla los brazos curvos (t≈375–560 s)

3. **Sketch3 en Top Plane** — el perfil de PLANTA (la vista de arriba de la percha):
   - arco superior **R1500.00** a **12.50** del origen; arco inferior **R1200.00** a **25.00** del superior
     (12.50 bajo el origen).
   - media anchura centro→extremo **210.00** (→ ancho total 420); casquete del extremo **R25.00**;
     arco inferior del casquete **R20.00**; arco interior de 3 puntos **R100.00** (tangente a…);
   - **Offset Entities 45.00** (curva constructiva paralela, geometría de offset ✓);
   - **Mirror Entities** del trío del casquete respecto a la línea de centro vertical.
4. **Cut-Extrude1** con Sketch3: From Sketch Plane, **Mid Plane 320.00**, **Flip side to cut ✓** (elimina
   todo lo exterior a la planta → los brazos quedan con su forma arqueada). → **Cut-Extrude1**.
5. **Draft1** (Insert > Features > Draft): Type **Parting Line**, **2.00°**, Direction of Pull **Top Plane**,
   parting lines = lazo del borde inferior (propagación por tangencia). → **Draft1**.

### Fase C — Bolsa del cuello + redondeos (t≈565–650 s)

6. **Sketch4 en Front Plane** — **Center Rectangle 40.00 × 30.00** a caballo del tope del cuello.
7. **Cut-Extrude2**: From **Offset 30.00**, Direction 1 **Offset From Surface** contra Face<1>, distancia
   **2.00**, **Reverse offset ✓** (deja pared remanente de 2 mm) → bolsa del cuello. → **Cut-Extrude2**.
8. **Fillet1** R**3.00** (esquinas interiores de la bolsa), **Fillet2** R**[≈2–3, no confirmado]**
   (contorno de la bolsa), **Fillet3** R**1.00** (arista vertical del corte), **Fillet4** R**10.00**
   (perímetros largos sup./inf. del cuerpo, Edge<1>+Edge<2> por tangencia), **Fillet5** R**2.00**
   (lazo de la meseta del cuello). Todos Constant Size, Symmetric, Tangent propagation ✓.

### Fase D — Muesca porta-tirantes (t≈650–745 s)

9. **Sketch5 en Front Plane** — trapecio invertido a caballo del borde superior del brazo izquierdo:
   ancho superior **12.00**, base **5.00**; posición **Y 67.00** (del origen) y **X 125.00** (del centro);
   ángulos de los lados **110.00°** (izq) y **105°** (der). **Mirror Entities** al brazo derecho.
10. **Extruded Cut** de la muesca (ocurre después de f0150; params exactos [no capturado]).

### Fase E — Boss del gancho, cavidad interior, nervaduras radiales (t≈750–1120 s)

> Tramo re-leído a mano; features IDENTIFICADAS, varios parámetros **[no capturado]**.

11. **Cut-Extrude3** (Sketch6): rectángulo **8.00 × 4.00** en el tope del cuello (alojamiento del gancho).
    **Fillet6**, **Fillet7** (redondeos de ese alojamiento). → f0166.
12. **Shell1** — vacía la pieza a pared delgada uniforme. Espesor **[no capturado]** (para una percha de este
    tamaño ~2–3 mm; NO se hardcodea sin leerlo). Cara(s) abierta(s) = la inferior. → f0180 (ya aplicado).
13. **Revolve1** (Sketch7): círculo **⌀≈2.82** concéntrico al eje del cuello = boss revolucionado para el
    gancho metálico. **Draft4**, **Draft5**: salidas adicionales. → f0180.
14. **Cut-Extrude4**, **Fillet8**, **Fillet9**: detalle del boss/cuello.
15. **Rib1** + **Axis1** + **CirPattern1**: nervadura radial en patrón circular alrededor del boss del cuello
    (refuerzo del punto de carga del gancho). Params **[no capturado]**.

### Fase F — Nervaduras internas en U + cierre (t≈1125–1475 s)

> Tramo por agente (completo).

16. **Split Line1** (Sketch9, Projection): 3 líneas rectas que cruzan el brazo izquierdo a **60 / 100 / 165**
    del origen, proyectadas sobre las caras internas de la cavidad → 11 caras divididas.
17. Por cada una de las 3 estaciones (×3):
    - **Composite Curve** (`CompCurveN`): une 5 aristas del lazo en U. Longitudes **62.83 / 64.95 / 84.45 mm**.
    - **Plane** (`PlaneN`): en el vértice de la curva, Coincident + Perpendicular a la curva.
    - **Sketch10/11/12** en ese plano: **Center Rectangle 1.20 × 1.00** (perfil de la nervadura),
      centro coincidente con la curva.
    - **Swept Boss/Base** (`SweepN`): perfil = el rect, path = la composite curve; **Follow Path**,
      Twist None, **Merge result OFF** (cuerpo separado).
18. **Move Face1**: Offset **2.00**, **Flip direction ✓**, sobre las **6 caras extremo** de las 3 nervaduras
    (las empotra en las paredes).
19. **Mirror1**: Mirror about **Right Plane**, **Bodies to Mirror** = las 3 nervaduras (→ 6 en total).
    Merge solids OFF, Propagate visual properties ✓.
20. **Combine1**: Operation **Add** — funde los 7 cuerpos en Solid Bodies(1).
21. **Draft Analysis** (verificación, no feature): pull **Top Plane**, **0.50°** — todo verde.
22. **Sketch13 en Front Plane** + **Offset Entities 0.50** de la silueta inferior (Total Length 467.78 mm) →
    **Cut-Extrude5**: Blind **10.00**, empareja el borde inferior a ras. → **Cut-Extrude5**.
23. **Appearances**: Plastic > **Medium Gloss** gris oscuro/negro.

---

## 3. COTAS CLAVE (confirmadas)

| Feature | Cotas | Frames |
|---|---|---|
| Sketch2 (silueta frontal) | W **425**, H **140**, cuello **85**/**70**, brazo **90**/**85**, R60/R80/R100/R200/R850/R4000 | f0018–f0052 |
| Boss-Extrude1 | profundidad [no capturado] | f0056 |
| Sketch3 (planta) | arco sup **R1500** a **12.50**, arco inf **R1200** a **25.00**, media anchura **210**, casquete **R25**/**R20**, arco 3pt **R100**, offset **45** | f0076–f0093 |
| Cut-Extrude1 | **Mid Plane 320**, Flip side to cut ✓ | f0098 |
| Draft1 | **Parting Line 2.00°**, pull Top Plane | f0103 |
| Sketch4 + Cut-Extrude2 | Center Rect **40×30**; From Offset **30**, Offset From Surface **2.00** Reverse ✓ | f0109–f0118 |
| Fillet1..5 | **3** / [≈2–3] / **1** / **10** / **2** mm | f0120–f0129 |
| Muesca (Sketch5) | ancho sup **12**, base **5**, Y **67**, X **125**, ángulos **110°**/**105°** | f0135–f0149 |
| Cut-Extrude3 | rect **8×4** (alojamiento gancho) | f0166 |
| Revolve1 | círculo **⌀≈2.82** (boss gancho) | f0180 |
| Nervaduras U (×3, ambos brazos) | perfil **1.20×1.00**, splits a **60/100/165**, curvas **62.83/64.95/84.45** | f0226–f0270 |
| Move Face1 | Offset **2.00** Flip, 6 caras | f0274 |
| Cut-Extrude5 (borde inf.) | Offset Entities **0.50**, Blind **10** | f0289–f0291 |

---

## 4. QUÉ reproducir en La Forja (plan, con extensiones DECLARADAS)

**Núcleo geométrico REAL y reproducible hoy** (da la percha curva con partición NO plana — el punto del user):
- **Sketch2 frontal** (arcos con las cotas de arriba) → extrude base.
- **Sketch3 planta** (R1500/R1200, ancho 420) → **Cut Mid-Plane 320** → los brazos arqueados.
- **Draft 2° parting-line**, **bolsa del cuello 40×30 pared 2**, **fillets R10/R3/R2**, **muescas 12/5**.

**Extensiones DECLARADAS (omitido en v2, por complejidad de kernel o cota faltante):**
- **Shell** (espesor sin leer) → la percha se moldea SÓLIDA; la pared se declara, no se talla.
- **Revolve1 del boss del gancho**, **Rib1 + CirPattern1**, **nervaduras internas en U (Sweep×6)** →
  detalle interior; no afecta la línea de partición exterior (que es lo que el molde necesita).
- **Cut-Extrude5** del borde inferior (0.5 mm) → cosmético.

**La ganancia clave para el molde:** con Sketch2+Sketch3+Cut Mid-Plane, la línea de partición de la percha
**trepa por los brazos** (no plana) → NO es el atajo de partición plana. Eso es lo que la percha inventada
nunca ejercitó.

---

## 5. ESTADO (2026-07-19) — reproducido y verificado

- **Geometría de la percha REAL: HECHA y verificada.** `insertarPercha()` en `curso-flow.ts` = silueta
  frontal ∩ planta arqueada. Numérico: **vol 754,734 mm³**, **bbox 420×44×110 mm** (envolvente del curso),
  **partición Δz = 23.5 mm → NO plana ✓** (la inventada daba Δz=0). Vista en GPU: joroba del cuello + brazos
  curvos + muescas — es una percha de verdad, no el marco triangular.
- **Layout 2 cavidades: HECHO** (offset adaptativo al ancho rotado real — la percha larga necesitaba ∓34 mm,
  no ∓5; el ∓5 de la pieza inventada las encimaba).
- **Split del molde: PENDIENTE (v2).** La percha real, larga y curva, **NO es estrella-convexa desde su
  centroide** → la falda RADIAL de la cuchilla de `parting.ts` se auto-interseca (booleano de minutos, se
  colgó a 6m40s). Es el límite v1 DECLARADO en `parting.ts`. La ruta correcta = **tallado por heightfield**
  (`carvedInserts`/`buildMoldParts`, tarea #22 ya completada y probada para piezas curvas) — falta cablearlo
  al botón Tooling Split del curso. Mientras, el botón refiere el mensaje honesto en vez de colgar la pestaña.

**Moraleja:** el fix del user destapó la dificultad REAL que la pieza inventada escondía: partición no plana
de una pieza no-estrella-convexa. El módulo que la resuelve ya existe (heightfield), es cuestión de conectarlo.
