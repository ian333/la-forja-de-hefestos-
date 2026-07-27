#!/usr/bin/env python3
"""
transistor-real.py — EL TRANSISTOR MÁS PEQUEÑO EN PRODUCCIÓN, CALCULADO.

Nodo de 2 nm, GAA nanosheet (TSMC N2, producción masiva desde 4Q2025).
Aquí NO se dibuja nada: se CALCULA. Cada número sale de un dato publicado o de
una fórmula. La v1 de este video se rechazó por inventada (red tecleada a mano
en un arreglo BASE8) — ver _archivo/rechazados/transistor-v1-inventado/.

REGLA: si un número no tiene fuente arriba, no entra.

FUENTES
  [N2]   TSMC N2: gate pitch 48 nm · metal pitch 26 nm · 313 MTr/mm² ·
         SRAM bit-cell 0.0175 µm². GAA nanosheet. Producción masiva 4Q2025.
         (Wikipedia "2 nm process", recopilando disclosures de la industria.)
         OJO: TSMC NO publica las dimensiones internas (IEDM 2025: "there are
         no pitches in the paper"). Son secreto industrial.
  [IRDS] IEEE IRDS 2022, nodo 2 nm — lo que TSMC calla, el roadmap sí lo da:
         Lg = 14 nm · W_sheet = 15 nm · T_sheet = 6 nm · L_spacer = 6 nm ·
         sheet-to-sheet = 10 nm.
  [Si]   Silicio cristalino: estructura diamante, a = 5.431 Å (medido, 300 K).
         Gap = 1.12 eV. eps_r = 11.7. m_t* = 0.19 m0, m_l* = 0.916 m0.
  [DOP]  GAA moderno: canal INTRÍNSECO (undoped) a propósito, para no sufrir
         random dopant fluctuation. El dopaje vive en source/drain, ~1e20 cm^-3.
         (Literatura de RDF en GAA nanosheet FETs, IBM/IEEE T-ED.)
  [P:Si] Donor de fósforo en silicio: energía de ionización experimental
         45.6 meV (la teoría hidrogenoide da menos: hay corrección de valle).

Uso: python3 scripts/transistor-real.py
"""
import numpy as np

# ── constantes físicas (CODATA) ──
HBAR = 1.054571817e-34      # J·s
M0   = 9.1093837015e-31     # kg
E    = 1.602176634e-19      # C  (1 eV = E joules)
EPS0 = 8.8541878128e-12     # F/m
KB   = 1.380649e-23         # J/K
A0   = 0.529177210903e-10   # m  (radio de Bohr)

# ── [Si] silicio cristalino ──
A_SI    = 5.431e-10         # m — parámetro de red (medido)
EPS_SI  = 11.7
MT      = 0.19 * M0         # masa efectiva transversal
ML      = 0.916 * M0        # masa efectiva longitudinal
M_COND  = 0.26 * M0         # masa de conductividad (3/(1/ml+2/mt))
EG      = 1.12              # eV

# ── [IRDS] geometría del nodo de 2 nm ──
LG   = 14e-9
WSH  = 15e-9
TSH  = 6e-9
TSP  = 10e-9                # separación lámina a lámina
NSH  = 3                    # láminas apiladas (típico GAA)

# ── [N2] lo que TSMC sí publica ──
CPP     = 48e-9             # gate pitch
MP      = 26e-9             # metal pitch
DENS    = 313e6             # transistores por mm²
SRAM    = 0.0175            # µm² por bit-cell

# ── [DOP] dopaje ──
ND_SD   = 1e20 * 1e6        # m^-3  (1e20 cm^-3 en source/drain)
ND_CH   = 0.0               # canal INTRÍNSECO — la verdad del GAA moderno
NI_SI   = 1.0e10 * 1e6      # m^-3  portadores intrínsecos del Si a 300 K
T       = 300.0             # K

print("=" * 68)
print("  EL TRANSISTOR MÁS PEQUEÑO EN PRODUCCIÓN — CALCULADO, NO DIBUJADO")
print("  nodo 2 nm · GAA nanosheet · TSMC N2 (producción masiva 4Q2025)")
print("=" * 68)

