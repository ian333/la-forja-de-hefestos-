# ORDEN: La libreta de Don Chuy — la página donde aterriza el embudo

> ian, 2026-09-21: «prepara todo por favor, pero necesitamos hacer el funnel primero,
> quiero que pienses en toda la experiencia del usuario». Presente y ordenando; la orden
> existe porque el censo de html/vite sube y el gate es mecánico.

BASE: ae41a29
CENSO-PERMITE: html +1
CENSO-PERMITE: vite +1

OBJETIVO: `chuy.html?c=<capítulo>&s=<sid>` abre DENTRO del navegador de Instagram en < 1 s con
el puesto de Don Chuy dibujado y la cuenta del capítulo del que viene la persona, con los
números editables («¿Y en tu negocio?») y una libreta de fiados/gastos/merma que vive en el
teléfono sin login. Al final, el escalón a Hermes (prueba gratis) sin precio ni pitch.
Telemetría por capítulo y por sesión del DM. NO se despliega a ATLAS sin autorización.

## YA-EXISTE (prueba de ausencia)
- `premio.html` + `src/economia/PremioPage.tsx`: hub por Nobel (gancho → lab → usos). Es el
  destino de los capítulos Nobel, no la libreta: pesa, no abre con la cuenta del video.
- `econ-lab.html` + `src/econ-lab/registry.ts`: sandbox de simuladores 2D por tema. Un lab
  «libreta» ahí cargaría el EconLab entero dentro de Instagram; y la libreta no es un lab.
- `src/lib/telemetry.ts`: `telemetry.install()/event()/seccion()` — se REUSA, no se crea otra.
- Dibujos del puesto: `lia-video-engine/render/src/dibujos/naranjas.tsx` (Remotion). Se copian
  a `src/chuy/dibujos/` cambiando las fuentes de @remotion/google-fonts por CSS.
- `grep -rli "libreta\|fiado\|calculadora" src` → nada que sea una libreta de negocio.

## TOCA
- vite.config.ts
- scripts/subir-instagram.py

## CREA
- chuy.html
- src/chuy-main.tsx
- src/chuy/LibretaChuy.tsx
- src/chuy/capitulos.ts
- src/chuy/dibujos/naranjas.tsx
- scripts/dm-libreta.py
- scripts/embudo-libreta.json
- docs/EL-EMBUDO-DE-DON-CHUY.md
- videos/econ-descuento.json
- videos/econ-lata.json
- videos/econ-merma.json
- videos/econ-precio.json
- videos/econ-yunus.json
- videos/econ-anotar.json

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- src/cinematic/CinematicMolecule.tsx
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
- ordenes/2026-09-21-la-libreta-de-don-chuy.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` verde con esta orden.
- Capturas a 390×844 (Playwright en iangpu contra forja-dev2 :5194) de `chuy.html?c=00..06`:
  el puesto y la lata visibles arriba del pliegue, sin scroll horizontal, sin texto cortado.
- Cambiar un número mueve la lata; anotar un fiado sobrevive a recargar la página.
- `npx vite build` compila en iangpu.
- censo esperado: html +1, vite +1, canvas igual.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico en archivos. Desviación: el formato de las listas de la orden
  (paréntesis en TOCA, seis rutas en una línea en CREA, letras de git status en PREEXISTENTE)
  ponía el gate en rojo sin culpa de nadie; se corrigió el formato sin cambiar lo declarado.
- números: ORDEN_GATE VERDE (html 46→47 +1 permitido, vite 41→42 +1 permitido, canvas 8→8);
  QC_CHUY VERDE (390×844: sin scroll horizontal, botones ≥48 px, número mueve la pastilla,
  dos fiados sobreviven a recargar); `npx vite build` en iangpu compila (entry 23.7 KB, sin CSS
  global); 32 capturas en Downloads/chuy-landing. NO desplegado a ATLAS (espera autorización).
