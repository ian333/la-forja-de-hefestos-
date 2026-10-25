# ORDEN: EL REPARTO DE LA SEMANA 1 — La Forja vendible (superticket coordinador)

ESTADO: hoy
PRIORIDAD: 1

BASE: 4373705

OBJETIVO: ian (2026-10-24), tras el debate de 25 expertos (Downloads/la-pelicula/debate-25-expertos/00-PLAN.md): «la planta que
compra moldes… quiero que haya una IA con Fable revisando… usemos iangpu, pero bajemos dinero que es lo importante… el 4 se los dejo a
los agentes… tenemos capacidad de desarrollo, falta coordinación y QA real, eso es trabajo de los agentes… el 5 me gusta, es la
nuestra». Este superticket reparte la SEMANA 1 del plan en seis órdenes paralelas; el coordinador (esta sesión) fusiona, verifica con
los ojos y despliega una vez.

## LAS SEIS ÓRDENES (una por agente Opus, cada uno en su worktree y su copia de iangpu)
| Orden | Qué | Copia iangpu · puerto | Archivos (región) |
|---|---|---|---|
| A · los apagones | lo que un ingeniero desmiente en 10 min sale de la pantalla y del papel | forja-dev4 · 5195 | FocoMolde3D.tsx, inspeccion-recorrido.ts, expediente.ts, mold-drawings.ts, foco-lentes.ts, mold-drawing-set.ts (clave QC-7), ForgeBRepStudio.tsx (hoja de análisis, expediente, tarjeta de enfriamiento), useMoldStudio.ts (solo L561 y L1425) |
| B · la presión de empaque | p_pack 50 MPa editable alimenta clamp, placa, pilares y expulsión; los artefactos del dictamen mueren | forja-dev5 · 5196 | moldmachine.ts, mold-contratos.ts, shrinkage.ts, revisar-modelo.ts, platesizing.ts, useMoldStudio.ts (intake, ~L612), MoldPanels.tsx (campo del intake, ~L590-610) |
| C · la puerta que dice NO | matrícula al soltar, cuerpos, unidades y contrasalidas: si no se puede, se dice antes del molde y del precio | forja-dev6 · 5197 | ForgeBRepStudio.tsx (abrirArchivo ~L5220 y el aviso de entrada), stl.ts, matricula.ts, ejectortypes.ts, dfm-mesh.ts, piel-futuro.ts (rp-error visible), MoldPanels.tsx (rótulo con-mecanismos ~L412) |
| D · el QA real | gate de determinismo + banco nocturno EN EL NAVEGADOR con piezas rotas a propósito y números dorados | forja-dev7 · 5198 | solo scripts/ y test-parts/rotos/ (CREA) |
| E · el revisor | una IA (Fable) que revisa cada expediente con rúbrica y deja su revisión firmada como «revisor automático»; corre con un comando y la puede llevar otra sesión | forja-dev3 · preview 4199 | solo .claude/skills/revisor-forja/ y scripts/revisor/ (CREA) |
| F · el ataque | cómo llegar a las plantas que compran moldes: cuentas, mensaje, demo, precios, contrato de piloto | — | nada del repo (entrega en Downloads/la-forja-ataque/) |

## RIESGOS DE FUSIÓN (declarados)
- ForgeBRepStudio.tsx: A (hoja de análisis ~L4070, expediente ~L10040-10060, tarjeta del enfriamiento) y C (abrirArchivo ~L5220): regiones
  distintas. MoldPanels.tsx: B (~L590-610) y C (~L412): distintas. useMoldStudio.ts: A (L561, L1425) y B (~L612): distintas.
- D graba sus números dorados contra main de hoy; al fusionar B esos números CAMBIAN a propósito (clamp 2.3 % → ~24 %): el gate de D
  debe salir ROJO justo ahí y el coordinador los re-graba con la razón. Esa es la prueba de que el gate muerde.
- Orden de fusión: D → A → C → B → E (el QA primero, para que mida a los demás).

## SEMANA 2 (no se lanza hoy; depende de B)
- G · LOS DATOS DE TU PLANTA (ian: «descarga y configura todos sus datos»): tarifa en MXN por centro, máquinas, resina con su ficha y la
  boquilla — capturados una vez por planta y usados por UN motor (costo de referencia, tonelaje, contracción).
- H · UN VEREDICTO: el dictamen re-corrido sobre el agua de la estación 6, dos columnas «tu pieza sola / en el acero».

## TOCA
- (nada: este superticket solo coordina; las órdenes A–F declaran lo suyo)

## CREA
- ordenes/2026-10-24-a-los-apagones.md
- ordenes/2026-10-24-b-la-presion-de-empaque.md
- ordenes/2026-10-24-c-la-puerta-que-dice-no.md
- ordenes/2026-10-24-d-el-qa-real.md
- ordenes/2026-10-24-e-el-revisor.md
- ordenes/2026-10-24-f-el-ataque.md

## BORRA
- (nada)

## PREEXISTENTE
(sucios de otras sesiones en el árbol principal al crear el reparto; los worktrees nacen limpios)
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/growth.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- scripts/captions-pendientes.py
- scripts/comentarios.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/guiones/hielof.txt
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
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
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA
- cada orden cierra con su gate VERDE en su worktree, su captura 4K juzgada y su número;
- tras la fusión: tsc sin errores nuevos, el camino de la carcasa en la app, la película refilmada sin los rótulos apagados, y producción
  verificada con temis-deploy.json + el bundle servido.

## CIERRE (se llena al terminar)
