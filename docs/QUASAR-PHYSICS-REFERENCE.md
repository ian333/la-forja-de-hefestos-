# Quasar Physics Reference — La Forja

> Roadmap completo para que La Forja simule cuásares **observation-grade**:
> radio → infrarrojo → óptico → UV → X-ray → gamma. Cada componente lleva
> física real (no inventada) + URLs concretos donde descargar los datos.

Convenciones:
- `G c h k_B σ_T m_e m_p` = constantes físicas estándar (CGS unless noted).
- `r_g = GM/c²` (gravitational radius). `r_s = 2GM/c²` (Schwarzschild radius).
- `M_⊙ = 1.989×10³³ g`. `L_⊙ = 3.828×10³³ erg/s`. `pc = 3.086×10¹⁸ cm`.
- `L_Edd = 4π·G·M·m_p·c/σ_T = 1.26×10³⁸·(M/M_⊙) erg/s`.

---

## 1. El motor central — Black Hole de Kerr

**Parámetros**: masa `M`, spin `a* = J·c/(G·M²)` ∈ [−1, 1].

```
r_horizon  = M · (1 + √(1 − a*²))                                   [r_g]
r_ergo(θ)  = M · (1 + √(1 − a*²·cos²θ))                              [r_g]
r_ISCO(a*) = 3 + Z₂ − sign(a*)·√[(3 − Z₁)·(3 + Z₁ + 2·Z₂)]            [r_g]
  Z₁ = 1 + (1 − a*²)^(1/3)·[(1 + a*)^(1/3) + (1 − a*)^(1/3)]
  Z₂ = √(3·a*² + Z₁²)
```

Refs: Bardeen-Press-Teukolsky 1972 ApJ 178:347 · MTW §33 · Chandrasekhar
*Mathematical Theory of Black Holes* 1983.

**Geodésicas (light ray-tracing)**: integrar ecuaciones de Carter (constants
of motion = E, L_z, Q). Implementación reference: `gyoto`, `grtrans`, `odyssey`.

**Datos reales (BH mass + spin)**:
- AGN Black Hole Mass Database (Bentz & Katz, GSU): http://www.astro.gsu.edu/AGNmass/
  → ~150 reverberation-mapped masses, FITS y CSV.
- SDSS DR16Q (Wu & Shen 2022): https://www.sdss.org/dr18/algorithms/qso_catalog/
  → 750,000 quasares, BH mass via single-epoch virial (Vestergaard-Peterson).
- Spin atlas (relativistic reflection fits) — Reynolds 2019 NatAs 3:41
  catálogo Table 1; XMM/NuSTAR observations.

---

## 2. Disco de acreción — Thin (Shakura-Sunyaev)

Aplica para `0.01·L_Edd ≲ L ≲ 0.3·L_Edd` (thin α-disk).

```
T(r) = [3·G·M·Ṁ / (8π·σ·r³) · (1 − √(r_in/r))]^(1/4)
```

Con relativistic corrections (Novikov-Thorne 1973):
```
T(r) = [3·G·M·Ṁ / (8π·σ·r³) · ℛ(r/r_g, a*)]^(1/4)
```
donde `ℛ` incluye los factores `B, C, D, E` de la integral de transporte
relativista (ver Page-Thorne 1974 ApJ 191:499).

**Luminosidad bolometric**:
```
L_disk = η · Ṁ · c²
  η(a*)  = 0.057 (Schwarzschild) → 0.42 (Kerr extremo)
  η      = 1 − E_ISCO (energía específica en ISCO)
```

**Emisión = multi-color blackbody**:
```
F_ν = ∫_{r_in}^{r_out} π·B_ν(T(r)) · 2π·r·dr
B_ν(T) = (2·h·ν³/c²) · 1/(exp(h·ν/kT) − 1)
```

**Modelos avanzados**:
- ADAF/RIAF (Narayan-Yi 1995 ApJ 452:710) — para Ṁ < 10⁻³·Ṁ_Edd, radiatively
  inefficient, ópticamente fino, advectivo.
- Slim disk (Abramowicz+ 1988 ApJ 332:646) — Ṁ ≳ Ṁ_Edd, super-Eddington.

