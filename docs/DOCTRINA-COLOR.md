# DOCTRINA DE COLOR — La Forja (técnica, accionable)

> Biblia de color para renders astrofísicos FIELES + ULTRA-BELLOS. Sale de la
> investigación deep-research (104 agentes, 96 claims → 20 verificadas 3-0, fuentes
> NASA/ESA/Chandra/peer-reviewed; ver `docs/color-research.json`). Complemento técnico
> de `docs/FILOSOFIA-CINE.md`. **Dos capas SIEMPRE separadas:**
> **(A) COLOR FÍSICO** = la VERDAD (de Planck/líneas/relatividad). **(B) GRADE** = el
> realce (crush, halación, split-tone) que NO inventa color, solo lo esculpe.
> La belleza EMERGE de A; B la lleva a cine. Lo que no salga de física → ETIQUETAR evocativo.

---

## A1 · CUERPO NEGRO → COLOR (ley de Planck) — la técnica

A T alta el color **NO se vuelve azul cobalto**: la cola **Rayleigh-Jeans** hace que la
cromaticidad CONVERJA a un azul PÁLIDO fijo. El error universal = **max-normalizar el
canal azul** (lo prohíbe la doctrina). **No hace falta integrar Planck contra CIE**
(refutado 0-3): una **tabla T→sRGB con lerp BASTA** (datafile de Mitchell Charity).

**Rampa T→sRGB (anclas, lerp entre ellas):**
| T (K) | sRGB hex | nota |
|------|----------|------|
| 1000 | `#ff3800` | rojo profundo (brasa) |
| 1900 | `#ff8912` | sodio/llama |
| 2700 | `#ff9d5c` | tungsteno cálido |
| 3500 | `#ffc18d` | |
| 4500 | `#ffd9b8` | ámbar pálido |
| 5500 | `#fff3ef` | casi blanco cálido |
| 6500 | `#ffffff` | **D65 — blanco** |
| 8000 | `#e3e9ff` | azul pálido |
| 10000 | `#ccd8ff` | |
| 15000 | `#b7c9ff` | |
| 30000+ | `#a3bbff` → **#94b1ff** | **límite Rayleigh-Jeans (color de estrella de neutrones, CIE xy 0.240,0.234)** |

**Implementación (GLSL):** función `blackbodyRGB(T)` = lerp sobre esta LUT; para T>30000
(plasma, NS a 10⁶ K) **CLAMP a `#94b1ff`** (0.58, 0.69, 1.0) — nunca cobalto. El BRILLO
sí sube con T (∝T⁴), el HUE NO: por eso lo caliente revienta a blanco-azul pálido vía
bloom, no a azul saturado.

**Disco de acreción (Shakura-Sunyaev T∝r^−¾):** cada radio tiene su T → su color por la
rampa. Interior caliente (blanco-azul) → exterior frío (ámbar). El gradiente de color
ES el perfil de temperatura real. Saturación BAJA (~0.05–0.10).

## A2 · ESTRELLAS POR TIPO ESPECTRAL (B-V → T → color) — para starfields y estrellas
| Tipo | T_eff (K) | B-V | hex aprox |
|------|-----------|-----|-----------|
| O | >30000 | <−0.30 | `#9bb0ff` azul |
| B | 10000–30000 | −0.30–0.0 | `#aabfff` |
| A | 7500–10000 | 0.0–0.30 | `#cad7ff` azul-blanco |
| F | 6000–7500 | 0.30–0.58 | `#f8f7ff` blanco |
| G | 5200–6000 | 0.58–0.81 | `#fff4ea` amarillo (Sol) |
| K | 3700–5200 | 0.81–1.40 | `#ffd2a1` naranja |
| M | <3700 | >1.40 | `#ffb56c` rojo-naranja |
Starfield realista = distribución B-V (≈ azul 10% / blanco-amarillo 40% / naranja-rojo 50%),
**magnitud por `pow(rnd,3)`** (pocas brillantes-grandes, mar de tenues). Sat baja.

## A3 · LÍNEAS DE EMISIÓN (nebulosas, supernovas) — narrowband real
Los gases NO emiten cuerpo negro sino LÍNEAS discretas (color REAL de cada línea):
- **Hα 656.3 nm** → rojo profundo (hidrógeno; el rojo dominante de las nebulosas)
- **Hβ 486.1 nm** → cian-azul
- **[O III] 500.7/495.9 nm** → verde-teal
- **[S II] 671.6/673.1 nm** → rojo profundo
- **[N II] 654.8/658.3 nm** → rojo

**Paletas narrowband (ETIQUETAR el mapeo):**
- **SHO / "paleta Hubble"**: [S II]→Rojo, Hα→Verde, [O III]→Azul (el look dorado-cian del Pilares de la Creación).
- **HOO**: Hα→Rojo, [O III]→Verde+Azul (más "natural", cielos cian-rojizos).
Filamentos de remanente de supernova (Cangrejo): Hα/[S II] rojizos + interior sincrotrón azulado.

## A4 · FALSO-COLOR DE TELESCOPIOS (rayos X/gamma/IR/radio/UV NO tienen color)
Convención COMÚN (no ley rígida — ETIQUETAR "falso color"): **orden cromático** λ corta→azul,
media→verde, larga→rojo.
- **Chandra rayos X por banda de energía**: baja `0.3–1.55 keV`→Rojo · media `1.55–3.34`→Verde
  · alta `3.34–10`→Azul. (Corona del disco, jets de quásar, viento/toro de púlsar.)
- **JWST**: casi solo infrarrojo → se mapea el orden de λ a RGB.
- Las agencias dejan el **VOID OSCURO** por fidelidad → **crush de negros** (≈0.14) es lo correcto, no un defecto.

