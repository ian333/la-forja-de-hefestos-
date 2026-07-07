# DOCTRINA — clases de MECÁNICA (no de "cómo usar La Forja")

> Orden del user (2026-07-06): "ESTAS SON CLASES DE MECÁNICA. Que el que las vea
> sepa las FÓRMULAS y el PROPÓSITO de lo que hizo. Los addons carísimos de
> SolidWorks/Fusion los regalamos. Tú eres físico y matemático, funcionas con eso."

## La diferencia (regla dura para autorar cada lección)

**ANTES (tutorial de software):** "Clic en Boceto. Dibuja un rectángulo. Extruye 20."
**AHORA (clase de mecánica):** enseñas la INGENIERÍA; La Forja es el pizarrón donde se
comprueba. La geometría la valida el kernel (volumen exacto); la NARRACIÓN valida que
entendiste por qué.

Cada lección teje TRES hilos en la voz de Matilda:
1. **La FÓRMULA real** — con símbolos y números. No "más grande gira más lento" sino
   "ω₂ = ω₁·Z₁/Z₂; con Z₁=15, Z₂=30, la salida gira a la MITAD".
2. **El PROPÓSITO / stakes** — para qué existe, qué se rompe si está mal, dónde vive en
   una máquina real (un reductor de robot, la flecha de un motor, el molde de una tapa).
3. **La comprobación** — el kernel mide (volumen, masa, C entre engranes, esfuerzo von
   Mises) y confirma la fórmula EN VIVO. "El kernel no miente" sigue siendo el sello.

## Chuleta de fórmulas por unidad (la fuente es el Bethune, capítulos con ejemplos)

- **U3 Features / plásticos:** ángulo de salida (draft) = fricción de desmoldeo; sin ~1–3°
  la pieza se raya al eyectar. Espesor de pared (shell) = enfriamiento parejo en inyección
  (t_enfriamiento ∝ pared²). Costilla (rib) = rigidez sin masa (I aumenta con el peralte³).
- **U4 Vistas:** proyección de 3er ángulo; líneas ocultas; sección = achurado a 45°.
- **U5 Ensambles:** grados de libertad; un mate quita GDL (concéntrico quita 2, coincidente
  quita 1). Cadena cinemática.
- **U6 Roscas:** paso p, avance = p·nº entradas; par de apriete T ≈ 0.2·F·d (regla del taller).
- **U7 Acotación:** cadena vs baseline (acumulación de error en cadena).
- **U8 Tolerancias:** zona ±; ajuste = relación agujero-eje; holgura = D_agujero − D_eje;
  condición de material máximo (MMC); análisis de tolerancias = suma de zonas (¡el addon caro!).
- **U9 Baleros/ajustes:** ajuste deslizante (H7/g6, holgura + ), de transición, de apriete
  (interferencia − ); presión de contacto de Lamé en el apriete.
- **U10 Engranes:** involuta (rueda sin rechinar); D_primitivo = m·Z; C = m(Z₁+Z₂)/2;
  relación i = Z₂/Z₁ = ω₁/ω₂ = τ₂/τ₁; potencia P = τ·ω constante (por eso reducir velocidad
  MULTIPLICA torque); ángulo de presión 20°.
- **Sim (regalar el addon):** σ = F/A; factor de seguridad n = σ_y/σ_max; von Mises;
  optimización topológica (SIMP) = quitar material donde σ≈0.

## Lo que regalamos (addons que afuera cuestan un dineral)
Análisis de tolerancias · FEA (von Mises) · diseño generativo · CAM (torno/fresa/láser/
aditivo) · moldes (core/cavity, contracción) · planos con HLR real. Todo GRATIS, en el navegador.

## Prioridad (orden del user)
1. **ACABAR EL LIBRO** — todas las lecciones, en este estilo mecánico.
2. **TENER TODAS LAS HERRAMIENTAS** — construir las features que falten (LO-RECIO.md).
3. Extender/re-narrar videos viejos: DESPUÉS (regrabar es barato — cada clase es un JSON).

Ver [[feedback_clases_mecanica_no_tutorial]], `CURRICULUM.md`, `LO-RECIO.md`.