**Datos reales**:
- AGN STORM (Fausnaugh+ 2016) optical/UV continuum lightcurves NGC 5548:
  https://archive.stsci.edu/prepds/agn_storm/
- AGN SED Atlas (Brown+ 2019): https://archive.stsci.edu/prepds/agnsedatlas/
- SWIRE templates (Polletta+ 2007): https://www.iasf-milano.inaf.it/~polletta/templates/
- Disk spectra computed with `qsosed`, `agnsed` (XSPEC tabs):
  https://www.star.bris.ac.uk/~mbu/qsosed/

---

## 3. Corona — Inverse Compton sobre el disco

Plasma caliente arriba del disco interior, Compton up-scatters fotones UV/soft-X
del disco a hard-X.

```
Compton-y    y = (4·kT_e/m_e·c²) · max(τ, τ²)
Spectral idx Γ ≈ 1 + 4/9·y^(−2/9)         (Sunyaev-Titarchuk 1980)
Cutoff       E_cut = 2·kT_e ≈ 100–300 keV (NuSTAR sample, Fabian+ 2015)
```

Modelos XSPEC: `nthcomp`, `compTT`, `compPS`, `relxill`.

**Datos**:
- NuSTAR archive (hard X-ray spectra E_cut measurements):
  https://heasarc.gsfc.nasa.gov/docs/nustar/archive/nustar_archive.html
- Swift/BAT 157-month catalogue: https://swift.gsfc.nasa.gov/results/bs157mon/
- INTEGRAL all-sky cat: https://www.isdc.unige.ch/integral/

---

## 4. Reflection — Disco "ilumina" desde la corona

Compton hump (~20-30 keV) + Fe-Kα fluorescence (6.4 keV neutral, 6.97 keV
ionized) + relativistic broadening (gravitational redshift + Doppler).

```
F_Fe-Kα(E) = N_0 · ∫ R(r) · g(E, r, i, a*) · dr          [GR convolution]
N_0    ∝ N_Fe · Ω/(4π) · (Γ−1)^(−1)
R(r)   = εmissivity ∝ r^(−q), q ≈ 3–7 (broken-PL emissivity)
g(...) = redshift line-of-sight factor (Cunningham 1975)
```

Cara-Legendre / cara-i Kerr: usar `relxill` (García+ 2014 ApJ 782:76):
http://www.sternwarte.uni-erlangen.de/~dauser/research/relxill/

**Datos**:
- XMM-Newton archive (clean E ≤ 10 keV): https://www.cosmos.esa.int/web/xmm-newton/xsa
- NuSTAR hard X-ray (Compton hump): https://heasarc.gsfc.nasa.gov/nustar/
- Combinado catalog (Walton+ 2013, Rivers+ 2013) — spin measurements.

---

## 5. Broad Line Region (BLR)

Nubes de gas fotoionizado, virialmente bound:
```
v_FWHM ≈ √(G·M·f/r_BLR)              ~3000–10000 km/s
r_BLR  ≈ 17 light-days · (L_5100/10⁴⁴ erg/s)^0.533    (Bentz+ 2013 ApJ 767:149)
M_BH   = f · r_BLR · v² / G          (f ≈ 4.3, virial factor)
```

**Líneas dominantes** (Vanden Berk+ 2001 composite SDSS quasar):
| Línea  | λ_rest (Å) | uso                                |
|--------|-----------|------------------------------------|
| Lyα    | 1216      | high-z BH mass, RM                 |
| CIV    | 1549      | high-z BH mass (Vestergaard 2006)  |
| CIII]  | 1909      | density diagnostic                 |
| MgII   | 2798      | low-z + intermediate, Hα-comparable|
| Hβ     | 4861      | local BH mass standard             |
| Hα     | 6563      | high-flux, dust-extincted          |
| [OIII] | 4959/5007 | sistema rest-frame (NLR, narrow)   |

**Reverberation mapping** (Blandford & McKee 1982):
```
Transfer function Ψ(τ) = response delay distribution
L_line(t) = ∫ Ψ(τ) · L_cont(t−τ) · dτ
```

