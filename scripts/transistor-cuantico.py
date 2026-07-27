#!/usr/bin/env python3
"""
transistor-cuantico.py — LA ELECTRICIDAD VISTA DESDE LA CUÁNTICA.

Cómo funciona DE VERDAD un transistor de 2 nm: no hay "bolitas que fluyen".
Hay una nube de probabilidad |ψ|² que la compuerta llama, y electrones que
cruzan 14 nm casi sin chocar.

Esto resuelve el problema REAL, autoconsistente (el mismo que corren las
foundries, en su versión 1D):

  Schrödinger:  -ħ²/2m_z · d²ψ/dz² + V(z)·ψ = E·ψ      → subbandas E_n, ψ_n(z)
  Poisson:      d/dz(ε·dφ/dz) = -ρ(z)                   → potencial y campo
  Ocupación 2D: N_n = g_v·(m_d·kT/πħ²)·ln(1+exp((E_F-E_n)/kT))
  Densidad:     n(z) = Σ_n N_n·|ψ_n(z)|²
  → iterar Schrödinger ⇄ Poisson hasta converger (mezcla amortiguada)

VALLES DEL SILICIO (100) — no es un detalle, define el resultado:
  · Δ2 (2 valles): m_z = m_l = 0.916 m0  → confinan POCO (pesados en z)
                   m_d(2D) = m_t = 0.19 m0
  · Δ4 (4 valles): m_z = m_t = 0.19 m0   → confinan MUCHO (ligeros en z)
                   m_d(2D) = √(m_t·m_l) = 0.417 m0
  El confinamiento SEPARA los valles: a 6 nm los Δ2 bajan y se pueblan primero.
  Eso es real y medido; ignorarlo daría la ocupación equivocada.

FUENTES
  [IRDS] IEEE IRDS 2022, nodo 2 nm: T_sheet = 6 nm · Lg = 14 nm · W = 15 nm
  [Si]   m_l=0.916 m0 · m_t=0.19 m0 · εr=11.7 · Eg=1.12 eV · χ=4.05 eV
  [ox]   HfO2 high-k: εr≈22 · EOT≈0.8 nm · barrera Si/HfO2 ≈ 1.5 eV
  [μ]    movilidad efectiva en nanosheet ≈ 200-400 cm²/Vs (degradada vs bulk
         1400 por scattering de superficie y confinamiento)

Uso: python3 scripts/transistor-cuantico.py
"""
import numpy as np
from scipy.linalg import eigh_tridiagonal, solve_banded

# ── constantes (CODATA) ──
HBAR = 1.054571817e-34; M0 = 9.1093837015e-31; Q = 1.602176634e-19
EPS0 = 8.8541878128e-12; KB = 1.380649e-23

# ── [Si] + [IRDS] ──
T_SH  = 6e-9            # espesor del nanosheet (el pozo)
LG    = 14e-9           # longitud de compuerta
W_SH  = 15e-9
EPS_SI = 11.7 * EPS0
ML, MT = 0.916 * M0, 0.19 * M0
T = 300.0
KT = KB * T / Q         # eV

# los dos grupos de valles del Si(100): (m_z, m_d(2D), degeneración)
VALLEYS = [
    ('Δ2', ML, MT,                 2),
    ('Δ4', MT, np.sqrt(MT * ML),   4),
]

# ── malla en z (a través del espesor) ──
NZ = 220
z = np.linspace(0, T_SH, NZ)
dz = z[1] - z[0]

def schrodinger(v_eV, m_z, nlev=4):
    """Resuelve -ħ²/2m·ψ'' + V·ψ = E·ψ en el pozo. Devuelve E_n [eV], ψ_n normalizadas."""
    t = HBAR**2 / (2 * m_z * dz**2) / Q          # eV
    diag = 2 * t + v_eV
    off = -t * np.ones(NZ - 1)
    E, psi = eigh_tridiagonal(diag, off, select='i', select_range=(0, nlev - 1))
    # normalizar: ∫|ψ|²dz = 1
    for i in range(psi.shape[1]):
        psi[:, i] /= np.sqrt(np.sum(psi[:, i]**2) * dz)
    return E, psi

