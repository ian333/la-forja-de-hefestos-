# La Forja — Tutoriales (generados operando la app, NO programando)

**Método:** cada tutorial se "grabó" **manejando el Part Studio real** con comandos
(`window.__forgeBrep`) y clics (Playwright) en iangpu (GPU real). Correrlos:
1. **Genera telemetría real** que aterriza en el servidor (`telemetry-service`):
   clics auto-capturados + `forja.fea_live` / `forja.generative` + `pageview`/`webgl`.
2. Captura un **screenshot por paso** (`forja-shots/tutoriales/<id>/NN-*.png`).
3. Emite **`forja-shots/tutoriales/manifest.json`** (pasos como DATOS → puede
   alimentar `TutorialesPortal` sin tocar código de la app).

Driver: `scripts/forja-tutoriales.cjs` (currícula = datos; el "cómo" = comandos/clics).
Correr: `bash scripts/forja-run.sh env URL=…/forja-brep.html TELEMETRY_URL=http://localhost:8002/events DISPLAY=:0 node scripts/forja-tutoriales.cjs`.

**Última corrida (2026-06-23):** 8 tutoriales · 21 pasos · **0 errores de página** ·
**65 eventos de telemetría** recolectados en el servidor.

> **Hallazgo de la telemetría** (lo que es PARA esto): se capturaron **66×**
> `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated` — la app dispara ese
> warning en cada render. Es ruido + un detalle de three.js a limpiar. NO lo arreglé
> (esta sesión: prohibido programar) — queda reportado para que decidas.

---

## La currícula (8 tutoriales)

### T1 · Tu primera pieza: placa con barrenos
El ritual CAD completo: croquis → extruir → barreno → redondeo → leer la masa.
*Aplicación:* soportes, bridas, placas de montaje — el 80% de las piezas de un taller.
1. Placa base (croquis rectángulo extruido). · `t1-placa/01-placa-base.png`
2. ◎ Hole: el volumen baja (se quitó material). · `02-barreno.png`
3. ◜ Fillet → clic en la arista de la lista. · `03-fillet.png`
4. Lee masa/volumen/centro de masa (exacto, del kernel). · `04-analisis.png`

### T2 · ¿Aguanta? Análisis de esfuerzos (FEA) en vivo
Fijar una cara, cargar la opuesta, ver von Mises + factor de seguridad. *El diferenciador.*
*Aplicación:* saber si la pieza se rompe ANTES de fabricarla. → emite `forja.fea_live`.
1. Pieza base. · `t2-fea/01-fea-pieza.png`
2. Empotra abajo, carga 500 N arriba, resuelve K·u=f → campo de color. · `02-fea-vonmises.png`
3. Sube a 900 N en vivo (warm-start): recalcula al instante. · `03-fea-900N.png`

### T3 · Menos material, misma fuerza: diseño generativo
Optimización topológica (SIMP): quita material donde no trabaja. *Gratis aquí, premium en Fusion.*
*Aplicación:* piezas ligeras impresas en 3D. → emite `forja.generative`.
1. Define el caso de carga (cara fija + carga). · `t3-generativo/01-gen-caso.png`
2. Fracción 40% y ¡optimiza! El sólido se vuelve orgánico. · `02-generativo.png`

### T4 · Pieza de revolución: flecha escalonada
Revolucionar un perfil 2D alrededor de un eje → sólidos de rotación exactos.
*Aplicación:* flechas, poleas, bridas, boquillas.
1. Croquis a perfil de escalones (radio–longitud). · `t4-revolve/01-rev-perfil.png`
2. ⟳ Revolve 360°. · `02-revolve.png`

### T5 · Embudo por Loft: piel entre perfiles
Interpolar un sólido entre el perfil base y una copia escalada (tronco/cono).
*Aplicación:* embudos, tolvas, salidas de molde, transiciones.
1. Pieza base. · `t5-loft/01-loft-base.png`
2. ◈ Loft: piel entre el perfil y una copia al 50% en altura. · `02-loft.png`

### T6 · Tubo y resorte por Sweep: barrer por una trayectoria
Barrer el perfil por un codo (esquina redondeada real) o una hélice (resorte).
*Aplicación:* tuberías, ductos, resortes, manijas.
1. Pieza base. · `t6-sweep/01-sweep-base.png`
2. ↝ Sweep: el perfil barre un codo. · `02-sweep-codo.png`
3. Trayectoria → Hélice: un resorte (auto-dimensionado, siempre válido). · `03-sweep-resorte.png`

### T7 · Engrane real de involuta
Engrane paramétrico (módulo, dientes, ángulo) y export a STL.
*Aplicación:* reductores, cajas, mecanismos impresos.
1. ⚙ Engrane de involuta. · `t7-engrane/01-engrane.png`
2. Exporta a STL (cierra el ciclo diseño→fábrica). · `02-engrane-stl.png`

### T8 · Del diseño al taller: plano 2D + STL
Plano de taller (3 vistas con líneas ocultas reales) + export STL.
*Aplicación:* la documentación que el taller necesita para fabricar.
1. Pieza con barreno. · `t8-plano/01-plano-pieza.png`
2. Plano: 3 vistas ortográficas + cotas + cajetín. · `02-plano.png`

---

*Las personas/aplicaciones se afinan con la investigación de mercado
(`INVESTIGACION-CAD-LATAM.md`, en proceso): a quién enseña cada tutorial y por qué
importa para el adoptante LATAM.*