**Datos reales**:
- AGN Black Hole Mass Database: http://www.astro.gsu.edu/AGNmass/
- SDSS RM project (Shen+ 2015, Grier+ 2017):
  https://www.sdss.org/dr18/algorithms/sdssrm/
- Composite spectrum templates: Vanden Berk+ 2001 ApJ 122:549 — table.
- OzDES, AGN-STORM-2 ongoing: http://www.ozdes.org/

---

## 6. Narrow Line Region (NLR)

Gas low-density (10²–10⁴ cm⁻³) en escala 10–1000 pc, fotoionizado pero
no virializado.

```
[OIII] 5007Å luminosity → AGN bolometric (Heckman+ 2004 ApJ 613:109):
L_bol ≈ 3500 · L_[OIII]    (factor varies 250–3500)
```

Líneas: [OIII]4959/5007, [OII]3727, [NII]6548/6584, [SII]6717/6731,
[OI]6300, [NeIII]3869, He II 4686.

**Modelos**: `cloudy` (photoionization, Ferland+ 2017):
https://gitlab.nublado.org/cloudy/cloudy

**Datos**:
- SDSS BPT classifications (Kauffmann+ 2003, Kewley+ 2006):
  catálogo en https://wwwmpa.mpa-garching.mpg.de/SDSS/DR7/
- IFU surveys (NLR resolved): MaNGA, CALIFA, SAMI, MUSE archives.

---

## 7. Dusty Torus — IR thermal

Sublimation radius (donde dust grain T = T_sub ≈ 1500 K):
```
r_sub ≈ 0.4 pc · (L_UV / 10⁴⁵ erg/s)^(1/2) · (T_sub/1500 K)^(−2.6)
                                                  (Barvainis 1987 ApJ 320:537)
```

Emisión = sum over dust grain populations:
```
F_ν = ∑_a ∫ B_ν(T_d(r,a)) · κ_ν(a) · n_d(r,a) · dV
```
- `T_d(r,a)`: dust temp por radius r y grain size a, equilibrio radiativo
  con campo UV central.
- `κ_ν(a)`: opacity (Draine & Lee 1984, Draine 2003).
- Smooth (Pier-Krolik 1992 ApJ 401:99) vs clumpy (Nenkova+ 2008 ApJ 685:147).

**Models / codes**:
- CLUMPY (Nenkova+ 2008): https://www.clumpy.org/
- CAT3D (Hönig & Kishimoto 2010): http://cat3d.sungrazer.org/
- SKIRT (Camps & Baes 2015): https://www.skirt.ugent.be/
- HYPERION (Robitaille 2011): https://www.hyperion-rt.org/

**Datos**:
- WISE all-sky IR photometry: https://irsa.ipac.caltech.edu/Missions/wise.html
- Spitzer Heritage Archive: https://irsa.ipac.caltech.edu/applications/Spitzer/SHA/
- Herschel HSA: http://archives.esac.esa.int/hsa/whsa/
- JWST MIRI/NIRSpec: https://mast.stsci.edu/

---

## 8. Jet — Launching (Blandford-Znajek)

Extracción de energía rotacional del BH vía campo magnético poloidal anclado
al horizonte.

```
P_BZ = (1/c) · κ · Ω_F · (Ω_H − Ω_F) · Ψ²        (Blandford-Znajek 1977)
     ≈ 6.7×10⁴⁵ erg/s · a*² · (B_horizon/10⁴ G)² · (M/10⁹ M☉)²

Ω_H  = a*·c/(2·r_horizon)        (angular freq del horizonte)
Ω_F  ≈ Ω_H/2                     (split-monopole optimal)
Ψ    = magnetic flux through horizonte
```

**MAD state** (Magnetically Arrested Disk, Tchekhovskoy+ 2011 MNRAS 418:L79):
```
φ_BH = Ψ / (Ṁ · c · r_g²)^(1/2)   → φ_MAD ≈ 50
```

Cuando φ_BH alcanza el valor MAD, el jet es máximamente eficiente:
`η_jet = P_jet / (Ṁ c²) > 1` (energy extraction from spin).