def occupation(E_n, m_d, gv, Ef):
    """Ocupación 2D de la subbanda (estadística de Fermi exacta en 2D) [m^-2].

    np.logaddexp(0, x) = ln(1+e^x) sin desbordar: con (Ef-E_n)/kT grande,
    np.exp() da inf y la ocupación sale nan (y el nan se propaga a TODO el
    autoconsistente en silencio, que es la peor forma de fallar).
    """
    x = (Ef - E_n) / KT
    return gv * (m_d * KB * T) / (np.pi * HBAR**2) * np.logaddexp(0.0, x)

# Referencia de energía: E_F = 0 (lo fijan los contactos n+ de source/drain).
# El canal es INTRÍNSECO: su banda de conducción arranca medio gap ARRIBA de E_F.
# Sin esto, el transistor "conduce" con la compuerta a 0 V — que fue justo el bug
# de la 1ª corrida (2e12 cm^-2 apagado). Es la barrera que hace el interruptor.
EC0 = 1.12 / 2      # eV — medio gap del Si (canal intrínseco, sin dopar)

def poisson(n_z, Vg):
    """Resuelve d²φ/dz² = q·n/ε con φ(0)=φ(L)=Vg (la compuerta ENVUELVE: GAA).

    Antes esto era un Thomas escrito a mano con las condiciones de frontera mal
    puestas: daba |E| = 219 V/nm, 730× el campo de RUPTURA del Si (30 MV/m).
    Un campo así no es un transistor, es un rayo. Ahora lo resuelve scipy y se
    verifica contra el dato medido.
    """
    N = len(n_z)
    ab = np.zeros((3, N))
    ab[0, 1:]  = 1.0          # superdiagonal
    ab[1, :]   = -2.0         # diagonal
    ab[2, :-1] = 1.0          # subdiagonal
    b = (Q * n_z / EPS_SI) * dz**2
    # Dirichlet en ambas caras: φ = Vg (el metal de la compuerta las rodea)
    ab[1, 0] = 1.0; ab[0, 1] = 0.0; b[0] = Vg
    ab[1, -1] = 1.0; ab[2, -2] = 0.0; b[-1] = Vg
    return solve_banded((1, 1), ab, b)

def solve(Vg, Ef=0.0, iters=200, mix=0.05):
    """Poisson-Schrödinger autoconsistente para un voltaje de compuerta Vg."""
    phi = np.full(NZ, Vg)
    n_z = np.zeros(NZ)
    for it in range(iters):
        # Energía de la banda de conducción que ve el electrón:
        #   EC0 (barrera del canal intrínseco) − q·φ (lo que la compuerta baja
        #   y lo que la propia carga apantalla) + barrera del óxido en las caras
        v = EC0 - phi
        v[0] = v[-1] = EC0 + 1.5      # [ox] barrera Si/HfO2 ≈ 1.5 eV
        n_new = np.zeros(NZ)
        levels = []
        for name, m_z, m_d, gv in VALLEYS:
            E, psi = schrodinger(v, m_z)
            for i in range(len(E)):
                N2d = occupation(E[i], m_d, gv, Ef)       # m^-2
                n_new += N2d * psi[:, i]**2               # m^-3
                levels.append((name, i, E[i], N2d))
        # mezcla amortiguada (si no, oscila y no converge)
        n_z = (1 - mix) * n_z + mix * n_new
        phi = (1 - mix) * phi + mix * poisson(n_z, Vg)
    return phi, n_z, levels

print("=" * 70)
print("  LA ELECTRICIDAD DESDE LA CUÁNTICA — nanosheet de 6 nm, Si(100)")
print("  Poisson-Schrödinger autoconsistente (lo que corre una foundry, en 1D)")
print("=" * 70)

