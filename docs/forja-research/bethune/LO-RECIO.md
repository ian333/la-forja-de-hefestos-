# LO RECIO — los ejemplos complejos del Bethune contra La Forja

**Misión (user, 2026-07-03):** que los mexicanos construyan robots y motores con software de
unos cuantos dólares. Método: tomar los ejemplos MÁS COMPLEJOS del libro, intentarlos en
La Forja por la interfaz, y donde truene → **construir la función que falta**. Cada pieza se
verifica por volumen exacto del kernel contra las cotas de la figura.

Figuras extraídas: `docs/forja-research/manuales/bethune/figs/` (pgNNNN.png).

## Cola recia (elegidos por lo que estresan)

| # | Ejemplo | Página PDF | Estresa | Estado |
|---|---|---|---|---|
| R1 | **P11-34 LINK ASSEMBLY** (base D-boss + biela R25 + pin) | 1768-1771 | boceto-en-cara, boss join, **ENSAMBLE genérico + mates** | arnés `scripts/recio/p11-34.cjs` listo |
| R2 | **P3-52 resorte de extensión** (Ø12, alambre 4, paso 6, 18 vueltas, patas 15 a 180°) | 580 | hélice + **patas de extensión tangentes** | pendiente |
| R3 | P3-48..51 (soportes con redondeos/patrones) | 576-579 | fillet por arista, patrones | figuras extraídas |
| R4 | P11-31..33 (placas CSWA con barrenos avellanados?) | 1758-1767 | hole wizard (avellanado/abocardado) | figuras extraídas |
| R5 | SP3-2 cilindro con cara inclinada + ranura + Ø8 | cap 3 §3-26 | **planos de referencia a ángulo**, corte en cara inclinada | pendiente |

## Brechas confirmadas (la lista de construcción)

**Ronda 1 (2026-07-03, corrida real del arnés + lecciones L3/L4/L5):**

1. **Errores OCCT ilegibles** — el kernel truena con códigos crudos (`16385704` en revolve,
   `16925504` en boolean subtract) sin mensaje humano. Función a construir: catch de
   excepciones OCCT → mensaje accionable ("el perfil cruza el eje de revolución", "la
   booleana no intersecta"). Los usuarios de robots van a vivir esto a diario.
2. **Ensamble genérico → v1 CONSTRUIDA (2026-07-06)**: Component kind `'pieza'` con snapshot
   del doc (`pieceDoc`), botón ⤵ INSERTAR en la biblioteca (`lib-insert-<n>`), API
   `insertPieza(name)`/`libraryNames()`, posición X/Y/Z/Giro del panel, booleanas
   Junto/Unir/Restar. PROBADO: placa+pin compound = 130,995.57 mm³ EXACTO (test-ensamble.cjs).
   Limitaciones v1: sin anidar, sin mates automáticos (posición manual), sin molde en piezas
   insertadas. FALTA v2: mates concéntrico/coincidente + el 11-34 completo como lección.
   GOTCHA: el doc nuevo trae pieza-demo (rect 40×24 extrude 12 = 11,520 mm³) — un ensamble
   empieza BORRANDO las ops base.
3. **`addComponent('sketch')` no acepta perfil por API** — el patch de `profile` vía
   `updateComponent` no aplicó (el boss D quedó como caja default 216,000 mm³). El camino
   fiel es la UI (boceto-en-cara + Unir), pero la API del agente debe soportarlo.
4. **Revolve sensible al eje** — perfil con borde a x<0 por ±0.17mm (redondeo de píxel del
   clickmm) → excepción OCCT. Mitigación encontrada: ENTRADA DINÁMICA (longitud+ángulo
   exactos, auto-H/V a 1e-6) para perfiles de revolución. Función deseable: snap-al-eje
   en el sketcher + validación previa con mensaje.
5. **ARREGLADO en app: corte-desde-cara ahora nace PASANTE** (depth 200, como Through-All
   de Fusion) — antes el corte extra heredaba 12mm aunque el principal se editara (bug de
   la ele con un barreno corto: faltaban π·10²·3 mm³ exactos).
6. **Pin del 11-34: EXACTO al primer intento** (10,995.6 mm³) — círculo+extrude sólidos.
7. **Trim círculo-contra-círculo NO soportado** (solo "círculo cortado por líneas", documentado
   y confirmado en corrida) — la lección del cacahuate es imposible hoy.
8. **El arco generado por TRIM no participa en el lazo del perfil** — círculo+cuerda recortados
   extruyen con vol=0 (o "<3 puntos"): el extractor no camina lazos mixtos cuando el arco viene
   del trim (los dibujados con la herramienta de arco SÍ funcionan — la biela lo probó). Arreglar
   esto desbloquea todas las lecciones de trim del cap. 2. Lección U2L5 (flat-D) APARCADA hasta entonces.
9. **El barrido de embonado de engranes tarda >4s** — cualquier UI/arnés debe esperarlo
   (spinner/estado "barriendo…" sería la función de UX correcta).

- **ENSAMBLE genérico** (esperada): insertar piezas guardadas + mates concéntrico/coincidente.
  Hoy solo existe el ensamble especial de engranes. Sin esto no hay 11-34, ni robots.
- **Patas de extensión en hélice** (esperada): el sweep-hélice no tiene extensiones tangentes.
- **Hole wizard** (avellanado/abocardado/roscado) — el libro los usa desde el cap 7.
- **Plásticos** (pedido directo del user): costillas (rib), bosses con cartabones, draft por cara,
  lip/groove, snap-fit — nada de esto existe; Kazmer es la guía.
- **Análisis**: FEA existe (von Mises + generativo); faltan: modal, térmico, factor de seguridad
  por zona, y el reporte imprimible.

## Reglas
- Piezas por LA INTERFAZ (ForjaAgent/clicks), jamás geometría hardcodeada al kernel.
- Verificación = volumen/euler exactos + shot mirado A OJO.
- Cada brecha se anota AQUÍ con el ejemplo que la destapó; se construye en orden de
  desbloqueo (qué abre más ejemplos por peso).