**Códigos GRMHD**:
- HARM (Gammie+ 2003): https://horizon.physics.utoronto.ca/HARM/
- BHAC (Porth+ 2017): https://bhac.science/
- KORAL (Sądowski+ 2013): https://github.com/AlexandruSadowski/koral
- PLUTO (Mignone+ 2007) special-relativistic: http://plutocode.ph.unito.it/
- Athena++: https://www.athena-astro.app/
- IllinoisGRMHD (Etienne+ 2015) for full GR: https://einsteintoolkit.org/

**Outputs típicos** (HDF5):
- ρ, p, B^i, u^i, velocity field, B-field, density.
- Usados para emisión post-processing: `grtrans`, `BHOSS`, `RAPTOR`.

---

## 9. Jet — Acceleration & Collimation

**Aceleración (Vlahakis-Königl 2003 ApJ 596:1080)**:
```
γ(σ) = √(γ₀² + σ_∞ · z/(z + z_acc))
σ    = B²/(4π·ρ·c²)   = magnetización
σ_∞  ≈ γ_∞             para conversion eficiente Poynting → bulk kinetic
```

**Collimation (McKinney-Narayan 2007 ApJ 668:1182)**:
Geometría parabólica observada hasta `~10⁵–10⁶ r_g`, luego cónica.
```
z ∝ R^k       k ≈ 1.6 (parabólica colimada)
              k ≈ 1   (cónica, free expansion)
```

Confirmación observacional M87 (Asada-Nakamura 2012 ApJL 745:L28):
break en `R_HST−1 ≈ 100 mas ≈ 2×10⁵ r_g`.

**Lighting cylinder (force-free)**:
```
R_LC = c/Ω_F ≈ 2·r_horizon / a*
```

---

## 10. Jet — Emisión

### Synchrotron (Rybicki & Lightman 1979 §6)

Distribución de electrones power-law `N(γ_e) = N_0 · γ_e^(−p)`:
```
j_ν = (e³/4π·m_e·c²) · N_0 · B^((p+1)/2) · (3e/4π·m_e³·c⁵)^((p−1)/2) ·
      ν^(−(p−1)/2) · Γ((p+19/12)/Γ((p−1)/4)·…   (full coefficient en R-L 6.36)

α_sync = (p − 1)/2     spectral index (S_ν ∝ ν^(−α))
                       AGN typical α ≈ 0.7 → p ≈ 2.4
```

### Synchrotron Self-Compton (SSC, Jones+ 1974)

Photons sincrotrón "rebotan" en sus propios electrones:
```
L_SSC / L_sync  ≈ U_sync / U_B
ν_SSC,peak       ≈ 4γ²·ν_sync,peak / 3
```

### External Compton (Dermer-Schlickeiser 1993, Sikora+ 1994)

Electrones del jet up-scatter fotones del disco / BLR / dusty torus:
```
ε'_seed = γ · Γ · ε_seed   (en frame jet)
L_EC ∝ Γ⁴ · L_seed · (R_seed/r_dissip)²    (Dermer 1995)
```

Seed photons:
- Disco: `r < r_BLR`, T_BB ≈ 10⁴ K (peaks UV).
- BLR: line emission Lyα 1216Å.
- Torus: T ≈ 1000 K, IR.

### Doppler boost (Lind & Blandford 1985 ApJ 295:358)

```
δ = 1/[γ·(1 − β·cosθ_obs)]
S_ν,obs = δ^(3+α) · S_ν,rest    (continuous jet)
S_ν,obs = δ^(2+α) · S_ν,rest    (discrete blob)
```

Para `γ = 10` y observador en `θ = 1/γ`: `δ ≈ γ`. Brightness boost ≈ `γ^(3+α) ≈ 10⁴`.

---

## 11. SED multi-wavelength — el cuásar como conjunto