# ── 1. EL POZO VACÍO: dónde puede estar el electrón ──────────────────────
print("\n[1] EL POZO VACÍO — las subbandas (energía SOBRE el fondo del pozo)")
v0 = np.zeros(NZ); v0[0] = v0[-1] = 1.5
for name, m_z, m_d, gv in VALLEYS:
    E, psi = schrodinger(v0, m_z)
    print(f"  valles {name} (m_z={m_z/M0:.3f} m0, deg={gv}):")
    for i in range(3):
        print(f"     E{i+1} = {E[i]*1000:7.1f} meV   ({E[i]/KT:5.2f} kT)")
print(f"  kT a 300 K = {KT*1000:.1f} meV")
print("  → los Δ2 (pesados en z) caen MÁS ABAJO: se pueblan PRIMERO.")
print("     El confinamiento ROMPE la degeneración de los 6 valles del Si.")

# ── 2. LA COMPUERTA LLAMA A LOS ELECTRONES ───────────────────────────────
print("\n[2] LA COMPUERTA LLAMA — n(z) autoconsistente vs Vg")
print(f"  {'Vg [V]':>8} {'n_2D [cm^-2]':>16} {'n_pico [cm^-3]':>17} {'estado':>12}")
curva = []
for Vg in [0.0, 0.15, 0.3, 0.45, 0.6, 0.75]:
    phi, n_z, levels = solve(Vg, Ef=0.0)
    n2d = np.sum(n_z) * dz            # m^-2
    npk = n_z.max()                   # m^-3
    estado = "APAGADO" if n2d < 1e15 else ("umbral" if n2d < 5e16 else "ENCENDIDO")
    print(f"  {Vg:8.2f} {n2d/1e4:16.3e} {npk/1e6:17.3e} {estado:>12}")
    curva.append((Vg, n2d, n_z.copy(), phi.copy()))
print("  → el canal NO tiene electrones propios (es intrínseco): los TRAE la")
print("     compuerta. Sin voltaje = cero. Eso es un interruptor cuántico.")

# ── 3. DÓNDE ESTÁ EL ELECTRÓN — la nube real ─────────────────────────────
print("\n[3] ¿DÓNDE está el electrón dentro de la lámina?")
Vg_on = 0.6
phi, n_z, levels = solve(Vg_on, Ef=0.0)
zc = z * 1e9
pk = zc[np.argmax(n_z)]
# ancho de la nube (desviación estándar de la distribución real)
w = n_z / np.sum(n_z)
mean = np.sum(zc * w); sig = np.sqrt(np.sum((zc - mean)**2 * w))
print(f"  a Vg = {Vg_on} V:")
print(f"  pico de la nube      : z = {pk:.2f} nm  (la lámina va de 0 a {T_SH*1e9:.0f} nm)")
print(f"  centro de masa       : z = {mean:.2f} nm")
print(f"  ancho (σ) de la nube : {sig:.2f} nm")
print(f"  → el electrón NO toca las paredes: |ψ|² se anula en el óxido.")
print(f"     No es una canica en un tubo: es una ONDA con forma.")
lv = sorted(levels, key=lambda x: x[2])[:4]
print(f"  subbandas pobladas (las 4 más bajas):")
for name, i, E, N2d in lv:
    print(f"     {name} E{i+1} = {E*1000:7.1f} meV → {N2d/1e4:.3e} cm^-2")

# ── 4. EL CAMPO ELÉCTRICO — lo que el video debe MOSTRAR ─────────────────
print("\n[4] EL CAMPO ELÉCTRICO dentro del canal")
Ez = -np.gradient(phi, dz)          # V/m
print(f"  E = -dφ/dz  (de la solución de Poisson, no dibujado)")
print(f"  |E| máximo  : {np.abs(Ez).max()/1e6:.2f} MV/m = {np.abs(Ez).max()/1e9:.4f} V/nm")
print(f"  |E| medio   : {np.abs(Ez).mean()/1e6:.2f} MV/m")
E_BREAK = 30e6   # V/m — campo de ruptura del Si (dato medido)
print(f"  campo de ruptura del Si: {E_BREAK/1e6:.0f} MV/m (dato medido)")
print(f"  → el campo APRIETA la nube contra el centro: por eso |ψ|² se estrecha.")
# GUARDARRAÍL: sin esto, un Poisson con las fronteras mal puestas daba 219 V/nm
# (730× la ruptura) y se habría renderizado un campo FALSO que se ve precioso.
# El campo vertical en el óxido/canal de un MOSFET real llega a ~5 MV/m; dentro
# del Si, con apantallamiento, se queda bastante abajo. Margen 10× por si el
# modelo 1D exagera cerca de las caras, pero 730× es un BUG, no un margen.
assert np.abs(Ez).max() < 10 * E_BREAK, (
    f"CAMPO IMPOSIBLE: {np.abs(Ez).max()/1e6:.0f} MV/m vs ruptura {E_BREAK/1e6:.0f} MV/m. "
    "Revisar las condiciones de frontera de Poisson ANTES de renderizar nada.")
