# ORDEN: TESSELLATE NO REMALLA — pedir una malla más gruesa (o con otro ángulo) sobre una forma ya mallada devuelve la malla vieja

ESTADO: despues (hallazgo registrado; sube a PRÓXIMO con `git mv` cuando ian diga — PRÓXIMO ya estaba en 7/7)

BASE: be27ab4

OBJETIVO: `tessellate()` (src/forja/brep/occt.ts) promete en su comentario limpiar la triangulación previa
(`BRepTools.Clean(shape, true)`) para que la deflexión pedida se respete. Medido: no surte efecto. Al final de esta
orden pedir una deflexión sobre una forma ya mallada devuelve ESA deflexión, o el comentario deja de prometerlo.

## LO QUE SE MIDIÓ (2026-09-19 · node + kernel · placa de cavidad de 1557BGY)
- MISMA forma, parejas en secuencia (lineal mm : angular rad → triángulos): 0.8:0.8 → 5,058 · 0.1:0.5 → 13,640 ·
  0.06:0.5 → 18,518 · 0.03:0.5 → 30,718 · 0.03:0.35 → 30,718 · 0.03:0.2 → 30,974 · **0.1:0.1 → 30,974** ·
  0.07:0.07 → 30,974 · 0.03:0.03 → 30,974 (0.6 s).
- Forma FRESCA por pareja: 0.03:0.5 → 30,718 (1.1 s) · 0.03:0.2 → **73,578** (2.1 s) · 0.03:0.03 → **6,243,430** (229 s).
- O sea: más fino en LINEAL sí remalla; más grueso, o solo otro ÁNGULO, devuelve la malla que ya estaba.
  `oc.BRepTools.Clean` existe en el build (es función); o lanza por aridad y el `try/catch` se lo traga, o limpia y
  el mallador incremental reusa por otro lado. No se investigó más.
- Por qué importa: esta reutilización hizo que mi primera medición «refutara» en falso la causa de los 217 s de
  LA ENTRADA (enmienda 2). Cualquier medición de teselado sobre una forma reusada miente igual. En la app el efecto es
  memoria de más (una malla fina donde se pidió gruesa), no un resultado incorrecto.

## EJERCICIOS
- [ ] ver si `Clean(shape, true)` lanza (quitar el catch en una prueba de node) y cuál es la firma real del binding.
- [ ] prueba de node: misma forma, fina → gruesa, y que la gruesa salga gruesa.

## TOCA
- (se declara al abrir)

## CREA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- La tabla de arriba repetida con la MISMA forma dando los números de la forma fresca.
