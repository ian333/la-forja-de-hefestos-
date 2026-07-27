# ÍNDICE MAESTRO — TODO lo de MOLDES DE INYECCIÓN (La Forja)

> Consolidación de TODO el material de molde de inyección: el libro (biblia), 54 videotutoriales
> organizados, nuestros docs de proceso, y el mapa de qué falta + dónde conseguir más.
> **Por qué hay "tan poca info" de moldes** (la frustración real): el diseño de moldes es conocimiento
> de OFICIO — se transmite por aprendizaje en taller, vive en libros caros (Kazmer, Menges) y en estándares
> propietarios de empresa (DME/HASCO). No hay "tutorial de YouTube" masivo porque es artesanal e industrial.
> **ESO es exactamente el foso de La Forja:** codificar el oficio artesanal en un kernel que cualquiera invoca.

---

## 1. LA BIBLIA (el libro)

- **David O. Kazmer — *Injection Mold Design Engineering* (Hanser).** PDF en
  `/mnt/c/Users/sebas/Downloads/David O. Kazmer... Injection Mold Design Engineering...pdf`.
  Es la columna vertebral del motor de molde de La Forja: las 4 piezas del banco (cup/lid/jabonera/bezel),
  Eq 4.1-4.3 (mold base), Eq 9.4 (enfriamiento), §11.3.6-7 (partes móviles), §12 (interlocks). REGLA KAZMER:
  cotas LITERALES, extensiones DECLARADAS.
- **Springer Handbook of Robotics — cap Dinámica** (Featherstone-Orin), en `docs/forja-research/*P2_31*` —
  no es de molde pero alimenta la dinámica.
- **Faltan (recomendados, ver §5):** Menges *How to Make Injection Molds*; Rees *Mold Engineering*; Pye.

---

## 2. LOS 54 VIDEOS (corpus, en `iangpu:/mnt/e/tutoriales/_MOLDES/`)

Canal madre: **Alwis Design** (SolidWorks Premium 2022) — MUDOS en su mayoría (screencasts sin narración →
Whisper no saca texto → extracción por FRAMES, cara). **[T]** = tiene subtítulo/transcripción (barato de minar).
Fusion (Lars) tiene casi nada de molde (confirmado). Organizados por PIEZA y por TÉCNICA:

### Por PIEZA (cada una: modelar → core/cavity → a veces slider/ensamble)
| Pieza | Videos | Técnica que enseña |
|---|---|---|
| **Cuchara (spoon)** | 003, **004[T]**, 005 | core/cavity de superficie curva |
| **Hair clip / peine** | 007, 008 | ← ya reproducido (PROCESO-2), partición ondulada |
| **Base multi-cavidad** | **012[T]**, 013 | multi-cavidad, balanceo de colada |
| **Crystal Cup (hot plate)** | 019, 020, 021, 023, 024 | **colada caliente / hot runner** multi-cavidad |
| **Bracket** | 025, 026 | core/cavity de escuadra |
| **Handle (3 placas)** | 028, **029[T]**, 030 | **molde de 3 PLACAS** (double ejection) |
| **Spool / filament spool** | 032, 033, 034, 036, 038 | core/cavity + slider |
| **Water bottle** | 047, 066 | multi-cavidad de botella |
| **Bottle cap** | 048, **049[T]** | tapa (rosca → desenrosque) |
| **Phone holder** | **068[T]**, 069, 070, 071, 072 | **slider HIDRÁULICO** para undercut |
| **Horn (3 placas)** | 075, 076 | 3 placas + doble expulsión |

### Por TÉCNICA (para buscar "cómo se hace X")
- **Core & Cavity base:** 014, 050, 052, 056, **064** ("master Mold Tools en 14 min" = el resumen).
- **Sliders para undercut:** 036, 040, 041, 042, 055, 058, 059, 060, 061.
- **Sliders HIDRÁULICOS:** **068[T]**, 069, 070, 071.
- **Molde de 3 placas:** 028, **029[T]**, 075, 076.
- **Colada caliente / hot plate:** 019, 020, 023, 024.
- **Multi-cavidad:** **012[T]**, 013, 019, 021, 047.
- **Mold base + componentes estándar:** 050, 062, 063.
- **Enfriamiento + expulsión:** 051 ("Cooling and Eject System").

