# ORDEN: EL AGUA NO CRUZA LOS RETORNOS — ninguna línea de agua atraviesa un barreno móvil, y el circuito lo sabe al trazarse

ESTADO: hoy
PRIORIDAD: 1

BASE: d0e0136

OBJETIVO: en la caja grande (1599HBK) dos líneas de agua B ATRAVIESAN los pines de retorno: eje a eje 5.31 y 5.40 mm contra
r_agua 3.17 + r_retorno 6 = 9.17 → se meten 3.86 y 3.77 mm, CUATRO cruces (2 líneas × 2 retornos, y = 39 y y = 257). En la máquina
es una fuga de agua y un pin atorado. Que el circuito de agua se trace sabiendo dónde van TODOS los barrenos móviles (pines, retornos,
vástago/KO) y deje entre cada barreno y cada línea ≥ ½·D de acero (regla del agua, la misma que ya usa el juez), en las 4 piezas y el cubo.

## LO MEDIDO (revisión cruzada 2026-09-28, app real dev6, fusión 7040a3c)
- focos/revision/reglas.md + reglas/caja-grande_2_5.png (scratchpad de la sesión bec93bb9; copia en Downloads/inspeccion-del-molde/revision-cruzada/).
- El 1.16/1.55 mm que el inspector llamaba «acero que queda» era la PENETRACIÓN de la malla (301.6 y 282.7 mm³). El «6.34» era el
  traslape de cajas contra el ROL de los 4 retornos. Tapa: agua↔retorno 3.30 contra 3.17 (pasa por 0.13; el inspector no lo dice).
- LAS REGLAS DE HEFESTOS (2026-09-22) ya mueve los CRUCES del agua en Y para librar retornos (`estacion8Circuito`); las LÍNEAS no.

## DECISIÓN DE IAN
- 2026-09-22 «sí»: si un pin cruza el agua, primero se mueve el pin. El RETORNO no se mueve igual (va en las esquinas de la expulsora y
  guía el paquete): aquí se mueve LA LÍNEA de agua, o se parte el circuito; si no queda lugar, el molde lo DICE (no lo esconde).
- 2026-10-06 «repara los errores… y juzga todo visualmente».

## EJERCICIOS
- [ ] medida EXACTA (analítica, eje↔eje de cilindros, no malla) de cada línea de agua contra cada barreno móvil, por CUERPO (no por rol),
      en las 4 piezas + cubo: tabla antes → después.
- [ ] el trazado del agua evita los barrenos móviles con ≥ ½·D de acero; 0 cruces en las 4 piezas; el enfriamiento no empeora (lente
      de enfriamiento / ΔT del circuito antes → después).
- [ ] captura en la app (molde cerrado, planta, solo agua + retornos) antes → después de la caja grande. Juzgada con los ojos.
- [ ] cubo verde (o ACTA R94 con la lista), tsc sin nuevos, orden-gate VERDE.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-interlocks.ts
- scripts/ciclo-dado-test.cjs
- ordenes/2026-10-06-el-agua-no-cruza-los-retornos.md

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- src/cinematic/CinematicMolecule.tsx
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- public/comando/growth.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- tabla línea×barreno por pieza (eje a eje, acero que queda, mínimo) antes → después; caja grande 4 cruces → 0.
- captura antes/después (planta, agua + retornos), ciclo-dado-test, tsc, orden-gate.

## ENMIENDA 2026-10-06 a — el cubo también cruzaba (ACTA R94)
- MEDIDO (node, analítico eje↔eje): en el CUBO la línea del baffle (x = 98) pasa a 7.00 mm de los 4 retornos (91/105):
  −2.24 mm de acero, cuatro cruces que el juez ya listaba en rojo. Arreglarlo cambia literales del ciclo del dado →
  entra `scripts/ciclo-dado-test.cjs` (ACTA R94: check nuevo «el agua no cruza los retornos», el juez de 8 → 10 categorías,
  y A-239 mide el carril del baffle que dice el circuito, no un `x = eje` clavado).

## ENMIENDA 2026-10-06 b — TODO barreno que lleva algo adentro (mensaje del coordinador)
- El Foco del molde (coordinador) midió por cuerpo que el agua TAMBIÉN atraviesa INTERLOCKS (caja grande: cruce-lejos-2 a
  8.50 mm del interlock 3, se meten 7.37; tapa: 2 interlocks −5.20/−1.20, 1.03 junto al interlock 2) y queda corta junto a
  GUÍAS (tapa 2.68 < 3.17). Los interlocks no viven en `standardHoles` y las guías se saltaban como «placa».
