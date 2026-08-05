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
| `1553B.stp` / `1553D.stp` | 1553 handheld CURVO (tapa panorámica) | caja + tapa c/u |
| `1552C3BK.stp` | 1552 soft-side — banda TPE SOBREMOLDEADA | caja + tapa (¡con-mecanismos REAL!) |
| `1554B.stp` / `1557BGY.stp` | herméticas IP66/IP68 — canal de empaque | caja + tapa c/u |
| `1591XXCBK.stp` | 1591XX multiuso | caja + tapa |
| `1593L.stp` | 1593L instrumento | conchas + paneles + puertas |
| `1594C Box/Lid.stp` | 1594 con costillas guía-tarjeta | caja + tapa con snaps (con-mecanismos) |
| `1598B Bottom/Top/End Plate.stp` | 1598 instrumento con standoffs | 2 mitades + panel 1.6 |
| `1599HBK.stp` | 1599H teclado grande 220 mm | 2 mitades |
| `RL6215BK.stp` | RL utilitaria | caja + tapa |
| `PJ12106.step` | PJ policarbonato IP — pared 4 mm, 336 mm | caja + tapa + panel + 4 clips |

**Pipeline** (`scripts/piezas-reales-intake.cjs`): importSTEP → sólidos → eje de
apertura §11 → DFM Kazmer §2.3 → moldMachine → CAMPO DE FLUJO (flowlen).
Resultado (`intake.json`): **73 sólidos · DFM moldeable 70/73 · flujo sano 71/73** (2026-08-05: banco ×3.5; los 3 con-mecanismos son VERDAD — 1552 soft-side trae banda sobremoldeada y la tapa 1594C traba con snaps)
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