**Minables YA por transcripción (5, cubren el espectro):** Spoon, Base multi-cav, Handle 3-placas, Bottle Cap,
slider hidráulico. El resto (mudos) = frames sólo para los que decidamos reproducir.

---

## 3. LO QUE YA DESTILAMOS (nuestros docs)

En `docs/forja-research/solidworks-mold-curso/`:
- **PROCESO-0** — modelado de la PERCHA real (36 features, silueta∩planta) — pieza.
- **PROCESO-1** — percha core/cavity (49 pasos, cotas literales) — el molde.
- **PROCESO-2** — peine/pinza split (partición ondulada, 87 aristas, knit) — molde familia.
- **PROCESO-3** — downloadcourse (NX Mold Wizard + SolidWorks Plastics, sim de llenado).
- **PROCESOS-REPETITIVOS** — pipeline canónico de 12 fases + mapa SW→La Forja + 8 micro-patrones automatizables.
- **ESTETICA-SOLIDWORKS-NOTAS** — las 10 mejoras visuales para verse como Solid.

Y en el KERNEL: `curso-flow.ts` (6 botones del pipeline), `parting.ts` (partición plana ✓ / no-plana v2),
`moldmachine.ts`, `flowlen.ts` (motor de inyección), el ciclo acoplado, planos, cotización.

---

## 4. GAPS — qué técnica NOS FALTA reproducir en el kernel

| Técnica | En el corpus | En La Forja |
|---|---|---|
| Core/cavity partición plana | ✓✓✓ | ✓ (curso-flow) |
| Partición NO plana (curva) | 007/008, spoon | ✅ heightfield (carvedInserts, 0.5s) |
| **Slider / side-action (undercut)** | 9 videos | ✅ perno angular (catálogo) + hidráulico |
| **Slider HIDRÁULICO** | 068-071 | ✅ corredera+cilindro (bore Eq 11.25) |
| **Molde de 3 placas** | 028/029/075/076 | ✅ threeplate.ts + sim doble apertura + botón |
| **Colada caliente / hot runner** | 019-024 | ✓ (bezel) |
| **Desenrosque (rosca)** | bottle cap 048/049 | ✓ (MoldUnscrewSim) |
| Mold base + estándar | 050/062/063 | ✓ (moldbase, catálogo) |
| Enfriamiento + expulsión | 051 | ✓ (Eq 9.4, ciclo) |

---

## 5. DÓNDE CONSEGUIR MÁS (Fusion es flaco — buscar en otro lado)

1. **NX Mold Wizard** = el estándar PROFESIONAL real (lo que usan los talleres; PROCESO-3 ya era NX). Hay
   canales dedicados (buscar "NX Mold Wizard tutorial", "UG mold design") — más pro que SolidWorks.
2. **Lars/cadcamstuff** — su serie Fusion mold (slider 075) ya baja; tiene más de molde disperso.
3. **Libros:** Menges *How to Make Injection Molds*, Rees *Mold Engineering*, Pye *Injection Mould Design*.
4. **Guías gratis de fabricantes** (PDF): Protolabs, Xometry, ICOMold — reglas DFM de molde.
5. **Alwis tiene ~332 videos** (65 bajados) — al terminar la descarga habrá aún más molde.

**Recomendación:** NO necesitamos más VOLUMEN — Alwis + Kazmer ya cubren TODO el temario. Lo que falta es
PROFUNDIDAD: reproducir en el kernel las técnicas 🟡/❌ (slider hidráulico, 3 placas en curso-flow, partición
no-plana v2). El corpus es referencia; el trabajo es codificarlo.
