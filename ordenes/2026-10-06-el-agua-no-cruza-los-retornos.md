# ORDEN: EL AGUA NO CRUZA LOS RETORNOS — ninguna línea de agua atraviesa un barreno móvil, y el circuito lo sabe al trazarse

ESTADO: hoy
PRIORIDAD: 1

BASE: abcadec

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
- (el agente declara el resto por ENMIENDA)

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
