# Escuela de Mecánica — CÁPSULAS REPRODUCIBLES

> **Regla del proyecto:** cada clase es un DATO, no un video irrecuperable.
> El `.json` guarda TODO — cada click, cada gesto, cada frase de narración.
> El día que cambiemos la interfaz, se regraba con un comando. Nada se borra.

## Qué se guarda (todo versionado en git)

| Qué | Dónde | Contiene |
|---|---|---|
| **La receta de la clase** | `public/escuela/lecciones/<id>.json` | pasos = `dice` (narración) + `gestos` (clicks/teclas/cotas exactas) + `check` (invariante del kernel que la valida) |
| **El guion de voz** | `scripts/guiones/<id>.txt` | una frase por línea (se regenera del JSON con `gen-guion.cjs`) |
| **Piezas de biblioteca** | `public/escuela/biblioteca/<n>.json` | docs del kernel que insertan las lecciones de ensamble (U5) |
| **El motor de grabado** | `scripts/escuela/` | `clase-drive.cjs` (maneja La Forja + graba), `ensamblar-clase.cjs` (voz+video→4K), `parrilla.sh` (lote resumable), `gen-guion.cjs` |
| **Piezas del examen 11-34** | `scripts/recio/p1134-prep.cjs` | regenera la biblioteca de ensamble por si se pierde |

**NO versionado (regenerable):** `dist-video/` (WAVs de voz + MP4 4K) está en `.gitignore`.
Los masters entregados viven en Downloads de las 2 PCs; se **regeneran** del JSON+scripts cuando
haga falta (la voz XTTS es determinista en iangpu; el render es un comando).

## Regrabar una clase (p.ej. tras cambiar la interfaz)

En iangpu, con el vite dev vivo en `:5001`:

```bash
# una lección (voz-si-falta → drive 3 intentos → 4K → Downloads):
bash scripts/escuela/parrilla.sh mec-u1-l1

# la biblioteca de ensamble, si se perdió:
node scripts/recio/p1134-prep.cjs      # regenera public/escuela/biblioteca/1134-*.json
```

Si la interfaz movió un botón, se edita SOLO el `testid` en el JSON de la lección —
la narración y la estructura no se tocan. Por eso el video no es el entregable: **el JSON lo es.**

## Estado (2026-07-06): 22 lecciones grabadas

U1(3) · U2(5: l1,l2,l4,l5†,l6) · U3(7) · U4(2) · U5(1: primer ensamble) · U9(1) · U10(2) · U11(1)
— †U2L5 (flat-D) aparcada por brecha del extractor de trim; ver `docs/forja-research/bethune/LO-RECIO.md`.
