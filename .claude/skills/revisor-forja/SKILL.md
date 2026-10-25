---
name: revisor-forja
description: EL REVISOR de La Forja — antes de entregar un expediente a una planta, corre el camino de 9 pasos sobre el STEP del cliente en iangpu (stills 4K, números de la máquina, el expediente descargado, folio) y lanza UN subagente Fable que lo juzga con scripts/revisor/RUBRICA.md, escribe REVISION.md con veredicto «SE ENTREGA / SE ENTREGA CON NOTAS / SE DETIENE» y queda firmado como revisor automático. Usar cuando pidan «/revisor-forja <ruta.stp> [intake]», «revisa este expediente/esta pieza antes de mandarla», o antes de mandar CUALQUIER expediente a un cliente.
---

# /revisor-forja `<ruta.stp>` `[material=ABS volumen=100000 maquina="FCS HT-150SV"]` `[--commit <sha>]`

Orden 2026-10-24-e-el-revisor. ian: «quiero que haya una IA con Fable revisando… debería quedar funcionando para que un hermano
tuyo la lleve». El revisor es el **control de calidad**: ningún expediente sale sin su revisión, pero **no aprueba la
fabricación** (la aprueba el fabricante del molde). Manual humano: `scripts/revisor/LEEME.md`. Rúbrica: `scripts/revisor/RUBRICA.md`.

**Dónde corre cada cosa**: esta skill corre en la sesión de Claude Code de la LAPTOP (en iangpu no hay `claude`). iangpu captura
(GPU real, build de producción); Fable juzga aquí. Todo lo de iangpu va por `ssh ian@100.65.173.85` (alias `iangpu` abajo).
Tiempos MEDIDOS el 2026-10-24 con la 1594C Box (3 corridas): captura 4.3–4.8 min (+ la fila del GPU: una vez esperó 10 min detrás
de otras órdenes) · revisión Fable 12.3 min (18 stills 4K + ~3,000 líneas de texto) · verificar y firmar ~1 min · total ≈ 18–30 min.

## Reglas que no se negocian
- La captura va SIEMPRE dentro de `flock /home/ian/el-plan/gpu.lock` (sin `-w`): el GPU es compartido. Una pieza a la vez.
- Nada de `pkill`/`pgrep -f`; nada de builds en la laptop; no se toca `src/` de ninguna copia; no se toca `/home/ian/Orkesta/la-forja`
  en iangpu salvo leer `test-parts/` y usar su `node_modules`.
- El STEP del cliente es secreto industrial: va a `/home/ian/el-plan/revisiones/_entrada/` y a ningún otro lado (no a videos, no a
  agentes que publican). Antes del primer STEP real: orden de servicio + NDA firmados (juez B D7; ver LEEME).
- UN subagente revisor (Fable). Si Fable responde con límite de uso, se relanza con Opus y la firma lo dice.

## 1 · Preparar (laptop, desde el repo `/home/ian/Gaia/la-forja`)
```bash
STP="<ruta.stp>"                                   # en la laptop; si ya vive en iangpu usa SOLO el paso 2b
SHA=$(sha256sum "$STP" | cut -c1-12); NOMBRE=$(basename "$STP")
ssh ian@100.65.173.85 'mkdir -p /home/ian/el-plan/revisiones/_entrada /home/ian/el-plan/revisor/scripts/revisor'
scp "$STP" "ian@100.65.173.85:/home/ian/el-plan/revisiones/_entrada/$SHA-$NOMBRE"
REMOTO="/home/ian/el-plan/revisiones/_entrada/$SHA-$NOMBRE"
# los scripts SIEMPRE del repo de hoy (el motor de manejo es forja-drive.cjs, el mismo del runner del camino)
rsync -a scripts/forja-drive.cjs ian@100.65.173.85:/home/ian/el-plan/revisor/scripts/
rsync -a scripts/revisor/captura.cjs ian@100.65.173.85:/home/ian/el-plan/revisor/scripts/revisor/
ssh ian@100.65.173.85 'cd /home/ian/el-plan/revisor && NODE_PATH=/home/ian/Orkesta/la-forja/node_modules node scripts/revisor/captura.cjs --seco | tail -3'
```
(2b) Si el STEP ya está en iangpu (ej. `test-parts/`): `REMOTO="/home/ian/Orkesta/la-forja/test-parts/inyeccion-reales/1594C Box.stp"`.

**El intake** se pasa como JSON: `INTAKE='{"material":"ABS","volumenAnual":100000,"maquina":"FCS HT-150SV"}'`. Hoy el camino de la
app NO tiene entrada de material/volumen/máquina (solo existe en la E1 del curso): la captura lo GUARDA y el revisor compara lo
declarado contra lo que la app usó (renglón C6). Sin intake, el revisor dice que se usaron los valores por defecto.

