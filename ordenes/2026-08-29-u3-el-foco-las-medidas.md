# ORDEN: U3 · EL FOCO — las medidas encima de la pieza

BASE: 6f07ee2

OBJETIVO: ian, tras la investigación de Horizon Zero Dawn: «tienes toda la maldita razón, el
Foco debe verse futurista… **LO PRIMERO QUE NECESITO DE MI FOCO SON LAS MEDIDAS. Es como si
tuviera los planos pero encima**. Prefiero que se parezca a Horizon Zero Dawn».

LA ARQUITECTURA QUE SALIÓ DE LA INVESTIGACIÓN (dos idiomas, no uno):
- **EL FOCO** — lo que la máquina sabe de TU pieza. Vive SOBRE la geometría, holográfico,
  con la etiqueta pegada al lugar exacto. Es diegético: pertenece a la pieza, no a la ventana.
- **EL BANCO** — el mobiliario del CAD (documento, parámetros, herramientas). Sólido, callado,
  nunca encima de la pieza. Si está vacío, no existe.
En Horizon los dos idiomas se separan POR ESTILO a propósito (holograma vs tiza) para que el
jugador sepa sin pensar cuál es cuál; Detroit aporta la regla de cuándo aparece (HUD limpio,
solo lo necesario). Uno dice DÓNDE, el otro CUÁNDO.

Esta orden construye la PRIMERA capa del Foco: **las medidas**. Al terminar, con tu pieza en el
visor, prendes el Foco y la pieza se enfría a holograma con sus cotas flotando sobre ella:
envolvente (largo × ancho × alto), pared nominal y p95, y —si vino de un STEP— el ⌀ de cada
barreno. El plano, encima.

PALETA DEL FOCO (Horizon: cuerpo frío, lo vulnerable en cálido):
- `#5fd4f5` cian — lo que la máquina MIDIÓ (la cota normal, el cuerpo del holograma)
- `#ffc24b` ámbar — lo que EXIGE tu atención (fuera de la norma del libro)
- `#ff6b6b` rojo — la violación dura (ya existe en las cotas del ciclo, no se toca)
El Banco se queda con su oro `#c9a227` como señal HUMANA (lo que tú decides). Dos idiomas,
dos paletas, y el rojo compartido porque un error es un error en los dos.

## EJERCICIOS
- foco-envolvente · La envolvente acotada sobre la pieza · medidasDeLaPieza + CotaLines · gear.stl → tres cotas 22.0 / 57.0 / 10.0 mm, cada una con sus extremos en la caja real (±0.05 mm)
- foco-pared · La pared se acota donde es más delgada · dfmFromMesh.wall · el nominal y el p95 salen del MISMO dfm que el dictamen (mismo número en el Foco y en el panel)
- foco-barrenos · Un STEP declara el ⌀ de sus barrenos · enumerateFaces cilindros · 1594C Lid.stp lista sus caras cilíndricas con su radio del kernel; un STL DICE que no puede (sin topología)
- foco-encendido · El Foco es un MODO: apagado por defecto, se prende y se apaga · botón + tecla · con el Foco apagado NO hay ni una línea sobre la pieza (la regla de Detroit)
- foco-legible · Las etiquetas no se encinan ni tapan la pieza · reparto + depthTest false · con 6 cotas en pantalla, cero solapes y la pieza ocupa ≥50 % del cuadro
- foco-horizon · Se ve como Horizon, no como un CAD gris · paleta + barrido de escaneo · still 1600×1000: cuerpo cian frío, cotas cian, lo fuera de norma en ámbar

## YA-EXISTE (prueba de ausencia — medido hoy)
- **`src/forja/brep/MoldCotas3D.tsx` es LA MAQUINARIA DEL FOCO y ya está probada en el molde**:
  `CotaLines` dibuja las líneas DENTRO del Canvas con `depthTest:false` (siempre encima),
  `CotaDriver` proyecta cada cota y mueve su div DOM de forma imperativa (0 re-renders por
  frame), `CotaLabels` los pinta. Ya resuelve los dos gotchas del proyecto: nada de
  `drei <Text>` (crashea con EffectComposer) y `localToWorld` para heredar los transforms.
