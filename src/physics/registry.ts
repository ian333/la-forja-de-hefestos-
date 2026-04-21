/**
 * Registro completo de ramas y módulos de la forja física.
 *
 * Estado de cada módulo:
 *   - live     → funciona, con invariantes verificados
 *   - stub     → UI placeholder pero la ecuación ya está definida en el roadmap
 *   - planned  → roadmap descriptivo, todavía sin código
 *   - external → apunta a otra sub-app (ej. GaiaLab)
 *
 * Filosofía: cubrir TODA la física conocida. Cada módulo debe poder usarse
 * por un niño (modo 'child': explora, juega con presets) y por un investigador
 * (modo 'researcher': parámetros SI, exportar datos, contraste con observación).
 */

import { lazy } from 'react';
import type { PhysicsBranch } from './types';

const SolarSystem     = lazy(() => import('./modules/astro/SolarSystem'));
const Schwarzschild   = lazy(() => import('./modules/astro/Schwarzschild'));
const EMFields        = lazy(() => import('./modules/em/Fields'));
const DoublePendulum  = lazy(() => import('./modules/mech/DoublePendulum'));
const DoubleHelix     = lazy(() => import('./modules/bio/DoubleHelix'));
const ProteinViewer   = lazy(() => import('./modules/bio/ProteinViewer'));
const Docking         = lazy(() => import('./modules/bio/Docking'));
const CentralDogma    = lazy(() => import('./modules/bio/CentralDogma'));
const BiologyScales   = lazy(() => import('./modules/bio/BiologyScales'));
const AtomToBond      = lazy(() => import('./modules/bio/AtomToBond'));

