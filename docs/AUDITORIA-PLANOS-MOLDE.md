# Auditoría de planos de molde — La Forja (cliente exigente)

Revisión hoja por hoja a resolución COMPLETA de los 7 juegos (4 del libro + 3 clientes),
91 páginas, por 4 auditores independientes + revisión propia. Agrupado por CAUSA RAÍZ.
Estado: **NO entregable a cliente** hasta corregir los ALTA.

## Causa raíz 1 — la cavidad/pieza sale de la caja envolvente (bbox), no de la pieza
- **[ALTA] Piezas REDONDAS → cavidad RECTANGULAR** (cup ⌀60, lid ⌀80). Imposible moldear redondo con hueco rectangular. La jabonera (caja) sí sale bien → confirma el bug.
- **[ALTA] Aspecto de cavidad ignora el ancho real.** Sony 150×45 → cavidad ~158×106 (casi cuadrada). Usa razón fija 0.67·ancho.
- **[ALTA] Cavidad más chica que la pieza.** Genérico 90×90 → hueco ~98×60; lado corto 60 < 90 → la pieza no cabe.
- **[ALTA] Molde multi-cavidad dibujado como 1 sola cavidad.** LEGO 16 cav y Sony 4 cav muestran 1 hueco central.
- **[ALTA] La huella moldeante (cavidad/núcleo) SIN NINGUNA cota** en todas las placas (tamaño/prof/posición).
- **[ALTA] Enfriamiento AUSENTE de los planos de placa** (no está en la tabla de barrenos ni en las vistas) → el taller no sabe dónde barrenar el agua.
- **[ALTA] Líneas de agua ATRAVIESAN la pieza** (genérico: 2 círculos ⌀9.53 dentro del bloque de la pieza).

## Causa raíz 2 — layout de barrenos genérico, no atado a la pieza
- **[ALTA] Pilar guía ⌀32 CHOCA con tornillo de esquina** (bezel/LEGO/Sony): centros a 19.8 mm < radios sumados → pared negativa, no maquinable. (El genérico ⌀25 no choca.)
- **[ALTA] Tornillo ⌀8 = M8 sin holgura**, pasante idéntico en ambas mitades cruzando la partición → nada rosca, el molde no ensambla ni abre. Falta avellanado/roscado.
- **[ALTA] Expulsores en rejilla genérica, NO bajo la cavidad.** En redondas deberían ir en círculo de pernos; en LID los 4 caen fuera del labio ⌀80; en Sony ninguno toca la huella.
- **[ALTA] Conteo de expulsores incoherente**: dibujados 20 vs BOM/análisis 64 (LEGO).
- **[ALTA] La placa de soporte es CLON de la Placa B** (lleva bores de pilar guía ⌀32 + geometría de cavidad que no le tocan).
- **[BAJA] Placa inferior sin barreno central de expulsión (KO)** para la barra de la máquina.

## Causa raíz 3 — colada caliente no está en la geometría
- **[ALTA] Bebedero (sprue) frío dibujado en moldes HOT-RUNNER** (Sony/LEGO); no hay bores de boquillas ni placa de manifold. Contradice "0% regrind, sin bebedero".
- **[MEDIA] Globo de boquillas calientes apunta a un agujero de agua** (LEGO pág 1).
- **[MEDIA] Faltan hojas** de placa expulsora, rieles y manifold/boquillas.

## Causa raíz 4 — vista de pieza rota en revoluciones (revolve)
- **[ALTA] CUP/LID mal orientadas**: el círculo sale como ALZADO (debería ser PLANTA); planta/lateral rotas o vacías. Falta altura (58) / espesor axial / labio undercut. (Jabonera bien → bug de revoluciones.)

## Causa raíz 5 — análisis / cajetín / valores
- **[ALTA] Bezel se entrega en REBABA**: el análisis exige pilares de soporte (δ>venteo→FLASH) pero no hay pilares en BOM/dibujo, y la nota de pág 1 afirma lo contrario.
- **[MEDIA] Error de unidades de tonelaje**: "1400 kN (200 t)" — 200 tonf ≈ 1962 kN (error ~40 %); máquina inconsistente (200 t vs 250 t).
- **[MEDIA] Venteo "máx 0.292 mm" ~10× demasiado profundo** para ABS (rebaba ~0.03 mm).
- **[MEDIA] Núcleo 32 mm > Placa B 27 mm** (marco más grueso que la placa que lo aloja).
- **[MEDIA] MASA vacía ("—")** en todos los cajetines de 4 vistas, aunque el análisis calcula la masa.
- **[MEDIA] Tabla de análisis incompleta** en LID/genérico (faltan filas Llenado/Núcleo/Expulsión).
- **[BAJA] "✓✓" doble palomita** (glitch); **DFM 100/100** no creíble; **masa = bloque macizo** (ignora cavidades); **escala no estándar** (1:1.7, 1:1.3) y distinta entre las 2 hojas de la misma placa.

## Causa raíz 6 — BOM / globos / ensamble
- **[MEDIA] Globos encimados** sobre el texto del BOM/notas y líderes que no terminan en geometría (todos los ensambles).
- **[MEDIA] Faltan globos** de items críticos (Placa B núcleo #5, Placa A #6, PIEZA #9) en la sección.
- **[MEDIA] Etiqueta roja "LÍNEA DE PARTICIÓN" invade el BOM**; globo de corredera (#12) encima de la leyenda.
- **[BAJA] La PIEZA moldeada se lista como componente del molde (CANT 1)**; **bebedero frío sin conicidad** (no desmolda).

## Causa raíz 7 — cotas/etiquetas encimadas en las hojas de 4 vistas
- **[BAJA] La cota de ancho ("396.0"/"31.8"/…) se encima con el rótulo "ALZADO"** en TODAS las hojas de 4 vistas.
- **[BAJA] Cotas ⌀ repetidas** (LEGO: "⌀4.8" ×8 en vez de "8× ⌀4.8"); **etiquetas ⌀ de esquina encimadas** (pilar+tornillo).
- **[BAJA] La última fila del análisis del bezel desborda** a la columna REF/§.

---

## Orden de reparación (por impacto)
1. **Cavidad consciente de la pieza** (forma redonda/caja + huella real L×W o ⌀ + ACOTADA) — mata C1 casi entero.
2. **Multi-cavidad en grid** (nCav impresiones) + expulsores bajo cada cavidad (círculo de pernos si es redonda) + conteo coherente con BOM — C2 mayor.
3. **Enfriamiento en las placas** (posición + tabla) sin cruzar la pieza — C1.
4. **Colisión pilar/tornillo + holgura de tornillo + placa de soporte propia + sin bebedero en hot** — C2/C3.
5. **Manifold + boquillas en la geometría** (BOM + bores) para hot runner — C3.
6. **Vista de pieza de revoluciones** (planta = círculo, acotar altura/labio) — C4.
7. **Cajetín/análisis**: MASA, venteo real, escalas estándar, tonelaje, ✓✓, pilares de soporte cuando el análisis los exige — C5.
8. **Globos/cotas**: separar globos, mover partición, cota vs "ALZADO", ⌀ agrupados — C6/C7.
