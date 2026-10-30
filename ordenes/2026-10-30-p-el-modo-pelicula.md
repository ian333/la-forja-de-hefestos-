# ORDEN P: EL MODO PELÍCULA — la app filma como cine: sin interfaz, acero de verdad, cámara con lente y el corte térmico por la raíz de los postes

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente: `git rev-parse --short HEAD` tras ponerse en main)

OBJETIVO: el primer video de YouTube de La Forja (plan aprobado por ian el 2026-10-30: `/mnt/c/Users/sebas/Downloads/la-forja-video-1/00-EL-VIDEO-1.md`,
léelo completo, en especial §3 «Las tomas» y §4 «O2 · App en modo película»; el debate que lo produjo está en `.../debate/`) se
filma con la propia app, porque «lo que veo debe ser lo que recibo» (el comprador). Hoy la película de la semana 1 parece grabación
de pantalla: barras, tarjetas de paso, notas internas («es otra orden»), la ficha «datos inventados», el molde translúcido «de
hielo» sobre fondo marino, cámara siempre desde arriba (22–28° de elevación, fov fijo 35°), aristas con dientes de sierra y bujes
como «papel rasgado» donde los cruzan los pernos. Y la toma del gancho —las 4 raíces macizas de los postes al rojo— no existe:
la lente pinta la superficie, y a media altura cada poste es un tubo de pared 2.04 mm (frío); lo lento es la raíz maciza de 5.4 mm
(z ≈ −24.9 a −30.3 en el marco de la pieza, medido por la ronda 2 del ingeniero).

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **El modo película** (un interruptor por `__forgeBrep`/URL, apagado por defecto): cero interfaz en el cuadro (barras, riel de
   pasos, tarjetas, cursor, notas internas, ficha, puntaje, rótulos DOM); fondo #000 sin scanlines. Los números NO se queman: los
   rótulos se componen en el montaje desde el expediente (otra orden).
2. **La cámara con lente**: `orbitTo` acepta fov y elevaciones negativas (contrapicado), determinista (la misma pose da el mismo
   cuadro en dos corridas).
3. **Los cortes térmicos**: un corte horizontal a la altura de la raíz maciza de los postes y uno vertical por el eje de un poste,
   pintados con el campo INTERIOR que la lente de enfriamiento ya calcula por vóxel (`foco-lentes.ts`), con la isoterma de
   expulsión dibujada y una paleta tipo cámara térmica (lo ya firme cae a casi negro). La física no cambia: lo que se pinta es el
   mismo campo que da el número de la lente (si al medir no coinciden, dilo en el CIERRE; el número lo arregla la orden M).
4. **El acero opaco**: el molde con el material de acero que ya existe en el código (`MATERIAL_PBR`, ForgeBRepStudio.tsx) y un
   entorno de luz que le dé reflejos; sin dientes de sierra en las aristas ni z-fighting donde los pernos cruzan los bujes; sin
   parpadeo a 60 fps.

## YA-EXISTE (prueba de ausencia)
- `orbitTo` (ForgeBRepStudio.tsx ~L5284), `MATERIAL_PBR` (ForgeBRepStudio.tsx), el MODO CAMINO y su CSS (`piel-futuro.ts`), la
  lente de enfriamiento por vóxel (`foco-lentes.ts`), `inspeccion.corte(eje, mm)`, la filmadora (`scripts/filma-camino.cjs`, reloj
  virtual 60 fps, 3840×2160 reales) y los porteros `scripts/critic-gate.cjs` / `scripts/critic-eye.cjs`.
- CERO `<Canvas>` nuevos (Regla #0.7): todo vive en ForgeBRepStudio.tsx / FocoMolde3D.tsx.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/piel-futuro.ts
- src/forja/brep/FocoMolde3D.tsx
- src/forja/mold/foco-lentes.ts
- scripts/filma-camino.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (K y L trabajan EN PARALELO; M vendrá después de L)
- ForgeBRepStudio.tsx: P = el modo película, la cámara, el material y el render de los cortes. K toca la descarga del STEP; L el
  reporte. foco-lentes.ts: P = solo exponer/pintar el campo interior; el modelo de t_c (barra/placa/raíz) es de la orden M.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Capturas 4K reales (3840×2160, medidas con ffprobe) de la 1594C Box, juzgadas con Read: (T01) el corte horizontal por la raíz
  con los 4 discos calientes; (T07) el corte vertical por el eje de un poste (tubo frío, raíz caliente); (T12) el molde en acero
  opaco; cada una con el modo película encendido y CERO píxeles de interfaz (`critic-eye`/`critic-gate` y tus ojos).
- Determinismo: la misma pose dos veces → cuadros idénticos (hash).
- Un clip de 2 s a 60 fps del acero girando, revisado cuadro a cuadro en iangpu: sin parpadeo ni dientes de sierra.
- Con el modo película APAGADO la app es idéntica a hoy (el camino de la carcasa sigue 8/9; la huella ×3 igual que main).
- tsc sin errores nuevos; el cubo 270/270.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