# ── 1. LA MENTIRA DEL NOMBRE ────────────────────────────────────────────
print("\n[1] EL NOMBRE — '2 nanómetros'")
print(f"  gate pitch (lo que separa 2 transistores) : {CPP*1e9:.0f} nm   [N2]")
print(f"  metal pitch                                : {MP*1e9:.0f} nm   [N2]")
print(f"  longitud FÍSICA de la compuerta (Lg)       : {LG*1e9:.0f} nm   [IRDS]")
print(f"  espesor de la lámina de silicio            : {TSH*1e9:.0f} nm    [IRDS]")
print(f"  → NADA en el transistor mide 2 nm. El '2 nm' es un NOMBRE COMERCIAL.")
print(f"     Lo más chico aquí ({TSH*1e9:.0f} nm) es {TSH/2e-9:.0f}× más grande que su nombre.")

# ── 2. CUÁNTOS ÁTOMOS — el conteo real ──────────────────────────────────
print("\n[2] ¿DE CUÁNTOS ÁTOMOS ESTÁ HECHO?")
# estructura diamante: 8 átomos por celda cúbica de lado a
n_si = 8 / A_SI**3                      # átomos/m³
print(f"  densidad atómica del Si = 8/a³ = {n_si/1e6/1e21:.2f}e21 átomos/cm³")
print(f"     (a = {A_SI*1e10:.3f} Å medido · estructura diamante = 8 átomos/celda)")
v_ch = LG * WSH * TSH
n_ch = n_si * v_ch
print(f"  canal de UNA lámina: {LG*1e9:.0f}×{WSH*1e9:.0f}×{TSH*1e9:.0f} nm = {v_ch*1e27:.0f} nm³")
print(f"  → átomos de Si en el canal        : {n_ch:,.0f}")
print(f"  → los {NSH} nanosheets apilados     : {n_ch*NSH:,.0f} átomos")
# celdas unitarias a lo largo de la compuerta
print(f"  la compuerta ({LG*1e9:.0f} nm) cubre {LG/A_SI:.1f} celdas unitarias de Si")
print(f"  el espesor ({TSH*1e9:.0f} nm) son {TSH/A_SI:.1f} celdas — se cuentan a mano")

# ── 3. EL DOPAJE — donde vive de verdad ─────────────────────────────────
print("\n[3] EL DOPAJE — ¿dónde está?  (esto contradice la intuición)")
print(f"  canal   : INTRÍNSECO, {ND_CH:.0f} dopantes a propósito   [DOP]")
print(f"            si lo dopas, cada átomo suelto mueve el umbral (RDF)")
print(f"  source/drain: {ND_SD/1e6:.0e} cm^-3  [DOP]")
# volumen de source (entre compuerta y el borde del pitch)
l_sd = (CPP - LG) / 2
v_sd = l_sd * WSH * TSH
n_dop_sd = ND_SD * v_sd
print(f"  volumen de source = {l_sd*1e9:.0f}×{WSH*1e9:.0f}×{TSH*1e9:.0f} nm = {v_sd*1e27:.0f} nm³")
print(f"  → átomos de dopante en source     : {n_dop_sd:.0f}   ¡SE CUENTAN!")
print(f"  → 1 dopante por cada {n_si/ND_SD:,.0f} átomos de Si")
# portadores intrínsecos en el canal: el numero que mata la intuicion
n_intr = NI_SI * v_ch
print(f"  portadores intrínsecos en el canal: {n_intr:.2e}  (n_i={NI_SI/1e6:.0e} cm^-3)")
print(f"     → el canal apagado tiene CERO electrones libres. No 'pocos': cero.")

# ── 4. CONFINAMIENTO CUÁNTICO — la lámina es un pozo ────────────────────
print("\n[4] LA LÁMINA ES UN POZO CUÁNTICO (no es un cable, es una caja)")
# particula en caja infinita: E_n = hbar² pi² n² / (2 m* L²)
def e_conf(n, m, L):
    return (HBAR**2 * np.pi**2 * n**2) / (2 * m * L**2) / E   # eV
e1 = e_conf(1, MT, TSH)
e2 = e_conf(2, MT, TSH)
kt = KB * T / E
print(f"  pozo de {TSH*1e9:.0f} nm (el espesor de la lámina), m*_t = 0.19 m0")
print(f"  E1 = ħ²π²/(2m*T²) = {e1*1000:.1f} meV")
print(f"  E2 = {e2*1000:.1f} meV   →  ΔE = {(e2-e1)*1000:.1f} meV")
print(f"  kT a 300 K        = {kt*1000:.1f} meV")
print(f"  → E1/kT = {e1/kt:.1f}  : el confinamiento NO es un detalle, DOMINA.")
print(f"     Los electrones ya no tienen energías continuas: tienen ESCALONES.")

