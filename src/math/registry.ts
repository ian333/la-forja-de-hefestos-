/**
 * Registro de ramas y módulos del pilar de Matemáticas.
 *
 * Mismo contrato que el registry de Física: cada módulo nace como `planned` o
 * `stub` con su roadmap, sube a `live` cuando hay simulación 3D-real con
 * invariantes verificables. Cada uno debe servir a niño y a investigador.
 */

import { lazy } from 'react';
import type { LabBranch } from './types';

const TangentPlane     = lazy(() => import('./modules/calc/TangentPlane'));
const TaylorSeries     = lazy(() => import('./modules/calc/TaylorSeries'));
const Derivative1D     = lazy(() => import('./modules/calc/Derivative1D'));
const RiemannIntegral  = lazy(() => import('./modules/calc/RiemannIntegral'));
const VectorFields     = lazy(() => import('./modules/calc/VectorFields'));
const EigenVectors3D   = lazy(() => import('./modules/linalg/EigenVectors3D'));
const Matrix3D         = lazy(() => import('./modules/linalg/Matrix3D'));
const Rotations        = lazy(() => import('./modules/linalg/Rotations'));
const PCA              = lazy(() => import('./modules/linalg/PCA'));
const MobiusRiemann    = lazy(() => import('./modules/complex/MobiusRiemann'));
const NewtonFractals   = lazy(() => import('./modules/complex/NewtonFractals'));
const ConformalMaps    = lazy(() => import('./modules/complex/ConformalMaps'));
const PhasePortrait    = lazy(() => import('./modules/diffeq/PhasePortrait'));

