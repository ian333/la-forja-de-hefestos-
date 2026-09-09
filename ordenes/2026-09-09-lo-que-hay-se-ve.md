# ORDEN: LO QUE HAY SE VE — centrado, nunca negro, sin ruido: el Foco vuelve a atenuar

ESTADO: proximo
PRIORIDAD: 2

BASE: 5c64cb8

OBJETIVO: ian (2026-09-09, viendo el paseo): «¿podemos hacer de alguna manera que SIEMPRE se vea en
pantalla lo que hay? Sé que nos podemos mover, pero hay ciertas partes en el video en que no se ve nada,
y todo debería estar centrado». Medido el 2026-09-08: del segundo 128 al 168 del paseo el viewport está
casi negro (E4 baja la opacidad del molde a 0.08 y no queda nada más en pantalla); la ficha del
enfriamiento sigue pegada en PARTIR y en EL MOLDE tapando cotas; el molde grita ocho ✗ rojos por
diferencias de 28 µm («Hc compra 55 ≠ 55.028 ✗»); la tira inferior pinta «CARAS DEL SÓLIDO 472» debajo de
las pestañas; el pie dice «V 846 − E 1284 + F 472 = 34» y «14984 △ · 2338 KB» a un cliente; el dictamen
imprime «Son T3-T5 y todavía no están». Al final de esta orden rige una LEY, no un arreglo: lo que existe se
ve, centrado, ocupando el cuadro, nunca negro; una lente a la vez; ✗ solo fuera de tolerancia; la
telemetría del kernel y las notas de desarrollo viven en Temis, no en la cara del cliente. Y el runner la
mide en CADA paso.

## POR QUÉ VA SEGUNDO
- Es barato y visual: cámara, opacidades, tolerancias y qué se pinta. No toca el kernel.
- Sin la ley medible, EL PASO 6 SE VE TRABAJAR no tiene contra qué probarse: primero el instrumento
  (`__forgeBrep.encuadre`), luego la obra.

## YA-EXISTE (prueba de ausencia)
- `ForgeBRepStudio.tsx`: el efecto de reencuadre ya sigue el bbox de `mold.moldParts` con `orbitTo`
  (orden el-paso-6-existe) — pero sigue a algo con opacidad 0.08: encuadra lo invisible. `moldeOpacidadRef`
  restaura la opacidad solo al llegar a E5.
- La ficha del enfriamiento es la de la lente ENFRIAMIENTO (`parte-lente-enfriamiento`); las lentes
  PARTIR/MOLDE no la apagan. El Foco tiene la noción de lente activa: falta que una lente ATENÚE a la anterior.
- Las etiquetas «X ≠ Y ✗» del molde son los invariantes de `mold-contratos.ts` / `mold-interference`
  pintados sin tolerancia; `fits.ts` ya tiene tolerancias LITERALES (pin↔barreno 0.13 mm): la tolerancia
  existe, no se aplica al letrero.
- NO existe: una medida de encuadre (centro y ocupación del bbox visible en pantalla, luminancia del
  viewport) que el runner pueda leer; ninguna regla de «una lente a la vez»; ningún modo cliente que
  esconda la telemetría del kernel.

## TOCA (probable; se confirma al empezar)
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- caminos/la-carcasa-de-mitsubishi.md
- scripts/camino-runner.cjs

## CREA
- public/evidencia/2026-09-09-lo-que-hay-se-ve/… (capturas por paso + resultados.json)

## BORRA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- `window.__forgeBrep.encuadre()` → `{ dx, dy, fill, luma }`: desvío del centro del bbox visible respecto
  al centro del viewport (fracción), fracción del cuadro que ocupa, luminancia media. Check en TODOS los
  pasos del RUNNER: `|dx|,|dy| ≤ 0.10 · fill ≥ 0.30 · luma ≥ 0.06`.
- Paseo: ningún cuadro negro en la línea de tiempo (hoja de contactos cada 8 s); en E4 el molde se ve.
- Al pasar de ENFRIAMIENTO a PARTIR y a MOLDE la ficha desaparece (check: `count:[data-testid="ficha-en-el-mundo"]>=1`
  solo en el paso 3; `==0` en 5 y 6).
- Cero «✗» en el molde por |Δ| < tolerancia declarada; el ✗ real (draft 0° en el macho) queda solo y visible.
- Vista cliente sin «TOPOLOGÍA», «MALLA/STEP», «vóxeles», ni notas «Falta aquí… T3-T5».
- runner ≥ 7/8 sin regresión; orden-gate VERDE; censo igual.

## CIERRE (se llena al terminar)
