# MOTOR DE PARTÍCULAS FÍSICAS — vía Operador Ian (cara-i) + Lagrangiano

> **El hito de 2026-06-03.** Un motor REUSABLE para graficar fenómenos astrofísicos
> formados desde la FÍSICA (no `noise()`), domando la exponencial con el **Operador Ian**:
> resolver cada operador lineal en su **CARA DIAGONAL** (Fourier / cara-i). Lo que parecía
> supercomputadora (turbulencia MHD, auto-gravedad) corre en **segundos**. Primera aplicación
> real del operador a un sim físico — y FUNCIONA. Validado: incompresibilidad ∇·v = 2e-13 (exacto).

## La idea (de los papers del operador, `neuron_asm/RIAN/papers/operador_ian/`)
- **Todo es Λ(z)=eᶻ evaluado distinto.** Cada operador lineal de la física (difusión, ondas,
  Schrödinger, GRAVEDAD/Poisson) es DIAGONAL en una cara (eigenbase = Fourier para los
  invariantes de traslación). Ahí evolucionar es un cociente por modo → O(N log N), exacto.
- **El error es fingir con ruido.** Las formas son la FUERZA; la nitidez es la CONCENTRACIÓN
  real de materia (compresión). Ver `[[feedback_formar_desde_fisica]]`.

## El pipeline (reusable para CUALQUIER fluido/gas/turbulencia)
1. **Sim en Python** (`scripts/`): generar el campo (turbulento/gravitatorio) en la **cara-i**
   (FFT, diagonal) + advectar **PARTÍCULAS lagrangianas** (sin difusión → nitidez de navaja).
   Salida `.bin` float32 `[x,y,z,bright]` (bright = densidad local = compresión).
2. `cp <sim>.bin public/<name>.bin` → `vite build` (lo sirve en `/<name>.bin`).
3. **Render R3F** (componente de partículas): carga el `.bin`, colorea por FÍSICA (T∝r^−¾
   Planck, beaming Doppler δ⁴, sincrotrón azul / líneas Hα-OIII), aditivo + bloom.
4. **4K + cine**: `render-bh-comercial.cjs` (necesita `beats[]` en el hook) → grade DaVinci 10-bit;
   ensamble música etérea (`musica-eterea.py`→fluidsynth) + outro GAIA (ver assemble_*.sh en ~/).

## Scripts (en `scripts/`)
| Script | Qué hace | Estado |
|---|---|---|
| `turbulent-nebula-sim.py` | turbulencia Kolmogorov div-free (cara-i) + advección lagrangiana → nebulosa filamentosa | ✅ **el bueno** (v7: `192³ 5M 44`) |
| `selfgrav-nebula-sim.py` | + AUTO-GRAVEDAD (Particle-Mesh: Poisson `ψ_k=−ρ_k/k²` en cara-i) | ⚠️ exacto pero GG=9 SOBRE-COLAPSA → **balancear** gravedad/turbulencia/expansión |
| `bh-disk-sim.py` | disco acreción: Kepler diferencial + MRI (cara-i) + inspiral | ⚠️ funciona pero disco plano sin lente = feo (el BH necesita el raymarcher) |
| `pulsar-engine.py` | el MOTOR: núcleo NS + toro ecuatorial + jets bipolares (eje 26°) | ✅ (tiende a blanquearse → bajar exposición) |

## Componentes R3F (en `src/cinematic/`)
- `PulsarParticles.tsx` — nube de partículas de la nebulosa (color por radio: sincrotrón→Hα/OIII).
- `PulsarEngine.tsx` — el motor (núcleo+toro+jets, azul-blanco X).
- `PulsarNebula.tsx` — raymarcher volumétrico (glo de sincrotrón suave + starfield de fondo).
- `BHDiskParticles.tsx` + `CinematicBHDisk.tsx` — disco BH de partículas (T+Doppler), sin lente.
- `CinematicPulsar.tsx` — la escena: PulsarNebula (fondo) + PulsarParticles + PulsarEngine + postFX 'pulsar'.

## Estado (2026-06-03)
- **PÚLSAR EN SU NEBULOSA = el hit.** Nebulosa turbulenta lisa (5M) + motor (núcleo+jets) → hermoso.
  Clip 1080 en movimiento HECHO (`PULSAR_nebulosa_movimiento_v7_LISO.mp4`). Render **4K + música**
  quedó a la mitad (beats 0-1 cacheados en `dist-video/.cache/neb4k` → **reanudable desde beat 2**).
- **TDE** (agujero come-estrella): 4K + música + outro HECHO (otra rama, BHDevour raymarcher).
- **BH disco**: el raymarcher (BHRaytraced, "la vara") ya es hermoso con lente; las partículas planas NO.
  El santo grial pendiente: **alimentar la densidad de partículas AL raymarcher** (turbulencia física + lente real).

## Bugs/lecciones recurrentes
- **"Puntos muy blancos"**: el aditivo de millones de partículas satura → BAJAR exposición fuerte
  + color de FÍSICA real (Planck/sincrotrón), nunca blanco plano. (Disco delgado satura más que nebulosa.)
- **Penacho/blowout**: modos de gran escala del flujo arrastran en bloque → `amp[Kmag<2.5]=0` (quitar gran escala).
- **Granulado**: puntos suaves anchos (falloff `exp(-r2*3.2)`) + más partículas → se funden.
- `cd /home/ian/Orkesta/la-forja` SIEMPRE en ssh (o cae en $HOME); usar wrappers `run_*.sh`.
- El hash del cache NO incluye el shader → `rm -rf dist-video/.cache/<x>` al cambiar el render.

## Paper (honesto)
El pseudoespectral es conocido (Orszag 1969; el Cangrejo se simula así) — NO clamar invención.
Lo publicable: el **principio de las CARAS de 𝔄 como lente unificador** (info/transformers/EDPs/MHD) +
demos + validación. Para rigor: integrar Navier-Stokes hacia adelante → cascada Kolmogorov EMERGENTE (−5/3 real, no prescrito).

## Siguiente
1. **Balancear auto-gravedad** (gravedad↔turbulencia↔expansión) → filamentos por gravedad sin colapsar.
2. **Reanudar render 4K** del púlsar (beat 2) + versión CON motor + 4K con música.
3. **Viaje de escalas**: nebulosa (ancha) → corte → corazón/jets → corte → superficie NICER (NSLensed) + faro de Bell.
4. **Grial BH**: turbulencia de partículas → dentro del raymarcher de geodésicas (lente real + textura física).