- Se amplía el arreglo a retornos · interlocks · guías/bujes · tornillos · KO · pines, ≥ ½·D de acero, por cuerpo.
- Entra `src/forja/mold/mold-interlocks.ts`: a media pared los 4 interlocks caían EXACTO sobre el eje del macho, que es el
  carril de la línea del BAFFLE (no se puede correr, §9.3.5.2) — eje↔eje 0.00 en carcasa y ensamble. El interlock se corre
  por su costado (como ya hacía con la tornillería) hasta dejar ½⌀ de acero contra ese carril.


## CIERRE (2026-10-06 · MEDIDO, no contado)

**La causa en el flujo de datos.** El trazado del agua SÍ veía los retornos; lo cegaban tres cosas:
1. Con la pieza soltada, `standardHoles` le daba al agua el campo de pines del PAQUETE (36 pines ⌀12 en 1599HBK) — pines que
   no existen en el molde de la pieza (los reales los pone la E7 después y se mueven ellos fuera del agua). El fantasma de x=114
   cerraba la única ventana junto al retorno, y la otra quedaba a 17.8 mm, fuera de la búsqueda de W/3 = 16.9.
2. Sin hueco, la línea se quedaba en su x NOMINAL — encima del retorno — en silencio.
3. Interlocks (`planInterlocks`) y guías/bujes no entraban a la lista de barrenos; y los 4 interlocks se colocaban EXACTO sobre
   el eje del macho, que es el carril de la línea del baffle (que no se puede correr, §9.3.5.2).

**El arreglo (para toda pieza).** En `estacion8Circuito`: el agua de la pieza no esquiva ni juzga pines fantasma; los barrenos que
NO se mueven (retornos · interlocks macho/hembra · guías con hombro/buje/brida · tornillos · KO · colada) mandan sobre los pines
(el pin cede, como ya hace la E7); la línea del baffle no se corre; si una orientación no tiene lugar se prueba la serpentina
girada 90°; si ninguna, se dice «NO HAY LUGAR». Las extensiones del anillo A salen del punto de su costado que libra; el anillo A se
juzga por su barreno completo (de la cara del inserto, donde van sus tapones) y se cierra lo mínimo si hace falta. En
`planInterlocks`: el interlock se corre por su costado hasta dejar ½⌀ contra el carril del baffle. El juez del agua pasa de 8 a 10
categorías (+ interlock, guía).

**Números (analítico eje↔eje por cuerpo, node · `el-plan-dev4/agua/{antes,despues}/*.json`). Pares que dejan < ½⌀ = 3.17 mm:**
| pieza | antes: rojos (cruces) · peor | después: rojos · peor por categoría |
|---|---|---|
| caja grande 1599HBK | 5 (5): retornos −3.84 ×4 (eje 5.40), interlock 3 −7.37 | 0 · retorno 3.66 · interlock 3.63 · guía 3.92 |
| carcasa 1594C Box | 6 (2): interlocks −11.11 ×2 (eje 0.00), guías 1.32/2.88 | 0 · guía 3.32 · tornillo 3.42 · interlock 3.49 |
| tapa 1594C Lid | 8 (5): interlocks −5.20/−1.20 ×2, 1.03; buje −1.88 ×2, 2.18 | 0 · guía 3.18 · retorno 3.21 · interlock 3.30 |
| ensamble 1557BGY | 4 (4): interlocks −15.88 ×2 (eje 0.00), −9.88 ×2 | 0 · interlock 3.63 · retorno 4.76 |
| cubo | 16: guía hombro −13.18, interlocks −11.11 ×2, retornos −2.24 ×4… | 4: retornos −2.24 ×4 (eje 7.00) — NO HAY LUGAR, el circuito lo declara |
- Pines (regla de la E10, `claroPinAgua`): 0 conflictos en las 4 piezas antes y después (mín 8.19 / 6.17 / 3.20 / 6.57).
- KO: no comparte franja de z con ninguna línea (vive en soporte/bottom): 0 pares.
- El juez del agua en la app: rojos fantasma de pines del paquete (carcasa 10 × −2.24, ensamble 7 × −0.24) → 0; juez VERDE en las 4.
- **Enfriamiento no empeora**: t_c y ΔT idénticos (1599HBK 12.8/93.1 s, ΔT 0.967 °C; tapa 31.6/66.2 s, ΔT 0.293). El paso real
  entre líneas MEJORA: caja grande 62.8 → 50.8 mm (Eq 9.24 pide < 2H = 50.8: antes la violaba), tapa 62.3 → 50.8. Carcasa 58.3 sin
  cambio (ya estaba así por la tornillería; visto). Costo: la tapa cierra su anillo A 8.5 mm por lado (aire 1.5 en vez de 10).