| Banda          | Energía       | Origen                                         |
|----------------|---------------|------------------------------------------------|
| Radio ν<100GHz | 10⁻⁶–10⁻⁴ eV | Sync optically thick → thin (jet)              |
| Sub-mm/mm      | 10⁻³–0.01 eV | Sync + cold dust                               |
| Far-IR         | 0.01–0.1 eV  | Cool dust (T~100K)                             |
| Mid-IR         | 0.1–1 eV     | Hot dust (T~300–1500K, torus interior)         |
| Near-IR        | 1–2 eV       | Stellar host + hot dust + accretion tail       |
| Optical        | 2–4 eV       | Disk (Big Blue Bump) + BLR lines + stellar     |
| UV             | 4–100 eV     | Disk peak (T~10⁵K)                             |
| Soft X (0.1–2 keV)   | 0.1–2 keV  | Soft excess (warm corona / blurred refl)   |
| Hard X (2–100 keV)   | 2–100 keV  | Hot corona Comptonization + reflection     |
| Gamma          | >100 MeV     | Jet IC (SSC + EC)                              |

**Combinar todo: codes de SED fitting**:
- AGNFitter (Calistro Rivera+ 2016): https://github.com/GabrielaCR/AGNfitter
- CIGALE (Boquien+ 2019, Yang+ 2020 AGN module):
  https://cigale.lam.fr/
- BAYESED — Han & Han 2014.
- SED3FIT — Berta+ 2013.

**Empirical templates**:
- Elvis+ 1994 ApJ 95:1 mean SED.
- Richards+ 2006 ApJS 166:470 SDSS quasar SED templates.
- Krawczyk+ 2013 ApJS 206:4 multi-wavelength.

---

## 12. Variability — la dimensión temporal

**Damped Random Walk** (Kelly+ 2009 ApJ 698:895) — optical continuum:
```
dF/dt = −(F − F̄)/τ + σ·ξ(t)
τ      ≈ 200 días (SDSS S82, MacLeod+ 2010)
σ      ≈ 0.2 mag rms
```

**Reverberation lag** entre bandas (disk thermal):
```
τ(λ) ∝ λ^(4/3)        (Cackett+ 2007, AGN STORM Fausnaugh+ 2016)
```

**X-ray PSD** (Power Spectral Density):
```
P(f) ∝ f^(−1)         (low-freq)
P(f) ∝ f^(−2)         (above bend f_b ~ 1/(c·R_corona))
f_b ∝ 1/M             (McHardy+ 2006 Nature 444:730)
```

**Datos de variability**:
- SDSS Stripe 82 (MacLeod+ 2010): photometric LCs 10 años.
- ZTF (Zwicky Transient Facility) DR21:
  https://www.ztf.caltech.edu/ztf-public-releases.html
- ATLAS forced photometry: https://fallingstar-data.com/forcedphot/
- ASAS-SN: https://asas-sn.osu.edu/
- TESS para AGN: https://archive.stsci.edu/missions-and-data/tess
- LSST (Vera Rubin Observatory, 2025+): https://www.lsst.org/

---

## 13. Catálogos / archivos para BAJAR datos AHORA

### Multi-wavelength compilation
- **NED** (NASA/IPAC Extragalactic): https://ned.ipac.caltech.edu/
- **SIMBAD**: http://simbad.cds.unistra.fr/
- **VizieR** (catálogos): http://vizier.cds.unistra.fr/

### Quasar / AGN catalogs (CSV/FITS bulk download)
- **MILLIQUAS** (Million Quasars, Flesch 2023): 1.7M sources, todo cross-matched.
  https://heasarc.gsfc.nasa.gov/W3Browse/all/milliquas.html
  → FITS table descargable.
- **SDSS DR18Q**: 1M quasares. https://www.sdss.org/dr18/algorithms/qso_catalog/
- **Roma-BZCAT 5th ed** (Blazars): https://www.asdc.asi.it/bzcat/
- **4LAC-DR3** (Fermi blazars): https://fermi.gsfc.nasa.gov/ssc/data/access/lat/4LACDR3/

### Radio
- **VLA Sky Survey (VLASS)**: https://science.nrao.edu/vlass
- **MOJAVE** (VLBA monitoring): https://www.physics.purdue.edu/MOJAVE/
- **Astrogeo VLBI DB**: http://astrogeo.org/vlbi_images/
- **NVSS** (1.4 GHz): https://www.cv.nrao.edu/nvss/
- **FIRST** (1.4 GHz high-res): http://sundog.stsci.edu/
- **VLASS catalogues**: https://cirada.ca/catalogues
- **EHT public data**: https://eventhorizontelescope.org/for-astronomers/data