- `Dim3D` (mold-dimensions.ts): id, label, a/b en mm de mundo, value, measured, ok, why.
  Su doctrina ya es la correcta: «una cota que repite el parámetro es decoración; una que
  enfrenta receta vs sólido es un detector».
- `bboxDeMalla` (stl.ts, T1) — la envolvente ya se mide.
- `dfmFromMesh(mesh).wall` — nominal, p95 y ratio ya calculados (los usa el dictamen).
- `enumerateFaces` (occt.ts:692) ya devuelve el RADIO de una cara cilíndrica — el ⌀ de un
  barreno de STEP no hay que inventarlo.
- NO existe: un juego de cotas para una pieza ARBITRARIA (las de hoy son del molde del cubo),
  ni el modo Foco, ni la paleta separada.

## TOCA
- src/forja/brep/MoldCotas3D.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- src/forja/mold/foco-medidas.ts
- public/evidencia/2026-08-29-u3-el-foco-las-medidas/resultados.json
- public/evidencia/2026-08-29-u3-el-foco-las-medidas/01-foco-envolvente-still.jpg
- public/evidencia/2026-08-29-u3-el-foco-las-medidas/02-foco-horizon-still.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones + binarios fuera del repo — NO son míos)
- docs/forja-research/datasheets-fuente-corriente/ACS724-hall-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/ACS758-hall.pdf
- docs/forja-research/datasheets-fuente-corriente/FDH055N15A-mosfet.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4115-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4227-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFP4568-mosfet-backup.pdf
- docs/forja-research/datasheets-fuente-corriente/LRS-1200-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/MBR60100PT-schottky.pdf
- docs/forja-research/datasheets-fuente-corriente/RSP-1000-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/TC4422-gatedriver-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/UCC27614-gatedriver.pdf
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- gate del ciclo VERDE con los checks del Foco (las cotas del gear salen 22.0/57.0/10.0)
- juez con ojos: still del Foco encendido sobre el engrane — se leen las tres medidas
- still del Foco APAGADO: cero líneas sobre la pieza (la regla de Detroit, verificada)
- deploy a producción y verificación contra el bundle servido (ian: «si no está en producción,
  no está»)
- orden-gate VERDE · Temis n/6 · censo canvas IGUAL (las cotas van dentro del Canvas que existe)

## CIERRE (2026-08-29)
**6/6 EN VERDE.** Gate del ciclo **245 → 248 · 0 fallan**.

Prendes EL FOCO y tu pieza **se enfría a holograma** (cian translúcido, opacidad 0.62, doble
cara: se ven los barrenos por dentro) con **sus medidas flotando encima**: `ancho 22.0 mm`,
`largo 57.0 mm`, `alto 10.0 mm`. El plano, puesto sobre el objeto. Apagado, no queda ni una
línea sobre la pieza.

- `foco-medidas.ts` (NUEVO, puro): mide la envolvente y devuelve `Dim3D[]` — el MISMO tipo que
  ya dibuja el molde. Cero geometría nueva, cero canal de render nuevo.
- `MoldCotas3D.tsx`: paleta opcional (`PALETA_FOCO` cian) y modo de etiqueta.
- `ForgeBRepStudio.tsx`: `SolidMesh` aprendió `holograma` (translúcido, emisión fría, doble
  cara) y el modo Foco, apagado por defecto.

**Lo que cazó el juez con ojos en la 1ª corrida (3 defectos):**
1. **La etiqueta decía «ancho 22 = 22 ✓»** — el formato de AUDITORÍA del molde (receta vs
   sólido). Pero la envolvente de tu pieza **no se declaró en ningún lado: se midió**. Escribir
   el número dos veces era exactamente «la decoración» que el propio módulo prohíbe en su
   docstring. Se separó en dos modos: `auditoria` (el molde) y `medida` (el Foco).
2. **La cota del alto caía encima del panel** del Banco: se movió al costado derecho.
3. **La pieza se blanqueaba** con un tint claro en vez de verse holograma. Un tint no es
   translucidez: hubo que darle a `SolidMesh` transparencia real.

Deudas declaradas: el Foco todavía no mide la pared de la pieza cargada (necesita el raster de
espesor — es T2) ni los ⌀ (necesita STEP con caras). Las dos las DICE en pantalla en vez de
inventarlas. Falta el barrido de escaneo (la animación de revelado de Horizon).