export const BRANCHES: PhysicsBranch[] = [
  {
    id: 'mech',
    name: 'Mecánica clásica',
    icon: '⚙',
    accent: '#4FC3F7',
    blurb: 'Newton, Lagrange, Hamilton — lo que se mueve y cómo.',
    modules: [
      { id: 'double-pendulum', name: 'Péndulo doble', status: 'live',
        blurb: 'Caos determinista desde el Lagrangiano. ΔE/E < 1e-12.',
        childHint: 'Dos péndulos casi iguales. ¿Quedarán sincronizados o no?',
        researcherHint: 'Ecuaciones de Euler-Lagrange analíticas, RK4, Lyapunov ~1.5/s.',
        component: DoublePendulum },
      { id: 'harmonic', name: 'Oscilador armónico', status: 'stub',
        blurb: 'Resorte + amortiguamiento + forzado. Resonancia, Q.',
        roadmap: [
          'm ẍ + b ẋ + k x = F₀ cos(Ωt) — motor ya en src/lib/physics/mech.ts (shoStep)',
          'Viewport: posición x(t) + espacio de fase (x, v) + respuesta en frecuencia',
          'Presets: libre, subamortiguado, crítico, sobreamortiguado, resonante',
        ] },
      { id: 'rigid-body', name: 'Cuerpo rígido', status: 'planned',
        blurb: 'Rotación con tensor de inercia. Efecto Dzhanibekov, giroscopios.',
        roadmap: [
          'Ecuaciones de Euler para I·ω̇ + ω × (I·ω) = τ',
          'Tennis racket theorem (eje intermedio inestable)',
          'Top de Lagrange (giroscopio con gravedad)',
        ] },
      { id: 'lagrangian', name: 'Formalismo Lagrangiano', status: 'planned',
        blurb: 'Construcción automática de EOM desde L = T − U. Principio variacional.',
        roadmap: [
          'Input simbólico: coordenadas generalizadas, T, U',
          'Autodiff para ∂L/∂q, ∂L/∂q̇',
          'Salida: ecuaciones de movimiento simbólicas + integrador',
        ] },
    ],
  },

  {
    id: 'astro',
    name: 'Astrofísica',
    icon: '✦',
    accent: '#FDB813',
    blurb: 'Desde sistemas planetarios a agujeros negros y cosmología.',
    modules: [
      { id: 'solar-system', name: 'Sistema Solar', status: 'live',
        blurb: 'N-cuerpos newtoniano con datos reales JPL. Verlet simpléctico.',
        childHint: '¿Qué pasa si hacemos a la Tierra más pesada? Prueba.',
        researcherHint: 'Integrador Verlet, ΔE/E ~1e-13 por órbita, elementos orbitales en vivo.',
        component: SolarSystem },
      { id: 'schwarzschild', name: 'Relatividad general — Schwarzschild', status: 'live',
        blurb: 'Precesión del perihelio. Sim vs Newton. 43"/siglo en Mercurio ✓.',
        childHint: 'Einstein dijo que la gravedad curva el tiempo. Aquí lo ves.',
        researcherHint: 'd²u/dφ² + u = GM/h² + 3GMu²/c². Integrador RK4.',
        component: Schwarzschild },
      { id: 'blackhole-disk', name: 'Agujero negro — disco de acreción', status: 'planned',
        blurb: 'Métrica de Kerr, ISCO, disco visual con redshift gravitacional.',
        roadmap: [
          'r_s, r_ph, r_ISCO ya en src/lib/physics/relativity.ts',
          'Trazado de rayos Schwarzschild: integrar geodésicas nulas',
          'Disco de Novikov-Thorne: T(r), L(r), espectro multi-color BB',
          'Deflección y lente de Einstein, anillo de fotones',
        ] },
      { id: 'stellar', name: 'Estructura estelar', status: 'planned',
        blurb: 'Ecuaciones de Lane-Emden, cadena pp, secuencia principal.',
        roadmap: [
          'Equilibrio hidrostático dP/dr = -ρGMᵣ/r²',
          'Transporte radiativo y convectivo',
          'Tasas de reacción nuclear (Salpeter)',
          'Diagrama HR dinámico',
        ] },
      { id: 'cosmology', name: 'Cosmología', status: 'planned',
        blurb: 'Friedmann-Lemaître-Robertson-Walker. a(t), H(z), CMB.',
        roadmap: [
          'Ecuaciones de Friedmann con Ωₘ, Ω_Λ, Ω_r, Ω_k',
          'Escala a(t), tiempo conforme, distancias comóviles',
          'Transfer function → espectro de potencia P(k)',
          'CMB Doppler peaks (orden de magnitud)',
        ] },
      { id: 'quasars', name: 'Cuásares y AGN', status: 'planned',
        blurb: 'Núcleos galácticos activos: disco, jet relativista, variabilidad.',
        roadmap: [
          'Sedov-Taylor + jet de Blandford-Znajek',
          'Variabilidad óptica de disco estándar',
          'Función de luminosidad observada vs simulada',
        ] },
      { id: 'galaxies', name: 'Galaxias y materia oscura', status: 'planned',
        blurb: 'Curvas de rotación, perfil NFW, dinámica colisionless.',
        roadmap: [
          'N-cuerpos con PM / tree code (Barnes-Hut)',
          'Perfil de Navarro-Frenk-White',
          'Ajuste a curvas de rotación observadas (SPARC)',
        ] },
    ],
  },

  {
    id: 'em',
    name: 'Electromagnetismo',
    icon: '⚡',
    accent: '#E27B58',
    blurb: 'Maxwell completo: estática, dinámica, ondas EM, óptica.',
    modules: [
      { id: 'fields', name: 'Campos estáticos — Coulomb & Biot-Savart', status: 'live',
        blurb: 'Dipolos, capacitores, corrientes rectas. Ciclotrón con Lorentz RK4.',
        childHint: 'Pon cargas y ve cómo se empujan con flechas de fuerza.',
        researcherHint: 'Gauss flux err ~1e-13, Ampère err ~1e-8. Probe en tiempo real.',
        component: EMFields },
      { id: 'em-waves', name: 'Ondas EM', status: 'planned',
        blurb: 'Maxwell time-dependent → FDTD (Yee). Polarización, interferencia.',
        roadmap: [
          'Grid Yee 2D: Eᵤ, Eᵥ, Bᵥ → actualización temporal',
          'Fuentes: dipolo oscilante, láser CW, pulso gaussiano',
          'Medios dieléctricos ε(r), absorbente (PML)',
        ] },
      { id: 'optics', name: 'Óptica', status: 'planned',
        blurb: 'Geométrica (trazado), ondulatoria (Fourier), interferencia.',
        roadmap: [
          'Trazado de rayos para lentes, espejos, aberraciones',
          'Difracción de Fraunhofer (FFT 2D)',
          'Doble rendija, rendijas múltiples, redes',
        ] },
      { id: 'waveguide', name: 'Guías de onda y cavidades', status: 'planned',
        blurb: 'Modos TE, TM en geometrías cilíndricas y rectangulares.',
        roadmap: [
          'Ecuación de Helmholtz con condiciones de contorno',
          'Elementos finitos o separación de variables analítica',
        ] },
    ],
  },

  {
    id: 'thermo',
    name: 'Termodinámica & Estadística',
    icon: '∿',
    accent: '#EF5350',
    blurb: 'Entropía, distribuciones de Boltzmann, transiciones de fase.',
    modules: [
      { id: 'ideal-gas', name: 'Gas ideal (MD)', status: 'planned',
        blurb: 'Partículas Lennard-Jones 2D/3D. Temperatura, presión, MB.',
        roadmap: [
          'N-cuerpos con potencial LJ 12-6',
          'Termostato de Berendsen o Nosé-Hoover',
          'Histograma de velocidades → Maxwell-Boltzmann',
        ] },
      { id: 'ising', name: 'Modelo de Ising 2D', status: 'planned',
        blurb: 'Transición de fase ferromagnética. Metropolis. T_c ≈ 2.269 J/k_B.',
        roadmap: [
          'Monte Carlo Metropolis con spins ±1',
          'Magnetización <M>, susceptibilidad χ(T)',
          'Visualizar clusters y transición crítica',
        ] },
      { id: 'phase', name: 'Diagramas de fase', status: 'planned',
        blurb: 'Agua, CO₂ — curvas de coexistencia, punto triple, crítico.',
        roadmap: [
          'Van der Waals + correcciones empíricas',
          'Clausius-Clapeyron',
        ] },
      { id: 'heat', name: 'Ecuación del calor', status: 'planned',
        blurb: '∂T/∂t = α ∇²T en 2D/3D, condiciones de contorno diversas.',
        roadmap: [
          'Diferencias finitas explícitas (FTCS) y Crank-Nicolson',
          'Fuentes, sumideros, aislantes',
        ] },
    ],
  },

  {
    id: 'fluids',
    name: 'Fluidos',
    icon: '≈',
    accent: '#26A69A',
    blurb: 'Navier-Stokes, turbulencia, aerodinámica.',
    modules: [
      { id: 'ns-2d', name: 'Navier-Stokes 2D (Stam)', status: 'planned',
        blurb: 'Solver estable tipo Jos Stam. Vorticidad, cargas pasivas.',
        roadmap: [
          'Advección semi-Lagrangiana + difusión + proyección',
          'Resolución adaptable 128–512, GPU opcional',
          'Presets: cavidad, obstáculos, Kármán vortex street',
        ] },
      { id: 'sph', name: 'SPH (fluido partículas)', status: 'planned',
        blurb: 'Smoothed Particle Hydrodynamics con superficie libre.',
        roadmap: [
          'Núcleo gaussiano o poly6',
          'Gravedad + tensión superficial + viscosidad',
        ] },
      { id: 'aero', name: 'Aerodinámica', status: 'planned',
        blurb: 'Airfoil 2D por vórtices + capa límite simple.',
        roadmap: ['Panel method', 'Kutta condition', 'CL/CD vs ángulo'] },
    ],
  },

  {
    id: 'waves',
    name: 'Ondas & Acústica',
    icon: '〜',
    accent: '#AB47BC',
    blurb: 'Ecuación de onda, superposición, Doppler, modos normales.',
    modules: [
      { id: 'wave-1d', name: 'Onda 1D', status: 'planned',
        blurb: 'Cuerda con velocidad variable, reflexión, ondas estacionarias.',
        roadmap: [
          '∂²u/∂t² = c²(x) ∂²u/∂x², FDTD 1D',
          'Superposición de pulsos, impedance mismatch',
        ] },
      { id: 'doppler', name: 'Doppler (acústico y EM)', status: 'planned',
        blurb: 'Emisor móvil, cono de Mach, redshift relativista.',
        roadmap: ['f\' = f(c∓v_o)/(c±v_s)', 'Ondas de choque cuando v_s > c'] },
      { id: 'string-modes', name: 'Modos normales en cuerda y membrana', status: 'planned',
        blurb: 'Separación de variables; Chladni figures en placas.',
        roadmap: ['Eigenvalue problem en 2D', 'Patrones de Chladni visuales'] },
    ],
  },

  {
    id: 'quantum',
    name: 'Cuántica',
    icon: 'ψ',
    accent: '#7E57C2',
    blurb: 'Schrödinger, efecto túnel, orbitales, materia condensada.',
    modules: [
      { id: 'gaia-atom', name: 'Átomo multielectrón', status: 'external',
        blurb: 'Tabla periódica + ψ² real con apantallamiento Slater (GAIA Lab).',
        childHint: 'Toca un elemento y ve la nube de electrones real.',
        researcherHint: 'Orbitales hidrogenoides + Z_eff de Slater. ~15k puntos MC.',
        externalUrl: '/lab.html' },
      { id: 'schrodinger-1d', name: 'Schrödinger 1D', status: 'planned',
        blurb: 'Evolución temporal en potencial V(x). Túnel, reflexión.',
        roadmap: [
          'Split-step Fourier o Crank-Nicolson',
          'Presets: libre, pozo, barrera (túnel), oscilador armónico',
          'Superposición de autoestados, colapso tras medición',
        ] },
      { id: 'harmonic-quantum', name: 'Oscilador armónico cuántico', status: 'planned',
        blurb: 'ψₙ(x), energías Eₙ = ℏω(n+½), superposiciones coherentes.',
        roadmap: ['Polinomios de Hermite + evolución temporal'] },
      { id: 'hydrogen', name: 'Átomo de hidrógeno (3D)', status: 'planned',
        blurb: 'ψₙₗₘ(r,θ,φ), nube 3D, transiciones radiativas.',
        roadmap: ['Funciones asociadas de Laguerre y armónicos esféricos reales'] },
      { id: 'bands', name: 'Estructura de bandas (Kronig-Penney)', status: 'planned',
        blurb: 'De átomo aislado → cadena periódica → banda.',
        roadmap: ['Potencial periódico + teorema de Bloch'] },
    ],
  },

  {
    id: 'relativity',
    name: 'Relatividad especial',
    icon: 'γ',
    accent: '#F06292',
    blurb: 'Lorentz, diagrama de Minkowski, 4-vectores.',
    modules: [
      { id: 'lorentz', name: 'Transformaciones de Lorentz', status: 'planned',
        blurb: 'Dos frames, diagrama espacio-tiempo interactivo.',
        roadmap: [
          'γ(v), dilatación, contracción, simultaneidad relativa',
          'Gemelos paradoja con trayectoria acelerada',
        ] },
      { id: 'collisions', name: 'Colisiones relativistas', status: 'planned',
        blurb: 'Conservación de 4-momento. Cinemática LHC simple.',
        roadmap: ['Umbral de producción de partículas', 'Mandelstam s,t,u'] },
    ],
  },

  {
    id: 'nuclear',
    name: 'Nuclear & partículas',
    icon: '☢',
    accent: '#FFB74D',
    blurb: 'Desintegraciones, reacciones, interacciones fundamentales.',
    modules: [
      { id: 'decay', name: 'Cadenas de desintegración', status: 'planned',
        blurb: 'N(t) = N₀ e^(-λt). Series U-238, Th-232, K-40.',
        roadmap: ['ODE lineal con datos reales IAEA', 'Datación C-14'] },
      { id: 'fusion', name: 'Fusión y fisión', status: 'planned',
        blurb: 'Curva de energía de ligadura, proceso pp, ciclo CNO.',
        roadmap: ['Semi-empirical mass formula', 'Tasa de reacción Salpeter'] },
      { id: 'feynman', name: 'Diagramas de Feynman (básico)', status: 'planned',
        blurb: 'QED tree-level: dispersión e-e, e-γ. Vista educativa.',
        roadmap: ['Dibujar amplitudes a tree-level con cinemática numérica'] },
    ],
  },

  {
    id: 'condensed',
    name: 'Materia condensada',
    icon: '▦',
    accent: '#66BB6A',
    blurb: 'Redes cristalinas, bandas, superconductividad.',
    modules: [
      { id: 'crystal', name: 'Redes cristalinas', status: 'planned',
        blurb: 'FCC, BCC, HCP. Difracción de Bragg.',
        roadmap: ['Construcción de celdas de Bravais', 'Patrón de Laue simulado'] },
      { id: 'phonons', name: 'Fonones', status: 'planned',
        blurb: 'Relaciones de dispersión ω(k) en cadenas lineales.',
        roadmap: ['Matriz dinámica', 'Debye model → capacidad calorífica'] },
      { id: 'superconductor', name: 'Superconductividad', status: 'planned',
        blurb: 'Modelo BCS cualitativo, efecto Meissner.',
        roadmap: ['Gap Δ(T)', 'Efecto Josephson simulado'] },
    ],
  },

  {
    id: 'chem',
    name: 'Química (GAIA)',
    icon: '⚗',
    accent: '#81C784',
    blurb: 'Química desde la cuántica: átomos, enlaces, reacciones.',
    modules: [
      { id: 'gaia', name: 'Abrir GAIA Lab completo', status: 'external',
        blurb: 'Motor stiff + MD + cuántico con ~376 tests verdes.',
        childHint: 'El laboratorio donde mezclas cosas y ves qué pasa de verdad.',
        researcherHint: 'Integración con src/lib/chem/*: elements, reactions, reactors, quantum MD.',
        externalUrl: '/lab.html' },
    ],
  },

  {
    id: 'bio',
    name: 'Biofísica & genoma',
    icon: '◊',
    accent: '#42A5F5',
    blurb: 'Plegamiento, redes metabólicas, evolución molecular.',
    modules: [
      { id: 'double-helix', name: 'Doble hélice B-DNA', status: 'live',
        blurb: 'Geometría canónica B-form (Arnott-Hukins / Olson). Major/minor groove reales.',
        childHint: 'Dos hileras se trenzan; las letras A-T y G-C se abrazan dentro.',
        researcherHint: 'Rise 3.4 Å, twist 34.3°, groove offset 155°. Secuencias humanas reales (telómero, BRCA1).',
        component: DoubleHelix },
      { id: 'protein-viewer', name: 'Visor de proteínas (PDB)', status: 'live',
        blurb: 'Carga estructuras reales del RCSB. Cartoon + CPK estilo ChimeraX.',
        childHint: 'Cada proteína es una forma 3D única. Esa forma decide qué hace.',
        researcherHint: 'Parser PDB v3.3, SS desde HELIX/SHEET, ligandos con bonds por distancia covalente.',
        component: ProteinViewer },
      { id: 'docking', name: 'Docking — proteasa VIH + saquinavir', status: 'live',
        blurb: 'Diseña medicina: arrastra saquinavir al bolsillo activo. Score Vina en vivo.',
        childHint: 'Mete el tapón rojo en el hueco de la máquina viral hasta que "encaje".',
        researcherHint: 'Vina-like scoring (Trott & Olson 2010): 2 gaussians + repulsion + hydrophobic + Hbond. Grid espacial 8 Å.',
        component: Docking },
      { id: 'central-dogma', name: 'Dogma central — DNA → RNA → proteína', status: 'live',
        blurb: 'Transcripción + traducción en tiempo real. Secuencias humanas reales (insulina, p53, BRCA1).',
        childHint: 'Mira cómo el motor copia la receta del DNA al mRNA, y cómo el taller arma la proteína pieza por pieza.',
        researcherHint: 'Código genético NCBI tabla 1. Velocidades de RNAP II (30 nt/s) y ribosoma eucariota (6 aa/s) como referencia.',
        component: CentralDogma },
      { id: 'atom-to-bond', name: 'Átomo → enlace — H₂ desde primeros principios', status: 'live',
        blurb: 'Hartree-Fock/STO-3G derivado. R_eq, k y ν̃ NO son inputs: salen del SCF electrónico.',
        childHint: 'Dos átomos de hidrógeno con la nube electrónica que los pega. La distancia ideal sale sola.',
        researcherHint: 'RHF/STO-3G con integrales gaussianas cerradas. SCF converge en ~3 iter. PES → fit parabólico en R_eq. k clásica = d²E/dR². Escalón nivel 0→1 de la escalera multi-escala.',
        component: AtomToBond },
      { id: 'scales', name: 'Escalas biológicas — célula a átomo', status: 'live',
        blurb: 'Zoom multi-escala desde 20 µm (célula) hasta 10 Å (par de bases). 7 niveles, 4 órdenes de magnitud.',
        childHint: 'Una célula es gigante al lado del DNA. Mira cuánto hay que acercarse para ver las letras.',
        researcherHint: 'Escalas canónicas (Alberts 7ª): célula 20 µm → núcleo 6 µm → cromosoma 1.4 µm → fibra 30 nm → nucleosoma 11 nm → hélice B 2 nm → par de bases 10 Å.',
        component: BiologyScales },
      { id: 'folding', name: 'Plegamiento de proteínas', status: 'planned',
        blurb: 'Modelo HP de Dill en lattice 2D/3D. Energía por contacto.',
        roadmap: [
          'Monte Carlo con movimientos válidos (corner, crankshaft, pivot)',
          'Función de energía de contacto HP',
          'Visualización de la secuencia plegada + identificación del núcleo hidrofóbico',
        ] },
      { id: 'ion-channel', name: 'Canal iónico', status: 'planned',
        blurb: 'Ecuación de Nernst-Planck + Poisson. Modelo barrera.',
        roadmap: ['Reacción-difusión 1D + potencial electroquímico'] },
      { id: 'genome', name: 'Genoma humano y medicinas', status: 'planned',
        blurb: 'De DNA → RNA → proteína. Diseño de fármacos (docking básico).',
        roadmap: [
          'Parser FASTA de secuencias reales (pequeñas al inicio)',
          'Transcripción y traducción en tiempo real',
          'Docking por score heurístico (complementariedad + puentes H)',
          'Interfaz a GAIA para la química subyacente',
        ] },
      { id: 'evolution', name: 'Evolución molecular', status: 'planned',
        blurb: 'Cadenas de Markov de sustituciones (Jukes-Cantor, Kimura).',
        roadmap: ['Simulación de árboles filogenéticos a partir de secuencias'] },
    ],
  },
];

export function findModule(branchId: string, moduleId: string) {
  const br = BRANCHES.find(b => b.id === branchId);
  const mo = br?.modules.find(m => m.id === moduleId);
  return { branch: br, module: mo };
}