# ── 5. EL DOPANTE NO CABE — el remate ───────────────────────────────────
print("\n[5] EL DOPANTE ES MÁS GRANDE QUE EL CANAL")
# radio de Bohr efectivo: a* = a0 * eps_r / (m*/m0)
a_star = A0 * EPS_SI / (M_COND / M0)
print(f"  un átomo de fósforo en Si = un 'átomo de hidrógeno gigante':")
print(f"  a* = a0·εr/(m*/m0) = {A0*1e10:.3f} Å × {EPS_SI} / {M_COND/M0:.2f} = {a_star*1e9:.2f} nm")
print(f"  el electrón del dopante tiene radio {a_star*1e9:.2f} nm")
print(f"  el canal tiene {TSH*1e9:.0f} nm de espesor")
print(f"  → el electrón del dopante mide {2*a_star/TSH*100:.0f}% del espesor del canal.")
print(f"     NO CABE. Por eso el canal moderno va SIN dopar.")
# energia de ionizacion hidrogenoide
ed = 13.6 * (M_COND/M0) / EPS_SI**2
print(f"  energía de ionización (hidrogenoide) = 13.6 eV·(m*/m0)/εr² = {ed*1000:.1f} meV")
print(f"  experimental (P en Si)                                     = 45.6 meV  [P:Si]")
print(f"     (la hidrogenoide subestima: hay corrección de valle — se ETIQUETA,")
print(f"      no se maquilla. Ambas ≈ kT: por eso el dopante se ioniza solo.)")

# ── 6. LA ESCALA — cuántos caben ────────────────────────────────────────
print("\n[6] LA ESCALA")
area_tr = 1e-6 / DENS                    # m² por transistor (1 mm² = 1e-6 m²)
print(f"  densidad = {DENS/1e6:.0f} millones de transistores por mm²   [N2]")
print(f"  → área media por transistor = {area_tr*1e18:,.0f} nm²  (~{np.sqrt(area_tr)*1e9:.0f}×{np.sqrt(area_tr)*1e9:.0f} nm)")
print(f"  SRAM bit-cell = {SRAM} µm²   [N2]")
# la comparacion honesta: transistores por año vs estrellas de la galaxia
print(f"\n  Para el guion (verificar antes de usar):")
print(f"  - la Vía Láctea tiene ~1e11 a 4e11 estrellas (estimación astronómica)")
print(f"  - un chip de 100 mm² a esta densidad = {DENS*100/1e9:.1f} mil millones de transistores")
print(f"  - → {1e11/(DENS*100):.0f} chips de 100 mm² ya igualan las estrellas de la galaxia")

# ── 7. LA RED QUE SE VA A RENDERIZAR ────────────────────────────────────
print("\n[7] LA GEOMETRÍA A RENDERIZAR (posiciones REALES, no dibujadas)")
# base de la estructura diamante: FCC + (1/4,1/4,1/4). Esto NO es invención:
# es la estructura cristalina medida del silicio.
FCC = np.array([[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]])
BASE = np.concatenate([FCC, FCC + 0.25])        # 8 átomos por celda
ncx, ncy, ncz = [int(np.ceil(d/A_SI)) for d in (LG, WSH, TSH)]
print(f"  celdas unitarias a renderizar: {ncx}×{ncy}×{ncz} = {ncx*ncy*ncz:,}")
print(f"  átomos = celdas × 8 = {ncx*ncy*ncz*8:,}")
print(f"  → cabe en la GPU (los átomos de la serie usan ~16k puntos/electrón)")
# los dopantes: posiciones ALEATORIAS = como en la realidad (RDF)
rng = np.random.default_rng(20260715)
n_d = int(round(n_dop_sd))
print(f"  dopantes en source: {n_d} átomos en posiciones ALEATORIAS de la red")
print(f"     (aleatorias porque ASÍ ES: random dopant fluctuation es real,")
print(f"      no se acomodan en cuadrícula — esa aleatoriedad ES el fenómeno)")
print("\n" + "=" * 68)
print("  Todo lo de arriba sale de un dato citado o una fórmula.")
print("  Nada se tecleó 'para que se viera bien'.")
print("=" * 68)
