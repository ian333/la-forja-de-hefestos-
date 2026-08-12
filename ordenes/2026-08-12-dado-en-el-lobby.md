# ORDEN: EL DADO entra al LOBBY — el ciclo Kazmer como proyecto del nuevo sistema

BASE: 7fcc71a

OBJETIVO: ian, buscando el trabajo en el sitio vivo: *"¿en dónde tengo que darle click a
La Forja? No aparece como proyecto aún, según yo, el nuevo sistema"*. Tiene razón: el
lobby (`ProjectSwitcher`, el que baja del título) lista biblioteca + 3 plantillas
(Flanera, Percha, Cicloidal) — **EL DADO no está**. Hoy solo se llega por el botón
`El DADO` de la barra superior, que nadie que llegue nuevo va a encontrar.

## LO QUE SE CONSTRUYE
- Una plantilla más en `switcherStarters`: **EL DADO — ciclo Kazmer**, tipo `molde`,
  acción `loadDado` (la que ya usa el botón de la barra). Meta honesta: las estaciones
  y el estado (sprue directo Fig 7.2).
- Rebuild + publicación con `publicar-sitio.sh` + verificación EN VIVO de que el lobby
  lo lista y lo abre.

## YA-EXISTE
- `ProjectSwitcher` (solo pinta lo que le den) · `switcherStarters` (la lista) ·
  `loadDado` (ya en el scope del Studio, el botón de la barra lo usa).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- EN VIVO (sitio publicado): el lobby lista "EL DADO — ciclo Kazmer" y al elegirlo carga
  la estación 1 (probado con el arnés, capturado el panel).
- gate ciclo-dado-test 0 fallan (no se toca lógica) · orden-gate VERDE.

## CIERRE (2026-08-12)

- **EN VIVO, verificado con el arnés sobre el sitio publicado**: el lobby lista
  "EL DADO · ciclo Kazmer (molde de inyección)" como PRIMERA plantilla (tarjeta MOLDE,
  meta "E1→E5 · sprue directo Fig 7.2 · alarmas de tubería y balance") y al elegirla
  carga la estación 1 con el botón de la E2 presente. Captura tomada del sitio vivo.
- **bug de la clase `col` cazado ANTES de servir**: `loadDado` no estaba en el
  destructure del Studio (vive en el objeto `mold`) — habría sido otro ReferenceError
  silencioso. El starter usa `mold.loadDado` explícito.
- build 27.9 s (iangpu) · `SITIO_PUBLICADO_OK` · orden-gate VERDE.
- ruta para humanos: `university.gaiaprime.com.mx/forja-brep.html` → clic al TÍTULO del
  documento (esquina superior izquierda) → el lobby baja → tarjeta **EL DADO**.