export const BRANCHES: LabBranch[] = [
  {
    id: 'calc',
    name: 'Cálculo',
    icon: '∫',
    accent: '#4FC3F7',
    blurb: 'Derivada, integral, multivariable. Cómo cambian las cosas.',
    modules: [
      { id: 'tangent-plane', name: 'Plano tangente y gradiente', status: 'live',
        blurb: 'z = f(x,y), plano tangente local y ∇f. Spivak/Stewart cap. 14.',
        childHint: 'Mueve el punto y mira cómo la "tabla plana" sigue a la superficie.',
        researcherHint: 'Plano tangente exacto desde ∂f/∂x, ∂f/∂y analíticas. Gradiente proyectado en XY.',
        component: TangentPlane },
      { id: 'derivative-1d', name: 'Derivada como recta tangente', status: 'live',
        blurb: 'Definición por límite. Recta secante → tangente al achicar h. Numérica vs analítica.',
        childHint: 'Bajá el slider h y mirá cómo la línea verde se vuelve la dorada.',
        researcherHint: 'Diferencia centrada de 4to orden (O(h⁴)). Casos: x², sin, e^x, |x|, √x, x³−3x.',
        component: Derivative1D },
      { id: 'integral-area', name: 'Integral como área (Riemann)', status: 'live',
        blurb: 'Sumas izq/der/med/trapezoidal. Convergencia al área exacta visible.',
        childHint: 'Subí N y mirá cómo los rectangulitos dorados llenan el área bajo la curva.',
        researcherHint: 'Compara errores: izq/der O(Δx), medio/trapezoidal O(Δx²). 6 funciones, área negativa visible.',
        component: RiemannIntegral },
      { id: 'series', name: 'Series de Taylor', status: 'live',
        blurb: 'Aproximación local por polinomios. Radio de convergencia visible.',
        childHint: 'Slider N → ve cómo el polinomio dorado se acerca a la curva rosa.',
        researcherHint: 'e^x, sin, cos, log(1+x), 1/(1−x). Bandas de convergencia explícitas para los dos últimos.',
        component: TaylorSeries },
      { id: 'vector-fields', name: 'Campos vectoriales y divergencia', status: 'live',
        blurb: 'F(x,y), flechas + streamlines RK4. ∇·F y ∇×F medibles. 8 presets canónicos.',
        childHint: 'Click → soltar partícula que sigue el río.',
        researcherHint: 'Fuente, vórtice, silla, Coulomb 2D, dipolo, Helmholtz. Probe para div/curl puntual.',
        component: VectorFields },
    ],
  },

  {
    id: 'linalg',
    name: 'Álgebra lineal',
    icon: 'Λ',
    accent: '#7E57C2',
    blurb: 'Strang en 3D: matrices, eigenvectores, transformaciones.',
    modules: [
      { id: 'matrix-3d', name: 'Matriz 3×3 como transformación', status: 'live',
        blurb: 'Cubo → A·cubo. Columnas = donde aterrizan i,j,k. Determinante = factor de volumen.',
        childHint: 'Tres flechas coloreadas: donde cada eje XYZ aterriza después de A.',
        researcherHint: '7 presets canónicos (identidad, escala, rotación, cizalla, reflexión, proyección, singular). Animación 0→1 con keyframes.',
        component: Matrix3D },
      { id: 'eigen-3d', name: 'Eigenvectores en 3D', status: 'live',
        blurb: 'Direcciones invariantes de una matriz 3×3. Strang lección 21.',
        childHint: 'Las flechas de colores son ejes que A no rota — solo estira o encoge.',
        researcherHint: 'Polinomio característico cerrado + cross-product de filas para v. Animación 0→A interpola cubo.',
        component: EigenVectors3D },
      { id: 'rotations', name: 'Rotaciones SO(3) y cuaterniones', status: 'live',
        blurb: 'Euler vs cuaterniones. Gimbal lock visible cuando pitch = 90°. Eje-ángulo.',
        childHint: 'Si subís pitch a 90° verás dos sliders haciendo lo mismo — eso es gimbal lock.',
        researcherHint: 'Convención YXZ (Tait-Bryan). Cuaternión q = (cos(θ/2), sin(θ/2)·n̂). Cobertura doble S³ → SO(3).',
        component: Rotations },
      { id: 'pca', name: 'PCA — ejes principales', status: 'live',
        blurb: 'Nube 3D gaussiana → eigenvectores de la covarianza → componentes principales. % varianza explicada.',
        childHint: '5 distribuciones: esfera, pancake, cigarro, inclinada, casi-línea — mirá qué pasa con los ejes.',
        researcherHint: 'Jacobi eigen-decomposition exacta (3×3 simétrica). Elipsoide de 1σ con quaternión desde la base eigenvector.',
        component: PCA },
    ],
  },

  {
    id: 'complex',
    name: 'Análisis complejo',
    icon: 'ℂ',
    accent: '#F472B6',
    blurb: 'Needham: funciones complejas como mapas geométricos.',
    modules: [
      { id: 'mobius', name: 'Transformaciones de Möbius', status: 'live',
        blurb: 'w = (az+b)/(cz+d). Plano z, plano w, esfera de Riemann arriba.',
        childHint: 'Círculos siempre se convierten en círculos o rectas — y arriba todo es solo girar la esferita.',
        researcherHint: 'Edición compleja de a,b,c,d. Proyección estereográfica a S² con ∞ en el polo norte. Presets: Cayley, parabólica.',
        component: MobiusRiemann },
      { id: 'roots', name: 'Raíces y fractales de Newton', status: 'live',
        blurb: 'Newton-Raphson en ℂ → fractales por cuenca de atracción. Heightmap 3D real.',
        childHint: 'Cada color es "a dónde acabás" si empezás ahí. Las fronteras son infinitas.',
        researcherHint: '5 polinomios canónicos (z³−1, z⁴−1, z⁵−1, z³−z, Smale patológica). 121×121 vértices con altura ∝ iters.',
        component: NewtonFractals },
      { id: 'conformal', name: 'Mapas conformes', status: 'live',
        blurb: 'w = z + 1/z (Joukowski airfoil) + flujo potencial con condición de Kutta + disco de Poincaré.',
        childHint: 'Un círculo se vuelve un ala. Y el aire le pasa "gratis" alrededor.',
        researcherHint: 'Potencial Φ = U(z + R²e^(2iα)/z) + (Γ/2πi)log(z). Kutta: Γ = −4πUR·sin(α+β). RK4 sobre streamlines.',
        component: ConformalMaps },
    ],
  },

  {
    id: 'diffeq',
    name: 'Ecuaciones diferenciales',
    icon: 'Ψ',
    accent: '#FDB813',
    blurb: 'EDO/EDP: cómo el cambio se propaga.',
    modules: [
      { id: 'phase-portrait', name: 'Retrato de fases 2D', status: 'live',
        blurb: 'ẋ=f, ẏ=g. Campo vectorial + click → trayectoria RK4. Lotka-Volterra, van der Pol, péndulo no-lineal.',
        childHint: 'Click en el plano → sueltas una hojita que sigue la corriente del río.',
        researcherHint: 'RK4 fwd+bck, picard-lindelöf (no se cruzan). 6 presets canónicos.',
        component: PhasePortrait },
      { id: 'heat-1d', name: 'Ecuación del calor 1D', status: 'planned',
        blurb: '∂u/∂t = α ∂²u/∂x². Difusión visualizada en tiempo real.',
        roadmap: ['Crank-Nicolson + condiciones Dirichlet/Neumann', 'Comparar con solución por Fourier'] },
      { id: 'wave-1d', name: 'Ecuación de onda 1D', status: 'planned',
        blurb: 'Pulso que viaja, reflexión, ondas estacionarias.',
        roadmap: ['FDTD + medios con velocidad variable'] },
    ],
  },

  {
    id: 'topology',
    name: 'Topología & geometría',
    icon: '◯',
    accent: '#34D399',
    blurb: 'Hatcher y Needham geometría: forma sin distancia.',
    modules: [
      { id: 'genus', name: 'Género de superficies', status: 'planned',
        blurb: 'Esfera, toro, doble toro. Característica de Euler.',
        roadmap: ['Mallas triangulares con V−E+F', 'Deformación continua → invariancia'] },
      { id: 'mobius-strip', name: 'Banda de Möbius y Klein', status: 'planned',
        blurb: 'Orientabilidad. Visualización 3D + corte longitudinal.',
        roadmap: ['Banda paramétrica + animación de "viajero" cruzando el borde'] },
      { id: 'geodesics', name: 'Geodésicas en superficies curvas', status: 'planned',
        blurb: 'Camino más corto en una esfera, toro, silla. ¿Por qué los aviones vuelan así?',
        roadmap: ['Integrar ecuación geodésica con símbolos de Christoffel'] },
      { id: 'knots', name: 'Nudos', status: 'planned',
        blurb: 'Trébol, ocho, suma conexa. Invariantes elementales.',
        roadmap: ['Diagramas + cálculo de invariantes básicos (crossing number, polinomio de Alexander)'] },
    ],
  },

  {
    id: 'probability',
    name: 'Probabilidad & estadística',
    icon: 'ℙ',
    accent: '#EF5350',
    blurb: 'Distribuciones, teorema del límite central, Markov.',
    modules: [
      { id: 'central-limit', name: 'Teorema del límite central', status: 'planned',
        blurb: 'Cualquier suma → gaussiana. Demo en vivo con muchas distribuciones.',
        roadmap: ['Slider N + selector de distribución base', 'Convergencia visual del histograma'] },
      { id: 'markov', name: 'Cadenas de Markov', status: 'planned',
        blurb: 'Estados → matriz → distribución estacionaria. PageRank.',
        roadmap: ['Editor de grafo dirigido con pesos', 'Iteración de potencias'] },
      { id: 'monte-carlo', name: 'Monte Carlo', status: 'planned',
        blurb: 'Integración por sorteo. π con dardos, Buffon.',
        roadmap: ['Visualizar dardos cayendo en el cuadrado/disco'] },
    ],
  },

  {
    id: 'foundations',
    name: 'Fundamentos & lógica',
    icon: '∅',
    accent: '#94A3B8',
    blurb: 'Conjuntos, lógica, demostración constructiva.',
    modules: [
      { id: 'sets', name: 'Conjuntos y operaciones', status: 'planned',
        blurb: 'Unión, intersección, complemento. Diagramas de Venn 3D para 4+ conjuntos.',
        roadmap: ['Venn de 3, 4, 5 conjuntos', 'Editor interactivo de elementos'] },
      { id: 'logic', name: 'Lógica proposicional', status: 'planned',
        blurb: 'Tablas de verdad, Karnaugh, circuitos lógicos.',
        roadmap: ['Editor de fórmula → tabla + mapa K + circuito'] },
      { id: 'proof', name: 'Asistente de demostración', status: 'planned',
        blurb: 'Inducción, contradicción, casos. Verificación paso a paso.',
        roadmap: ['Mini-lenguaje tipo Lean educativo'] },
    ],
  },
];

export function findModule(branchId: string, moduleId: string) {
  const br = BRANCHES.find(b => b.id === branchId);
  const mo = br?.modules.find(m => m.id === moduleId);
  return { branch: br, module: mo };
}
