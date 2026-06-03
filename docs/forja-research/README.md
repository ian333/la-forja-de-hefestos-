# 📚 La Forja — investigación reusable (workflows de debate + deep-research)

Resultados COMPLETOS de los workflows de investigación. Se guardan porque **se reusan**:
guiaron toda la construcción del sketcher (Tanda 1 + 2) y son la base para lo que sigue
(caja de velocidades, droide). El JSON crudo es la fuente de verdad; los `.md` son el
digesto legible.

> Regla del proyecto (de aquí salió): investigar desde **documentación OFICIAL** del
> fabricante, no foros. Copiar el **proceso** (la repetición del 80%), no la pinta.
> "Los mejores artistas copian; el proceso ya existe."

---

## Carencias a nivel CLICK / interacción
Debate adversarial (39 agentes) sobre la doc oficial de Fusion/SolidWorks/Onshape/FreeCAD/Blender.
- **`carencias-click.json`** — resultado completo: `references` (flujo canónico, modelo de
  restricciones, atajos, invocación de comandos, fuentes por CAD), `current` (qué era trampa /
  qué faltaba), `repetition` (el espinazo del 80%), `survivors` (carencias confirmadas), `spec`.
- **`forja-carencias-click.md`** — reporte ejecutivo: carencias rankeadas + el keymap.
- **`forja-keymap.json`** — el keymap bilingüe (C/B/L/E/F/X/W/V/G/P/K) + paleta de comandos.

## Carencias a nivel VISUAL
Debate adversarial (43 agentes) sobre convenciones visuales + screenshots reales de La Forja.
- **`carencias-visual.json`** — resultado completo: `references` (convenciones visuales +
  patrones de feedback + fuentes por CAD), `critiques` (crítica de los screenshots), `survivors`,
  `plan` (fixes rankeados por prioridad/costo/archivo).
- **`forja-carencias-visual.md`** — reporte ejecutivo del plan visual.

## Digesto de la doc oficial (lo más reusable)
- **`referencias-cad.md`** — los 10 análisis (5 de flujo/interacción + 5 de lenguaje visual),
  con pasos canónicos, restricciones, atajos, convenciones y **URLs oficiales** por CAD, más el
  espinazo repetido a automatizar. Esto es la "biblia" para copiar el proceso de los CAD.

## Síntesis generativa de mecanismos (deep-research)
- **`generativo-mecanismos.json`** — investigación de la matemática de síntesis cinemática
  (Freudenstein, Burmester, Grübler-Kutzbach, Jansen/Klann, curvas del acoplador): 5 temas,
  82 ecuaciones. Para el diseño generativo de mecanismos / el droide.
- Forma legible: **`../../LA-FORJA-GENERATIVO-MECANISMOS.md`** (raíz del repo).

---

## Qué se CONSTRUYÓ de esta investigación (2026-06-02/03)
- **Tanda 1A** visual (ViewCube, hover, metal, FEA azul→rojo) ← carencias-visual.
- **Tanda 1B** keymap + paleta "S" + click-to-place ← carencias-click (keymap, espinazo).
- **Tanda 2** sketcher: solver de restricciones 2D + editor (dibujar/restringir/acotar/arrastrar/
  barrenos/DOF por-entidad) + extrude ← el flujo canónico y el modelo de restricciones de
  `referencias-cad.md`.
- **Cuatro-barras** (forja-mecanismos) ← generativo-mecanismos.

Lo que falta de las referencias (reusar para lo siguiente): croquis sobre cara arbitraria,
proyectar aristas, marking menu, preview-on-hover de operaciones, ViewCube↔orto, materiales
por componente, y todo el plan visual P1/P2 pendiente.