## 2 · La app que se revisa y su commit
La URL por defecto es el build de producción que sirve iangpu: `http://localhost:4199/forja-brep.html` (dist en
`/home/ian/el-plan/dist-dev3`). Si no da 200, levántalo sin tocar el src de esa copia:
```bash
ssh ian@100.65.173.85 'curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4199/forja-brep.html'
ssh ian@100.65.173.85 'cd /home/ian/forja-dev3 && setsid ./node_modules/.bin/vite preview --outDir /home/ian/el-plan/dist-dev3 --port 4199 --host </dev/null >/home/ian/el-plan/preview-4199.log 2>&1 & echo $! > /home/ian/el-plan/preview-4199.pid'
```
**El commit del folio**: el `temis-deploy.json` de ese build es VIEJO (6f70032, 26-ago: se copia de `public/`), y la captura lo
declara «NO VERIFICADO» (renglón A1 ◇). Para verificarlo, mide que el src con el que se construyó sea el de main:
```bash
git rev-parse --short main                                   # el commit candidato
rsync -rcn --delete --out-format='%n' src/ ian@100.65.173.85:/home/ian/forja-dev3/src/ | grep -v '^deleting ' | head
ssh ian@100.65.173.85 'find /home/ian/forja-dev3/src -type f -newer /home/ian/el-plan/dist-dev3/forja-brep.html | head -3'
```
Si las dos salidas quedan VACÍAS (ningún archivo de main difiere y nada del src es más nuevo que el build), pasa `--commit <sha>`.
Si no, revisa con el commit sin verificar (sale ◇ en A1) o pide el build de main al coordinador. Nunca construyas en la laptop.

## 3 · La captura (iangpu, en el turno de GPU; 4.3–4.8 min + la fila; correr en segundo plano y esperar la notificación)
```bash
ssh -o ServerAliveInterval=30 ian@100.65.173.85 "cd /home/ian/el-plan/revisor && timeout 2400 flock /home/ian/el-plan/gpu.lock \
  env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
  URL=http://localhost:4199/forja-brep.html node scripts/revisor/captura.cjs '$REMOTO' --commit <sha> --intake '$INTAKE' \
  < /dev/null > /home/ian/el-plan/revisiones/ultima.log 2>&1; echo RC=\$? >> /home/ian/el-plan/revisiones/ultima.log; tail -25 /home/ian/el-plan/revisiones/ultima.log"
```
Lee el final: `PAQUETE <ruta>` y `RC=`.
- `RC=0` completo → sigue.
- `RC=3` MOLDE_SOSPECHOSO (la E7 no trajo pines: el molde salió de otra pieza) → repite la captura UNA vez; si repite, para y avisa.
- `RC=4` INCOMPLETO (falta un still, el expediente o un paso; `ESTADO.txt` dice cuál) → mira `drive/meta.json` (errores) y `ultima.log`;
  con «Error creating WebGL context» la corrida no vale (GPU ocupado o juegos en el host): repite más tarde.
- `GPU:` en el log debe decir `ANGLE (… NVIDIA GeForce RTX 4070 Ti …)`; SwiftShader/llvmpipe = la corrida no vale.

## 4 · Traer el paquete a los dos PCs
```bash
PAQ="<ruta de PAQUETE>"; FOLIO=$(basename "$PAQ")
mkdir -p "/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO"
rsync -a --exclude 'buzon/' --exclude 'drive/' "ian@100.65.173.85:$PAQ/" "/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO/"
rsync -a "ian@100.65.173.85:$PAQ/drive/meta.json" "/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO/corrida-meta.json"
ssh ian@100.65.173.85 "mkdir -p '/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO' && rsync -a --exclude buzon/ --exclude drive/ '$PAQ/' '/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO/'"
```
NO traigas `_control/` todavía: el revisor no debe poder leer cuál still es la imagen-control.

## 5 · El revisor (UN subagente Fable)
Lanza la herramienta Agent con `subagent_type: "general-purpose"`, `model: "fable"`, descripción «Revisor Fable del expediente»,
y ESTE prompt (sustituye `<DIR>` = `/mnt/c/Users/sebas/Downloads/revisiones/<FOLIO>` y `<REPO>` = `/home/ian/Gaia/la-forja`):