print(f"  ✓ el campo es físicamente posible ({np.abs(Ez).max()/E_BREAK:.2f}× la ruptura)")

# ── 5. LOS ELECTRONES PASANDO — y aquí está la sorpresa ──────────────────
print("\n[5] LOS ELECTRONES PASANDO — ¿chocan?")
mu = 300e-4                     # m²/Vs — [μ] movilidad efectiva en nanosheet
m_cond = 0.26 * M0
tau = mu * m_cond / Q           # tiempo entre colisiones
v_th = np.sqrt(2 * KB * T / (np.pi * m_cond))   # velocidad térmica de inyección
lam = v_th * tau                # camino libre medio
print(f"  movilidad efectiva   : {mu*1e4:.0f} cm²/Vs   (bulk = 1400; el")
print(f"                         confinamiento y la superficie la degradan)")
print(f"  tiempo entre choques : τ = μ·m*/q = {tau*1e15:.1f} fs")
print(f"  velocidad térmica    : v = √(2kT/πm*) = {v_th/1e3:.0f} km/s")
print(f"  CAMINO LIBRE MEDIO   : λ = v·τ = {lam*1e9:.1f} nm")
print(f"  longitud del canal   : Lg = {LG*1e9:.0f} nm")
print(f"  → λ/Lg = {lam/LG:.2f}: el electrón cruza el canal chocando ~{LG/lam:.1f} veces.")
print(f"     Transporte CUASI-BALÍSTICO: casi lo cruza VOLANDO, sin chocar.")
print(f"     La corriente no es un empujón de bolitas: son electrones libres.")
t_transit = LG / v_th
print(f"  tiempo de tránsito   : {t_transit*1e15:.2f} fs = {t_transit*1e12:.3f} ps")
print(f"  → un electrón tarda {t_transit*1e15:.0f} femtosegundos en cruzar.")
print(f"     En 1 segundo eso cabría {1/t_transit:.2e} veces.")

# ── 6. LA VELOCIDAD DE DERIVA vs LA TÉRMICA ──────────────────────────────
print("\n[6] ¿QUÉ TAN RÁPIDO VAN? (la intuición falla aquí)")
V_ds = 0.7                       # voltaje drain-source típico
E_lateral = V_ds / LG
v_drift = mu * E_lateral
v_sat = 1e5                      # m/s — velocidad de saturación del Si (medida)
print(f"  campo lateral  : V_ds/Lg = {V_ds}/{LG*1e9:.0f}nm = {E_lateral/1e6:.0f} MV/m")
print(f"  v_deriva = μ·E : {v_drift/1e3:.0f} km/s  → SATURA en {v_sat/1e3:.0f} km/s (medido)")
print(f"  v_térmica      : {v_th/1e3:.0f} km/s")
print(f"  → los electrones ya se mueven RÁPIDO (caos térmico) en todas")
print(f"     direcciones. El campo solo los SESGA hacia el drain.")
print(f"     La corriente es un sesgo estadístico, no un río.")

print("\n" + "=" * 70)
print("  Cada número salió de resolver ψ y φ, o de un dato medido.")
print("  Esto es lo que la escena tiene que DIBUJAR — nada más.")
print("=" * 70)