### IR
- **WISE** all-sky: https://irsa.ipac.caltech.edu/Missions/wise.html
- **Spitzer Heritage**: https://irsa.ipac.caltech.edu/applications/Spitzer/SHA/
- **Herschel HSA**: http://archives.esac.esa.int/hsa/
- **JWST MAST**: https://mast.stsci.edu/

### Optical / UV
- **SDSS spectra+photometry**: https://www.sdss.org/
- **HST/MAST**: https://archive.stsci.edu/hst/
- **Gaia DR3**: https://gea.esac.esa.int/archive/
- **Pan-STARRS DR2**: https://catalogs.mast.stsci.edu/panstarrs/
- **GALEX UV**: https://galex.stsci.edu/

### X-ray
- **HEASARC archive** (todo): https://heasarc.gsfc.nasa.gov/docs/archive.html
- **XMM-Newton 4XMM DR13**: http://xmm-catalog.irap.omp.eu/
- **Chandra Source Catalog 2.1**: https://cxc.cfa.harvard.edu/csc/
- **NuSTAR archive**: https://heasarc.gsfc.nasa.gov/docs/nustar/archive/
- **eROSITA-DE DR1**: https://erosita.mpe.mpg.de/dr1/
- **Swift 157-month BAT**: https://swift.gsfc.nasa.gov/results/bs157mon/

### Gamma-ray
- **Fermi-LAT 4FGL-DR4**: https://fermi.gsfc.nasa.gov/ssc/data/access/lat/14yr_catalog/
- **HESS Galactic Plane Survey**: https://www.mpi-hd.mpg.de/hfm/HESS/hgps/
- **MAGIC archive**: https://magic.mpp.mpg.de/
- **VERITAS**: https://veritas.sao.arizona.edu/

### Variability lightcurves
- **ZTF DR21**: https://www.ztf.caltech.edu/ztf-public-releases.html
- **ATLAS**: https://fallingstar-data.com/forcedphot/
- **ASAS-SN sky patrol v2**: https://asas-sn.osu.edu/
- **TESS MAST**: https://archive.stsci.edu/missions-and-data/tess

### Reverberation mapping
- **AGN BH Mass Database** (Bentz & Katz): http://www.astro.gsu.edu/AGNmass/
- **SDSS RM**: https://www.sdss.org/dr18/algorithms/sdssrm/
- **AGN-STORM** legacy products: https://archive.stsci.edu/prepds/agn_storm/

### Templates / model libraries
- **Elvis+ 1994 SED**: VizieR table III/166.
- **AGN SED Atlas** (Brown+ 2019): https://archive.stsci.edu/prepds/agnsedatlas/
- **SWIRE templates** (Polletta+ 2007): https://www.iasf-milano.inaf.it/~polletta/templates/
- **Richards+ 2006 templates**: https://www.physics.drexel.edu/~gtr/outgoing/AGN_SED_papers/
- **CLUMPY torus library**: https://www.clumpy.org/

---

## 14. Numerical codes que valen la pena envolver