> Eres el REVISOR AUTOMÁTICO de La Forja: el control de calidad de un expediente de molde antes de entregarlo a una planta que
> compra moldes. No apruebas la fabricación (eso lo firma el fabricante del molde); detectas lo que un ingeniero de la planta
> desmentiría en 10 minutos, lo que acusa legalmente, y lo que la pantalla dice pero no se ve. Español mexicano, directo.
> 1. Lee COMPLETA la rúbrica `<REPO>/scripts/revisor/RUBRICA.md`. Es tu ley: sus renglones A1–G3, sus marcas ◆/◇/✓/— y su regla
>    de veredicto, sin excepciones.
> 2. El paquete está en `<DIR>`. Lee `indice.json`, `folio.json` (e `intake.json` si existe). Abre con Read TODOS los stills de
>    `indice.json`, en orden, uno por uno (son 3840×2160; míralos de verdad: qué dice cada tarjeta y si eso se ve en el 3D).
> 3. Lee `textos/*.txt` (incluye `laminas.txt`, `expediente.txt` y `04-dictamen-filas.txt`), `numeros.json` y `hallazgos-texto.json`. El detector solo
>    SEÑALA: confirma o descarta cada señal con el still o con la cita.
> 4. Entre los stills hay al menos una imagen-control con un defecto sembrado; no sabes cuál: juzga cada still igual.
> 5. Escribe `<DIR>/REVISION.md` con EXACTAMENTE el formato de la sección «Lo que escribes» de la rúbrica: VEREDICTO, el conteo,
>    «Por qué», TODOS los renglones A1–G3 con evidencia (still, texto citado con su archivo, o número de numeros.json), la tabla
>    «Still por still» con los 18 stills, las notas para el cliente si aplica, y lo que la revisión no cubre. No escribas firma.
> 6. No modifiques ningún otro archivo. No leas nada fuera de `<DIR>` y de la rúbrica.
> Responde al final con 3 líneas: el veredicto, el conteo ◆/◇/✓/—, y tu identificador de modelo exacto.

Si el Agent responde con límite de uso / modelo no disponible: relanza IGUAL con `model: "opus"` y anota `MODELO_REAL=opus (Fable no
disponible: <mensaje>)` para la firma.

## 6 · Verificar la revisión (mecánico; si algo falla, se tira y se relanza UNA vez)
```bash
D="/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO"
grep -m1 '^VEREDICTO:' "$D/REVISION.md"
for r in A1 A2 A3 A4 A5 B1 B2 B3 B4 B5 B6 B7 B8 B9 B10 B11 B12 C1 C2 C3 C4 C5 C6 D1 D2 D3 D4 E1 F1 F2 F3 G1 G2 G3; do
  grep -qE "^\| *$r *\|" "$D/REVISION.md" || echo "FALTA $r"; done
grep -c '^| *stills/s' "$D/REVISION.md"                                     # deben ser 18
# el veredicto mecánico: algún ◆ en los renglones → SE DETIENE; si no, algún ◇ → CON NOTAS
grep -E '^\| *[A-G][0-9]+ *\|' "$D/REVISION.md" | awk -F'|' '{print $3}' | sort | uniq -c
# AHORA sí: la imagen-control (fuera del paquete hasta este momento)
CTRL=$(ssh ian@100.65.173.85 "cat /home/ian/el-plan/revisiones/_control/$FOLIO.json"); echo "$CTRL"
IMG=$(echo "$CTRL" | python3 -c 'import json,sys; print(json.load(sys.stdin)["imagenControl"])')
grep -F "| $IMG" "$D/REVISION.md"     # su renglón en «Still por still»: debe traer ◆ o ◇
```
- Falta un renglón, no hay 18 stills, o el VEREDICTO no corresponde a las marcas → se tira; relanza el revisor una vez diciéndole qué falló.
- La imagen-control salió con ✓ (sin ◆ ni ◇) → **la revisión se tira** (el revisor no miró): relanza una vez con un subagente nuevo.
  Si la vuelve a aprobar, para y dile a ian: «el revisor aprobó la imagen-control dos veces; no hay revisión válida».

## 7 · Firmar y entregar
Agrega al pie de `REVISION.md` (con el modelo REAL que la escribió y la fecha de HOY en CDMX: `TZ=America/Mexico_City date +%F`;
el nombre de la carpeta de las corridas viejas trae la fecha UTC):
```
---
Revisó: La Forja · revisor automático (Claude Fable 5.1) · <AAAA-MM-DD> · folio <folio de folio.json>
Esto no aprueba la fabricación: la aprueba el fabricante del molde.
Revisión asistida por IA de un expediente en BORRADOR; no es un dictamen pericial ni sustituye la firma de un moldista.
Imagen-control: <still> · <la marcó ◆/◇> · revisión válida.
```
Si fue Opus: `revisor automático (Claude Opus 5.5 — Fable no estuvo disponible: límite de uso)`. Si el revisor reportó un
identificador distinto, se escribe el reportado.
Luego: `echo "$CTRL" > "$D/control-revelado.json"` y copia `REVISION.md` + `control-revelado.json` a iangpu:
`rsync -a "$D/REVISION.md" "$D/control-revelado.json" "ian@100.65.173.85:/mnt/c/Users/sebas/Downloads/revisiones/$FOLIO/"`.

## 8 · Lo que le dices a ian (y nada más)
El folio, el veredicto, los ◆ en una línea cada uno (lo más grave primero, en lenguaje de taller), cuánto tardó, y la ruta
`Downloads/revisiones/<folio>/REVISION.md` (en los dos PCs). Si SE DETIENE, el expediente NO se manda: los ◆ son la lista de lo que
hay que arreglar (cada uno suele ser de una orden: dilo). Nunca digas «aprobado», «certificado», «cumple normas» ni «listo para
fabricar» (ver `scripts/revisor/LEEME.md`, «Qué NO decir»).
