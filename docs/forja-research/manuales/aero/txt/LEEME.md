# Corpus de texto de los manuales del cliente (aero)

Extraído con `pdftotext -layout` de los PDF de `../`. Estos `.txt` son la fuente que leen
los agentes: **no abras los PDF para leer texto** (10× más caro y más lento). Los PDF sí
sirven para las FIGURAS (ver `../../aero-pliego/figuras/`).

| Archivo | Libro | Líneas | Estado |
|---|---|---|---|
| `anderson.txt` | Anderson, *Fundamentals of Aerodynamics* 6ª ed. | 52,106 | limpio |
| `bertin.txt` | Bertin & Cummings, *Aerodynamics for Engineers* 6ª ed. | 46,951 | limpio |
| `raymer.txt` | Raymer, *Aircraft Design: A Conceptual Approach* 6ª ed. | 55,136 | ⚠️ OCR SUCIO |

## ⚠️ Offset página-del-libro ↔ página-del-PDF

Para renderizar una figura con `pdftoppm` hay que convertir:

- **Anderson: pág_PDF = pág_libro + 23** (verificado: libro 1006 = PDF 1029)
- **Bertin: pág_PDF = pág_libro + 16**
- **Raymer: +30 hasta PDF 619, y +32 de PDF 620 en adelante.** ⚠️ El offset NO es
  constante: hay **dos páginas sin numerar insertadas** ahí (PDF 619 imprime "589" y
  PDF 620 vuelve a imprimir "588"). Verificado a ambos lados de la costura. Un offset
  fijo de +30 hace leer la página equivocada en todo el segundo tomo del libro
  (estabilidad, performance, costos, los diseños de ejemplo).

Este offset ya nos costó una tanda de renders inútiles. **No lo asumas ni confíes en la
tabla de arriba: renderiza y LEE EL FOLIO IMPRESO antes de transcribir nada.** Un libro
escaneado puede traer páginas sin numerar, láminas a color insertadas o numeración que se
reinicia — Raymer trae las tres cosas.

## Offsets de capítulo (línea donde empieza cada uno)

**anderson.txt** — cap 1: 769 · 2: 5260 · 3: 9868 · 4: 15095 · 5: 19628 · 6: 22726 ·
7: 23815 · 8: 25368 · 9: 27878 · 10: 31514 · 11: 33859 · 12: 37302 · 13: 38116 ·
14: 39949 · 15: 42383 · 16: 43954 · 17: 45786 · 18: 46522 · 19: 48533 · 20: 49086 ·
(apéndices y referencias a partir de ~49700). Regenerar con:
`grep -nE "^\s*C H A P T E R\s+[0-9]+\s*$" anderson.txt`

**bertin.txt** — cap 1: 514 · 2: 2255 · 3: 5557 · 4: 9939 · 5: 13267 · 6: 16967 ·
7: 19673 · 8: 24709 · 9: 28963 · 10: 31418 · 12: 36883 · 13: 40485 · 14: 43862.

## Historial de defectos del corpus (ya corregidos)

1. **`pdftotext` se atoraba en la pág. 739 del PDF de Anderson** y devolvía solo hasta el
   cap. 10 — se estaban perdiendo **los capítulos 11 a 20 completos** (todo compresible y
   viscoso) sin ningún error visible. Se arregló extrayendo por rangos de página y
   concatenando.
2. **El primer reensamblado dejó ~1,078 líneas duplicadas** (repetía pp. 694-716) porque se
   concatenó usando números de página del libro donde iban los del PDF. Corregido el
   2026-08-04; queda un solape intencional de UNA página en la costura (pág. 716), inofensivo.

**Lección:** cuando `pdftotext` devuelva menos de lo esperado, no falla ruidosamente —
devuelve un archivo truncado que parece completo. Verifica siempre contando capítulos
contra el índice.

## Erratas de los propios libros

Los agentes llevan documentadas **decenas de erratas comprobadas con aritmética** (no
supuestas) en los tres libros: valores intermedios impresos que no coinciden con los que el
propio autor usa, una figura que el autor lee mal, ticks mal impresos en un eje logarítmico.
Están en los `.md` de `../../aero-pliego/`, sección "erratas" de cada uno.
**Antes de convertir un número del libro en un test, busca si ya está reportado ahí.**
