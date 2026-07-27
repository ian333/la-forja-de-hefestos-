# Piezas REALES de inyección — lote Hammond (2026-07-17)

> "ve y consigue piezas reales de inyección y tráelas" (Ian). Piezas COMERCIALES
> nacidas para el molde — no diseños de impresión: cajas ABS inyectadas de
> Hammond Mfg, STEP publicados por el fabricante para design-in
> (`hammfg.com/files/parts/stp/<PARTE>.zip`).

| STEP | familia | sólidos útiles |
|---|---|---|
| `1591BSBK.stp` | 1591BS multiuso 112×62×31 | caja + tapa |
| `1551F.stp` | 1551F miniatura con pestañas | caja + tapa + placa 1 mm |
| `1599BBK.stp` | 1599B handheld | mitad superior + inferior |
| `1593K.stp` | 1593K instrumento | 2 medias conchas + 2 paneles + 2 puertas |
| `1593D.stp` | 1593D instrumento | 2 medias conchas + 2 paneles + 2 puertas + panel 1.6 |

**Pipeline** (`scripts/piezas-reales-intake.cjs`): importSTEP → sólidos → eje de
apertura §11 → DFM Kazmer §2.3 → moldMachine → CAMPO DE FLUJO (flowlen).
Resultado (`intake.json`): **21 sólidos · DFM moldeable 21/21 · flujo sano 21/21**
(err de volumen <15 %, cero vóxeles muertos) — el motor del hito mastica
geometría ajena, y las piezas de inyección REALES pasan el DFM a la primera
(a diferencia del lote de STL de impresión: ~83 % sin draft).

## Los 3 gotchas que este lote cazó (no re-descubrir)

1. **`uniqueSubShapes` quiere el ENUM emscripten**, no su `.value` numérico: con
   el número devolvía el compound entero como "1 sólido" y el DFM analizaba
   caja+tapa FUSIONADAS → "cavidad sellada / con-mecanismos" falso en todo.
2. **Efecto TECHO del voxelizado en placas**: `ceil(espesor/celda)` decide la
   inflación (1.7 mm a celda 0.69 = 3 capas = +22 %; gemelos idénticos daban
   20 % vs 4 % por puro corrimiento de fase). Fix: para `minDim ≤ 5`, la celda
   se ajusta a DIVIDIR EXACTO la dimensión menor.
3. El perfil A(z) de sección localiza el asiento caja/tapa de un ensamble
   fusionado (mínimo brusco de área) — quedó como técnica en el transcript,
   innecesaria una vez arreglado el explorador.