**En la app real** (dev4, GPU `ANGLE D3D12 RTX 4070 Ti`, sin errores WebGL, `moldSolidCollisions` agua↔retornos/interlocks/guías/bujes):
- caja grande: eje↔eje 5.31/5.40 → 12.81/12.90 (acero 3.58/3.66); colisiones 597.1 (interlock) + 301.6 + 282.7 mm³ → **0**.
- tapa: colisiones interlock 301.2 + 59.3, bujes 193.5 + 59.5 + 51 + 33.8 mm³ → **0**.
- capturas 3840×2160 (planta, molde cerrado, agua + retornos + interlocks + guías): `el-plan-dev4/agua/app/planta-{antes,despues}-{caja,tapa}.png`
  (copia en Downloads/inspeccion-del-molde/agua-no-cruza/). Juzgadas a ojo: antes las líneas B-0/B-4 pasan por dentro de los 4 retornos
  rojos y la línea central de la tapa pasa por los interlocks amarillos; después los retornos quedan entre líneas y los interlocks fuera del eje.

**ACTA R94** (ciclo del dado, 266 → 267 checks, 267/267):
- NUEVO «E8b · EL AGUA NO CRUZA LOS RETORNOS»: o libra cada retorno con ½⌀ por cuerpo, o el circuito declara NO HAY LUGAR y el juez lista cada rojo
  (el cubo: lo segundo; 4 rojos −2.24).
- «E8b · EL JUEZ DEL AGUA»: 8 → 10 categorías (+ interlock, guía).
- «E10 · A-239 AL REVÉS»: «cero pines sobre x=eje» → «cero pines sobre el carril del baffle que dice el circuito» (x o y).
- E10 del cubo: el patrón de pines de medio-lado se transpone si el circuito gira (hoy no gira: mismo patrón de siempre).

**Pruebas**: cubo 267/267 · `mold-interlocks-test` verde · `import-cycles-test` cero ciclos · tsc sin errores nuevos (el único extra,
`src/comando/Logos.tsx` JSX, viene de main, no de esta orden) · orden-gate VERDE.

**Visto, de otra orden**: la lámina/plano dibuja su propio circuito (`coolingCircuit` de mold-drawing-set) — no se revisó contra los
barrenos aquí. La carcasa conserva paso 58.3 > 2H por la tornillería.

**Archivos tocados**: src/forja/mold/estudio-molde-datos.ts · src/forja/mold/mold-interlocks.ts · scripts/ciclo-dado-test.cjs · esta orden.

**Preguntas para ian**
1. *El cubo no tiene lugar para su agua.* La línea que alimenta el enfriador del macho tiene que pasar por el centro, y en la base de
   196 mm los dos pines que regresan la placa están a 7 mm de ese centro, uno de cada lado: el barreno de agua se mete 2.2 mm en ellos
   (fuga). Girando el circuito, choca con el hombro de las guías (3.2 mm). Hoy el molde lo dice en rojo. ¿Qué movemos? Recomiendo
   **separar los retornos del centro** (hoy 14 mm entre ellos; con 26 mm la línea pasa con su acero) — es el arreglo más chico.
2. *La tapa cierra su anillo de agua de arriba.* Para no tocar el buje de la guía de la esquina, el anillo pasa a 1.5 mm de la
   orilla de la pieza en vez de 10. Sigue arriba de la pieza (no la toca) y el acero junto al buje queda en 3.18 contra 3.17: pasa
   de panzazo. ¿Lo aceptas o preferimos mover esa guía? Recomiendo aceptarlo y medir el enfriamiento de la orilla cuando exista la lente.
3. *Los interlocks se corrieron.* Los 4 centradores estaban justo en el eje por donde corre el agua del centro; ahora se corren ~20 mm
   por su costado (como ya hacían con los tornillos). ¿Te parece bien que el centrador ceda ante el agua? Recomiendo que sí: el libro
   solo pide que vayan en la partición pegados al inserto.