| Código       | Qué hace                                | URL                                                  |
|--------------|-----------------------------------------|------------------------------------------------------|
| HARM         | GRMHD 3D Kerr accretion                | https://horizon.physics.utoronto.ca/HARM/            |
| BHAC         | GRMHD multi-grid                       | https://bhac.science/                                |
| KORAL        | GRRMHD + radiation                     | https://github.com/AlexandruSadowski/koral           |
| PLUTO        | SR-MHD jets large-scale                | http://plutocode.ph.unito.it/                        |
| Athena++     | MHD general                            | https://www.athena-astro.app/                        |
| grtrans      | GRRT post-process MHD outputs          | https://github.com/jadexter/grtrans                  |
| BHOSS        | GR ray-tracing                         | https://www.cosmic-flows.org/bhoss                   |
| RAPTOR       | GR ray-tracing GPU                     | https://github.com/tbronzwaer/raptor                 |
| ipole        | GR polarized RT                        | https://github.com/moscibrodzka/ipole                |
| Cloudy       | Photoionization (BLR, NLR)             | https://gitlab.nublado.org/cloudy/cloudy             |
| CLOUDY-table | Pre-computed photoionization grids     | (incluido en Cloudy)                                 |
| CLUMPY       | Clumpy torus IR                        | https://www.clumpy.org/                              |
| SKIRT        | Dust radiative transfer                | https://www.skirt.ugent.be/                          |
| Hyperion     | Dust RT                                | https://www.hyperion-rt.org/                         |
| XSPEC        | X-ray spectral fitting                 | https://heasarc.gsfc.nasa.gov/xanadu/xspec/          |
| relxill      | Relativistic reflection (XSPEC model)  | http://www.sternwarte.uni-erlangen.de/~dauser/research/relxill/ |
| qsosed       | AGN broadband SED (XSPEC)              | https://www.star.bris.ac.uk/~mbu/qsosed/             |
| AGNFitter    | Bayesian SED fitting                   | https://github.com/GabrielaCR/AGNfitter               |
| CIGALE       | SED fitting w/ AGN module              | https://cigale.lam.fr/                               |

---

## 15. Roadmap concreto para La Forja

Lo que ya tenemos:
- ✅ Kerr ISCO closed-form (`QuasarKerr.tsx`)
- ✅ Schwarzschild ray-tracing del disco (`BHRaytraced.tsx`)
- ✅ Shakura-Sunyaev T(r) en shader
- ✅ Doppler beaming relativista en disco
- ✅ Streamlines BZ precomputadas con γ + j_synchrotron (`QuasarBZ.tsx`)

Próximos pasos (orden de impacto):

1. **Pre-compute SED templates** desde `agnsed`/`qsosed` para varias `M, Ṁ/Ṁ_Edd, a*`.
   Output: una tabla 3D que el browser muestrea para reconstruir L_ν a cualquier
   ángulo. Tamaño: ~1 MB. Permite slider "wavelength" en la UI.

2. **Wrap CLUMPY torus library** — descargar las precomputed clumpy SEDs y
   tener el torus IR sin tener que rerun radiative transfer.

3. **Reverberation mapping demo** — el continuo central varia (DRW), las
   nubes BLR responden con lag `r_BLR/c`. Carga lightcurve real de AGN STORM
   o NGC 5548 y visualiza.

4. **Multi-frequency jet** — toggle band (radio/IR/optical/X-ray/gamma) y
   ver cómo cambia el aspecto del jet: brillo, knots, opacity. Datos: VLA/MOJAVE
   stacks + Chandra X-ray for M87, 3C 273, 3C 279, Hercules A.

5. **GRMHD output viewer** — descargar un snapshot de simulación HARM/BHAC
   (~50 MB HDF5), convertir a 3D textura, volume-rendered en R3F. Mostrar
   accretion + jet launch real.

6. **EHT image overlay** — tomar la imagen oficial de M87*/Sgr A* (FITS),
   posicionarla espacialmente y enseñar la sombra. Convención de tamaño
   d_shadow ≈ √27·r_g.

7. **GRMHD ray-traced movie** — output de grtrans/BHOSS, una sequence de
   frames de la BH siendo alimentada en tiempo real. Cargar como video texture
   o sequence de PNGs.

---

## Refs canónicas para citar

- Frank, King, Raine 2002 *Accretion Power in Astrophysics* (textbook)
- Krolik 1999 *Active Galactic Nuclei* (textbook)
- Netzer 2013 *The Physics and Evolution of AGN* (textbook)
- Padovani+ 2017 A&ARv 25:2 — review observacional AGN multiwavelength
- Yuan & Narayan 2014 ARA&A 52:529 — hot accretion flows
- Blandford+ 2019 ARA&A 57:467 — relativistic jets
- Begelman, Blandford, Rees 1984 RvMP 56:255 — jet theory classic
- Marscher 2014 piece — internal shocks, blazar variability
- Rees 1984 ARA&A 22:471 — black hole models AGN

---

*Documento vivo. Cada vez que añadamos un nuevo componente físico a La Forja,
agregar la formulación + URL de datos aquí.*