## A5 · RELATIVISTA (discos / NS / chorros) — color que emerge del movimiento
- **Beaming Doppler δ⁴**: el lado que se ACERCA brilla (y azulea), el que se ALEJA se apaga
  (y enrojece). δ = 1/(γ(1−β·n̂)); intensidad ∝ **δ⁴** (bolométrico). Es CINEMÁTICO, no
  térmico, y **se ANULA visto de frente**. → solo se lee de lado.
- **Lente gravitacional**: la forma warpeada/asimétrica (geodésicas). **Un render fiel del
  disco necesita LOS DOS** (beaming + lensing). *Dato:* en Interstellar SOLO el lensing fue
  fiel (Kip Thorne/DNGR, peer-reviewed); **Nolan ATENUÓ el Doppler** → nosotros lo metemos =
  **somos más fieles que la película**.
- **Redshift gravitacional** `√(1−rs/R)`: atenúa y enrojece la luz que sale de pozos profundos (NS/BH).

---

## B · GRADE (DaVinci) — técnicas con valores (esculpir, no inventar)

1. **Lift / Gamma / Gain** (sombras / medios / altas, las 3 ruedas). El control base.
2. **Crush de negros** (curva master): punto negro anclado en 0 + lift del piso a ~`0.14–0.16`
   → el polvo tenue cae a NEGRO PURO. (El morado/lavado lo mete el grade flojo, no la escena:
   prueba frame base vs graded.)
3. **Split-tone** (color balance): sombras hacia un tono, altas hacia el complementario.
   - Objetos CÁLIDOS (disco de acreción): sombras neutras/teal, altas ámbar (`rh +0.10, bh −0.08`).
   - Objetos FRÍOS (estrella de neutrones azul): sombras neutras, altas **azul-blanco** (`rh −0.06, bh +0.10`) — halación FRÍA, no ámbar.
4. **Teal-orange** (el look cinematográfico #1): empuja sombras→teal, altas/sujeto→naranja
   (complementarios = máximo contraste de color). Úsalo donde haya un sujeto cálido sobre void frío.
5. **Bleach bypass**: contraste ALTO + saturación BAJA (plata retenida) → crudo, metálico. Para violencia/dureza.
6. **Cross-processing**: curvas por canal desfasadas (sombras verdosas, altas amarillas) → extrañeza/alienígena.
7. **Halación rojo-ámbar (defecto fotoquímico REAL)**: la luz rebota tras las capas del film y
   golpea la capa roja → glo cálido alrededor de los bordes brillantes. Receta (La Forja, davinci-v2):
   split → aislar ALTAS (curve `0/0 0.78/0 0.9/0.5 1/1`) → atenuar G,B (sangra a ROJO; o R,G para
   sangrar a AZUL en objetos fríos) → `gblur sigma=(W/2160)·11` → `blend=screen opacity 0.16`.
   **Contenida** (sigma×11 no ×18, opacity 0.16) o baña todo el cuadro = morado.
8. **Grano de película** (luma-tied, `noise alls=10 allf=t+u`, determinista por SEED+frameOffset)
   + **dither anti-banding** (`format=yuv420p10le` con `sws_flags accurate_rnd`) — los degradados
   oscuros sufren la compresión; el grano los protege.
9. **Viñeta** sutil (oscurece esquinas, foca el sujeto, void negro en bordes).
10. **ACES tonemap — UNO SOLO** (el shader emite HDR lineal con `linearOutput`; el postFX hace el único ACES). Nunca doble.

---

## C · RECETAS POR OBJETO (color físico + grade)
| Objeto | Color físico | Grade |
|--------|--------------|-------|
| **Agujero negro + disco** | void negro; disco T∝r^−¾ (interior azul-blanco→exterior ámbar) + δ⁴ beaming + lensing | crush 0.14, halación ÁMBAR contenida, sat 0.88 |
| **Estrella de neutrones / púlsar** | corteza casi-negra; hot spots **#94b1ff** pálido (Planck 10⁶K) + δ⁴ + redshift; limbo lensado que brilla | crush 0.16, halación FRÍA-blanca, sat 0.06 |
| **Quásar** | disco caliente + jet sincrotrón azul-blanco (no cuerpo negro) | crush, halación, sat media |
| **Nebulosa** | líneas SHO/HOO (Hα/OIII/SII reales) | crush, sat alta (las líneas SON saturadas), etiqueta paleta |
| **Supernova / remanente** | shock + líneas Hα/[SII] rojizas + sincrotrón azul | crush, halación cálida |
| **Sol / estrella** | granulación + Planck por T_eff + limbo oscurecido + protuberancias | sat media, halación cálida |
| **Rayos X / gamma (lentes)** | falso-color por banda (Chandra R/G/B) — ETIQUETAR | crush, void oscuro |

## D · CHECKLIST DE COLOR (por render)
- [ ] ¿El color SALE de física (Planck/líneas/beaming), no de paleta inventada? Lo evocativo, ETIQUETADO.
- [ ] ¿Caliente = blanco-azul PÁLIDO (#94b1ff clamp), NUNCA cobalto?
- [ ] ¿Negros NEGROS? (frame base vs graded; void a negro puro, crush 0.14–0.16)
- [ ] ¿Halación CONTENIDA (sigma×11, opacity 0.16), del color correcto (ámbar cálido / azul frío)?
- [ ] ¿δ⁴ + lensing en discos/NS? (más fiel que Interstellar)
- [ ] ¿Saturación por objeto (NS 0.06, disco 0.88, nebulosa alta)?
- [ ] ¿Grano + dither (anti-banding 10-bit)? ¿UN solo ACES? ¿CA=0 sobre starfields?

Fuentes (22, primarias NASA/ESA/Chandra + peer-reviewed): `docs/color-research.json`.
