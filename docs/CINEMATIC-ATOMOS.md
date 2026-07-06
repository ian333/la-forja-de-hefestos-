# Cinematic de Átomos — rediseño visual (jun 2026)

> Los videos de elementos eran los de **menos vistas**: no retienen. El audio
> (narración Matilda + subtítulos) ya gusta. Falta que CADA elemento sea una
> **experiencia de cine que clave en 1.5 s** — hermosura, formas reales de
> orbitales, mar de colores, y la física actual hecha visible.

## Diagnóstico del estado previo (stills en iangpu, peek.cjs)

Capturado de Carbono(6), Hierro(26), Oro(79), Uranio(92) en t=2.5 / 12 / 17:

1. **Centro quemado a blanco** — `AdditiveBlending` + densidad |ψ|² alta en el
   centro + `Bloom luminanceThreshold=0.18` (todo brilla) → el núcleo de la nube
   se satura a blanco puro. Mata color y forma. (El usuario: "se satura, se
   pierde la forma").
2. **Sin forma de orbitales** — `breath`(0.018) + `swirl`(0.020) + parpadeo
   cuántico difuminan los lóbulos-p / tréboles-d / formas-f en una bola esférica.
   Las "formas mamalonas" reales existen en `orbitals.ts` (ψ² exacto) pero el
   movimiento las borra.
3. **Confeti, no mar de colores** — additive suma a blanco donde se solapan; en
   átomos pesados una subcapa domina (verde-d en Oro) y el resto es ruido
   multicolor caótico (Uranio = nieve de TV a color). El usuario quiere PUREZA y
   BELLEZA: color = SATURACIÓN, no brillo (ver `feedback_mas_luz_no_es_color`).
4. **Falta física pedida**: campo eléctrico (Coulomb radial), campo magnético
   (dipolo por electrones desapareados / regla de Hund), y señal de
   **radioactividad** visible en los inestables (Tc, Pm, Z≥84, transuránicos).

## Plan

**Ronda 1 — fundamento (saturación · forma · color):**
- Bajar densidad de muestreo y alfa por punto → el additive deja de lavar a blanco.
- Reducir breath/swirl/parpadeo → las formas de orbital quedan NÍTIDAS.
- `Bloom threshold` ↑ (sólo los picos REALES revientan), intensidad ↓.
- Saturación ↑ en color base + balance por subcapa (ninguna domina).
- Hueco nuclear mínimo SIEMPRE → el centro nunca se quema.

**Ronda 2 — capas de física nueva:**
- **Campo eléctrico**: líneas radiales E∝Z/r² desde el núcleo (sutil, vivas).
- **Campo magnético**: bucles dipolares para átomos paramagnéticos (nº de e⁻
  desapareados por Hund); diamagnéticos sin campo neto.
- **Radioactividad**: glow pulsante + emisión de partícula (α núcleo-He para
  pesados, β para otros) en isótopos inestables. Se DEBE sentir que es radioactivo.

**Formato**: 9:16 (2160×3840) y 16:9 (3840×2160) desde el mismo componente
(`vertical` por dimensiones de ventana). Render 4K NVENC 10-bit en iangpu.

## Implementado (Ronda 1 + 2) — verificado en iangpu

**Ronda 1 (saturación · forma · color):** en `CinematicAtom.tsx`
- Muestreo ↓ (`70000/totalElectrons`, cap), alfa/tamaño de punto ↓ → el additive
  ya no lava a blanco; las formas de orbital quedan nítidas.
- `breath`/`swirl` a la mitad + parpadeo con PISO de presencia (0.55) → la forma
  se ve siempre, con vida cuántica encima.
- Color base con saturación ×1.3 + luminancia acotada → mar de colores, no confeti.
- **Atenuación suave del corazón** (`uCoreR`, ∝Z): el core hiperdenso (1s/2s) deja
  de quemar; las capas externas con forma (p,d,f) lucen color.
- Bloom `threshold` 0.18→0.38, sat postFX 0.12→0.24, brillo global ↓.

**Ronda 2 (física visible):** componentes nuevos, gated a la mirada (t≈10.3-15.6),
deterministas en t:
- `ElectricField` — erizo radial de Coulomb (E∝Z/r²), ámbar, pulso saliente. Cap
  de líneas ∝Z para no saturar pesados.
- `MagneticField` — líneas de dipolo real (r=L·sin²θ) SOLO si hay e⁻ desapareados
  (Hund). Cian. **Fuerte en Hierro (4 desapareados) — físicamente correcto.**
- `RadioactiveDecay` + `RadioHalo` — partículas α (verde-lima HDR, estela) +
  anillos de radiación expansivos + tinte verde latiente. Solo Tc, Pm, Z≥84.

**Ambos formatos OK**: 9:16 (1080×1920) y 16:9 (1920×1080) desde el mismo
componente (`vertical` por dimensiones). El dipolo magnético respira mejor en 16:9.

## Gotchas de infra (caros de descubrir)
- **Captura: NO usar `vite preview` ni dev server** para peek/clip — el dev muere
  por `ENOSPC` (file watchers, `.rian_lab100k/brains`) y preview cuelga en
  `networkidle`/muere. **USAR servidor estático:** `python3 -m http.server 8099
  --directory /home/ian/Orkesta/la-forja/dist` tras `vite build`. Sólido.
- `peek.cjs`: `waitUntil:'load'` (no `networkidle`), `W`/`H` por env (16:9 vs 9:16).
- ssh a iangpu: el sandbox DESPOJA `cd X && ...`; usar `cd X 2>/dev/null; ...` o
  rutas absolutas (`node /home/ian/Orkesta/la-forja/scripts/...`).

## Pendiente
- Batch render 4K de los 118 en 9:16 + 16:9 (overnight, NVENC 10-bit) — falta OK
  del usuario para lanzar la parrilla.
- `clip-peek.cjs` (rango [T0,T1]→mp4) para QA de movimiento sin render entero.

## Verificación
`Z=<n> TIMES=2.5,12,17 W=1080 H=1920 BASE_URL=http://localhost:8099 node scripts/peek.cjs`
→ `dist-video/.peek/` → revisar con visión antes de cada 4K. Benchmark: que en
1.5 s se lea forma + color + poder.
