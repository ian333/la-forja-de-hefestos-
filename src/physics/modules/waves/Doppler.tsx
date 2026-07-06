/**
 * Efecto Doppler 3D — f' = f·(c ± v_o)/(c ∓ v_s)
 *
 * FÍSICA REAL:
 *   La fuente emite frentes de onda esféricos a intervalos T = 1/f.
 *   Si la fuente se mueve a velocidad vs, los frentes que emite hacia
 *   adelante quedan más apretados (λ' = λ(1 - vs/c)); hacia atrás,
 *   más separados (λ' = λ(1 + vs/c)).
 *
 *   Fórmula general (observador a vel vo, fuente a vel vs, en la misma línea):
 *     f' = f · (c + vo) / (c + vs)   [observador acercándose, fuente alejándose]
 *     f' = f · (c ± vo) / (c ∓ vs)   (signo + arriba si se acercan)
 *
 *   Cono de Mach (vs > c):
 *     sin(α) = c / vs   →   α = arcsin(c/vs)
 *   El número de Mach M = vs/c define el ángulo del boom sónico.
 *
 * VISUALIZACIÓN 3D CINE:
 *   - Frentes de onda = esferas wireframe emisivas (THREE.Mesh + EdgesGeometry)
 *     que nacen en la posición de emisión y se expanden a velocidad c.
 *   - La fuente es una esfera naranja emisiva moviéndose horizontalmente.
 *   - Un observador (esfera cyan) se puede poner a distintas posiciones.
 *   - La sombra del cono de Mach se dibuja cuando M > 1 (dos líneas desde la fuente).
 *   - Punto-cloud aditivo (rastro de la fuente): magenta / ámbar.
 *   - HUD: f observada en tiempo real calculada analíticamente.
 *
 * REGLA useFrame: SOLO en sub-componentes hijos de <Stage> (dentro del Canvas).
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Tipos ─────────────────────────────────────────────────────────────

type SceneId = 'subsonic' | 'approaching' | 'receding' | 'mach1' | 'mach15';

interface DopplerLessonState {
  sceneId: SceneId;
}

// ── Constantes de simulación ──────────────────────────────────────────

/** Velocidad del sonido en unidades de mundo (metros/s virtuales) */
const C_SOUND = 3.0;
/** Frecuencia de emisión (Hz en sim) */
const F0 = 1.4;
/** Número máximo de frentes de onda vivos */
const MAX_FRONTS = 40;
/** Tamaño de la pista de movimiento de la fuente */
const TRACK_LEN = 14;

// ── Lección pedagógica ────────────────────────────────────────────────

const LESSON: Lesson<DopplerLessonState> = {
  hook: {
    title: 'Una ambulancia que se acerca suena más aguda. Una que se aleja, más grave. ¿Por qué?',
    body: `No es que el motor cambie. Es que el espacio entre los frentes de onda se COMPRIME cuando la fuente se acerca y se EXPANDE cuando se aleja.

La frecuencia que oyes no es la que emite la fuente — es la que llega a tu oído, que depende de cuántos frentes por segundo te golpean.

Si la fuente va a vs y el sonido a c:
  f' = f · (c + vo) / (c − vs)   [fuente acercándose]
  f' = f · (c + vo) / (c + vs)   [fuente alejándose]

Y si la fuente supera la velocidad del sonido (vs > c): los frentes se acumulan en un cono. Boom sónico. F-22, vuelos comerciales, explosivos.

Esta visualización muestra los frentes esféricos que la fuente deja en el espacio — la geometría que produce el efecto.`,
  },

  steps: [
    {
      title: 'Fuente estática — frentes concéntricos',
      duration: 6000,
      body: `La fuente no se mueve (vs = 0). Emite frentes esféricos perfectamente concéntricos — como anillos en el agua cuando cae una piedra vertical.

Cada frente se expande a velocidad c del sonido. La separación entre frentes es λ = c/f, constante en todas las direcciones.

El observador en cualquier punto recibe exactamente f frentes por segundo — la frecuencia original. No hay efecto Doppler.

Esta es la línea base. La SIMETRÍA radial de los frentes te dice: sin movimiento, sin efecto.`,
      formula: 'vs = 0  →  f\' = f\nλ = c / f (igual en todas las direcciones)',
      keyframes: [
        { at: 0, state: { sceneId: 'subsonic' } },
        { at: 1, state: { sceneId: 'subsonic' } },
      ],
    },
    {
      title: 'Fuente acercándose — compresión al frente',
      duration: 6500,
      body: `La fuente se mueve hacia el observador a vs = 0.5·c. Los frentes que emite hacia adelante (hacia el observador) están comprimidos — la fuente "alcanza" sus propios frentes anteriores.

Longitud de onda efectiva al frente:  λ_frente = (c − vs)·T = λ·(1 − M)

El observador cuenta MÁS frentes por segundo → f' > f. El sonido se escucha MÁS AGUDO.

Hacia atrás pasa lo opuesto: los frentes se separan, λ_atrás = λ(1 + M), f' < f.

Los frentes ya no son concéntricos — son esferas descentradas, cada una con centro donde estaba la fuente cuando la emitió.`,
      formula: 'f\'_frente = f · c / (c − vs)\nM = vs / c = 0.5  →  f\' = 2f',
      keyframes: [
        { at: 0, state: { sceneId: 'approaching' } },
        { at: 1, state: { sceneId: 'approaching' } },
      ],
    },
    {
      title: 'Fuente alejándose — expansión al frente',
      duration: 6000,
      body: `La fuente se aleja del observador. Los frentes detrás de ella (hacia el observador) se separan — la fuente "huye" de sus frentes emitidos.

El observador cuenta MENOS frentes por segundo → f' < f. El sonido se escucha MÁS GRAVE.

Fórmula:  f' = f · c / (c + vs)

Si vs = 0.5·c:  f' = f · 3/3 · 2/3 = f · 2/3. La frecuencia cae a 2/3 de la original.

Esto es exactamente lo que se escucha cuando pasa una ambulancia: agudo al acercarse, grave al alejarse. El cambio ocurre en el instante exacto en que pasa frente a ti.`,
      formula: 'f\'_atrás = f · c / (c + vs)\nM = 0.5  →  f\' = (2/3)·f',
      keyframes: [
        { at: 0, state: { sceneId: 'receding' } },
        { at: 1, state: { sceneId: 'receding' } },
      ],
    },
    {
      title: 'Mach 1 — la barrera del sonido',
      duration: 7000,
      body: `La fuente alcanza la velocidad del sonido: vs = c (M = 1).

Los frentes que emite hacia adelante NO pueden avanzar — la fuente va exactamente a la misma velocidad que el sonido. Todos los frentes se acumulan en UN SOLO PLANO frente a la fuente.

La presión se acumula: la "barrera del sonido" en aviación es literalmente este apilamiento de ondas.

En el límite M→1 desde abajo: f' → ∞ (el denominador c − vs → 0). La frecuencia observada diverge.

Cruzar Mach 1 requiere motores de gran empuje porque hay que romper esa muralla de presión acumulada.`,
      formula: 'vs = c  (M = 1)\nc − vs = 0  →  f\' → ∞\nFrente de onda se colapsa en un plano',
      keyframes: [
        { at: 0, state: { sceneId: 'mach1' } },
        { at: 1, state: { sceneId: 'mach1' } },
      ],
    },
    {
      title: 'Mach 1.5 — cono de Mach y boom sónico',
      duration: 7500,
      body: `La fuente supera la velocidad del sonido: vs = 1.5·c (M = 1.5).

La fuente deja atrás sus propios frentes de onda. Estos se acumulan en un CONO — el cono de Mach. El ángulo del cono satisface:

sin(α) = c / vs = 1/M

Para M = 1.5:  α = arcsin(1/1.5) = 41.8°

El cono marca el frente de onda de choque. Alguien fuera del cono no escucha NADA — la fuente ya pasó y los frentes aún no llegaron. Cuando el cono pasa sobre ti: boom sónico. Es instantáneo.

Los aviones militares supersónicos, los meteoritos, y la bala de un rifle producen este cono.`,
      formula: 'sin α = c / vs = 1/M\nM = 1.5  →  α = 41.8°\n"Boom sónico" = paso del cono de Mach',
      keyframes: [
        { at: 0, state: { sceneId: 'mach15' } },
        { at: 1, state: { sceneId: 'mach15' } },
      ],
    },
  ],

  connect: {
    body: `El efecto Doppler ocurre con CUALQUIER onda — sonido, luz, radio.

Aplicaciones reales que cambiaron el mundo:

• Astronomía: Edwin Hubble midió el corrimiento al rojo de galaxias lejanas usando el Doppler de la luz. Galaxias que se alejan tienen espectro corrido al rojo (redshift). Eso probó que el universo SE EXPANDE.
• Radar y LIDAR: la policía de tránsito mide tu velocidad con el Doppler de microondas. Los weatherradar miden velocidad de lluvia.
• Medicina: ecografías Doppler miden la velocidad de la sangre en las arterias — detectan trombos, aneurismas, flujo fetal.
• Cosmología: el corrimiento al rojo cosmológico (z) mide la velocidad de recesión de galaxias — con eso calculamos la edad del universo (13.8 Ga).
• Aviación supersónica: el cono de Mach que viste es lo que limita los vuelos supersónicos sobre tierra (el boom es ilegal en zonas civiles).

La geometría simple de "frentes que se comprimen o expanden" conecta la bocina de una ambulancia con la expansión del universo.`,
    links: [
      { label: 'Ecuación de onda — frentes y propagación', href: '#wave-1d' },
      { label: 'Espectro de Fourier — descomponer frecuencias', href: '#fourier-series' },
      { label: 'Schwarzschild — gravedad y corrimiento espectral', href: '#schwarzschild' },
    ],
  },
};

// ── Configuración de escenas ──────────────────────────────────────────

interface SceneConfig {
  id: SceneId;
  label: string;
  vs: number;           // velocidad de la fuente en unidades c (Mach number)
  vsBullet: string;     // descripción
  observerX: number;    // posición X del observador (en el lado que "recibe")
}

const SCENES: SceneConfig[] = [
  { id: 'subsonic',   label: 'Estática (M=0)',      vs: 0,    vsBullet: 'M = 0 — Sin movimiento',            observerX:  5 },
  { id: 'approaching', label: 'Acercándose (M=0.5)', vs: 0.5,  vsBullet: 'M = 0.5 — Se acerca al observador', observerX:  5 },
  { id: 'receding',   label: 'Alejándose (M=0.5)',  vs: -0.5, vsBullet: 'M = 0.5 — Se aleja del observador',  observerX: -5 },
  { id: 'mach1',      label: 'Mach 1',              vs: 1.0,  vsBullet: 'M = 1.0 — Barrera del sonido',      observerX:  5 },
  { id: 'mach15',     label: 'Mach 1.5',            vs: 1.5,  vsBullet: 'M = 1.5 — Supersónico',             observerX:  5 },
];

// ── Frente de onda ────────────────────────────────────────────────────

interface WaveFront {
  /** posición donde se emitió */
  emitX: number;
  emitZ: number;
  /** radio actual (crece a C_SOUND) */
  radius: number;
  /** tiempo de vida restante (cuando radius > clipR, la removemos) */
  alive: boolean;
  /** age en segundos */
  age: number;
}

// ── Escena 3D — vive dentro del Canvas ───────────────────────────────

interface DopplerSceneProps {
  vs: number;           // mach number (positivo = fuente va a +X, negativo = −X)
  observerX: number;
  running: boolean;
  /** número de escena (para resetear al cambiar) */
  sceneKey: number;
}

function DopplerScene({ vs, observerX, running, sceneKey }: DopplerSceneProps) {
  // Posición de la fuente — oscila en la pista de −TRACK_LEN/2 a +TRACK_LEN/2
  const srcPos   = useRef(new THREE.Vector3(-TRACK_LEN / 2, 0, 0));
  const srcMesh  = useRef<THREE.Mesh>(null);
  const obsMesh  = useRef<THREE.Mesh>(null);

  // Lista de frentes de onda (no reactiva, mutada en useFrame)
  const fronts   = useRef<WaveFront[]>([]);
  // Referencias a los meshes de esferas de frente (pool fijo)
  const frontMeshes = useRef<(THREE.Mesh | null)[]>([]);
  // Tiempo acumulado desde la última emisión
  const emitTimer = useRef(0);
  // Tiempo de simulación
  const simTime   = useRef(0);

  // Rastro de la fuente
  const TRAIL_SIZE = 800;
  const trailPos   = useMemo(() => new Float32Array(TRAIL_SIZE * 3), []);
  const trailCol   = useMemo(() => new Float32Array(TRAIL_SIZE * 3), []);
  const trailGeom  = useRef<THREE.BufferGeometry>(null);
  const trailIdx   = useRef(0);
  const trailCnt   = useRef(0);

  // Cono de Mach (dos líneas)
  const coneMesh   = useRef<THREE.Group>(null);

  // Reset al cambiar escena
  useEffect(() => {
    srcPos.current.set(-TRACK_LEN / 2, 0, 0);
    fronts.current = [];
    emitTimer.current = 0;
    simTime.current = 0;
    trailIdx.current = 0;
    trailCnt.current = 0;
    // Limpiar rastro
    for (let i = 0; i < TRAIL_SIZE * 3; i++) { trailPos[i] = 0; trailCol[i] = 0; }
    // Ocultar todos los meshes de frentes
    for (const m of frontMeshes.current) {
      if (m) m.visible = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // Velocidad real de la fuente en unidades de mundo
  const vsReal = vs * C_SOUND;

  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(delta, 0.05);
    simTime.current += dt;

    // Mover fuente — si llega al extremo, la teletransportamos al inicio
    const dirSign = vsReal >= 0 ? 1 : -1;
    srcPos.current.x += vsReal * dt;
    // Wrap: fuente va de −TRACK/2 a +TRACK/2 (o al revés)
    if (dirSign > 0 && srcPos.current.x > TRACK_LEN / 2) {
      srcPos.current.x = -TRACK_LEN / 2;
      fronts.current = []; // limpiar frentes para nueva pasada
      trailIdx.current = 0; trailCnt.current = 0;
    } else if (dirSign < 0 && srcPos.current.x < -TRACK_LEN / 2) {
      srcPos.current.x = TRACK_LEN / 2;
      fronts.current = [];
      trailIdx.current = 0; trailCnt.current = 0;
    } else if (vsReal === 0) {
      srcPos.current.x = 0; // estática en el centro
    }

    if (srcMesh.current) {
      srcMesh.current.position.copy(srcPos.current);
    }

    // Emitir nuevo frente de onda
    emitTimer.current += dt;
    const T = 1 / F0;
    if (emitTimer.current >= T) {
      emitTimer.current -= T;
      if (fronts.current.length < MAX_FRONTS) {
        fronts.current.push({
          emitX: srcPos.current.x,
          emitZ: srcPos.current.z,
          radius: 0.01,
          alive: true,
          age: 0,
        });
      }
    }

    // Expandir frentes y sync con meshes
    const clipR = TRACK_LEN * 0.9;
    let mi = 0;
    for (let i = fronts.current.length - 1; i >= 0; i--) {
      const f = fronts.current[i];
      f.radius += C_SOUND * dt;
      f.age    += dt;
      if (f.radius > clipR) {
        fronts.current.splice(i, 1);
      }
    }

    // Sincronizar pool de meshes
    for (let i = 0; i < MAX_FRONTS; i++) {
      const m = frontMeshes.current[i];
      if (!m) continue;
      const f = fronts.current[i];
      if (f) {
        m.visible = true;
        m.position.set(f.emitX, 0, f.emitZ);
        const s = f.radius;
        m.scale.set(s, s, s);
        // Opacidad: fade in rapido, fade out al alejarse
        const fadeIn  = Math.min(1, f.age * 8);
        const fadeOut = Math.max(0, 1 - f.radius / clipR);
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.55 * fadeIn * fadeOut;
      } else {
        m.visible = false;
      }
      mi++;
    }

    // Rastro de la fuente
    const ti = trailIdx.current;
    trailPos[ti * 3 + 0] = srcPos.current.x;
    trailPos[ti * 3 + 1] = 0;
    trailPos[ti * 3 + 2] = srcPos.current.z;
    // Color ámbar si va hacia adelante, magenta si hacia atrás
    const goingRight = vsReal >= 0;
    trailCol[ti * 3 + 0] = goingRight ? 1.0 : 0.9;
    trailCol[ti * 3 + 1] = goingRight ? 0.6 : 0.2;
    trailCol[ti * 3 + 2] = goingRight ? 0.0 : 0.8;
    trailIdx.current = (ti + 1) % TRAIL_SIZE;
    trailCnt.current = Math.min(trailCnt.current + 1, TRAIL_SIZE);
    if (trailGeom.current) {
      const pa = trailGeom.current.attributes.position as THREE.BufferAttribute;
      const ca = trailGeom.current.attributes.color    as THREE.BufferAttribute;
      (pa.array as Float32Array).set(trailPos);
      (ca.array as Float32Array).set(trailCol);
      pa.needsUpdate = true;
      ca.needsUpdate = true;
      trailGeom.current.setDrawRange(0, trailCnt.current);
    }

    // Cono de Mach
    if (coneMesh.current) {
      const M = Math.abs(vs);
      if (M > 1.001) {
        coneMesh.current.visible = true;
        coneMesh.current.position.copy(srcPos.current);
        // Ángulo del cono: sin(alpha) = 1/M
        const alpha = Math.asin(1 / Math.min(M, 10));
        coneMesh.current.rotation.y = vsReal < 0 ? Math.PI : 0;
        // Escala Z (largo del cono) proporcional al rastro de la fuente
        const coneLen = TRACK_LEN;
        (coneMesh.current.children[0] as THREE.Mesh).scale.set(
          Math.tan(alpha) * coneLen,
          1,
          coneLen,
        );
        (coneMesh.current.children[1] as THREE.Mesh).scale.set(
          Math.tan(alpha) * coneLen,
          1,
          coneLen,
        );
      } else {
        coneMesh.current.visible = false;
      }
    }

    // Posición del observador
    if (obsMesh.current) {
      obsMesh.current.position.set(observerX, 0, 0);
    }
  });

  // Geometría de rastro
  const trailBufGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_SIZE * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_SIZE * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  // Calcular f' observada (analítica) para el observador en observerX
  // Convención: vs > 0 fuente va a +X (hacia observerX > 0)
  // Observer estático (vo = 0)
  // f' = f * c / (c - vs_proj)
  // vs_proj = vs si fuente se acerca (+X y observerX > srcX) o -vs si se aleja
  const M = vs;  // mach number con signo
  let fPrime: number;
  const vsSign = M >= 0 ? 1 : -1;
  // Signo correcto: si la fuente se mueve hacia el observador
  // fuente en −TRACK/2→+TRACK/2, observerX = +5 → fuente se acerca
  // fuente en +TRACK/2→−TRACK/2, observerX = −5 → fuente se acerca
  // Usamos la componente de velocidad de la fuente hacia el observador
  const approaching = (M > 0 && observerX > 0) || (M < 0 && observerX < 0);
  if (Math.abs(M) < 0.99) {
    fPrime = approaching
      ? F0 * C_SOUND / (C_SOUND - Math.abs(M) * C_SOUND)
      : F0 * C_SOUND / (C_SOUND + Math.abs(M) * C_SOUND);
  } else if (Math.abs(M) >= 0.99 && Math.abs(M) < 1.01) {
    fPrime = Infinity;
  } else {
    // supersónico: observador fuera del cono no escucha nada (boom)
    fPrime = 0; // o NaN, lo marcamos como "boom"
  }

  const machAngleDeg = Math.abs(M) > 1
    ? (Math.asin(Math.min(1, 1 / Math.abs(M))) * 180 / Math.PI).toFixed(1)
    : '—';

  return (
    <>
      {/* Grid de referencia en XZ */}
      <gridHelper
        args={[TRACK_LEN * 2, 28, '#0F172A', '#0F172A']}
        position={[0, -0.01, 0]}
      />

      {/* Eje de movimiento de la fuente */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, TRACK_LEN, 8]} />
        <meshStandardMaterial
          color="#1E293B"
          emissive="#0F172A"
          emissiveIntensity={0.4}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Pool de frentes de onda — esferas wireframe emisivas */}
      {Array.from({ length: MAX_FRONTS }, (_, i) => (
        <mesh
          key={i}
          ref={el => { frontMeshes.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial
            color="#4FC3F7"
            wireframe
            transparent
            opacity={0.0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Fuente de sonido — esfera naranja emisiva */}
      <mesh ref={srcMesh} position={[-TRACK_LEN / 2, 0, 0]}>
        <sphereGeometry args={[0.22, 32, 24]} />
        <meshStandardMaterial
          color="#F97316"
          emissive="#F97316"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Halo de la fuente (esfera más grande, muy transparente) */}
      <mesh ref={undefined} position={[-TRACK_LEN / 2, 0, 0]}>
        <sphereGeometry args={[0.44, 20, 16]} />
        <meshStandardMaterial
          color="#F97316"
          emissive="#F97316"
          emissiveIntensity={0.6}
          transparent
          opacity={0.15}
          toneMapped={false}
        />
      </mesh>

      {/* Observador — esfera cyan estática */}
      <mesh ref={obsMesh} position={[observerX, 0, 0]}>
        <sphereGeometry args={[0.18, 32, 24]} />
        <meshStandardMaterial
          color="#06B6D4"
          emissive="#06B6D4"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>

      {/* Anillo del observador */}
      <mesh position={[observerX, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.025, 8, 48]} />
        <meshStandardMaterial
          color="#06B6D4"
          emissive="#06B6D4"
          emissiveIntensity={1.2}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>

      {/* Cono de Mach (dos planos inclinados como alas) */}
      <group ref={coneMesh} visible={false}>
        {/* Ala superior */}
        <mesh>
          {/* Un plano que actúa como ala del cono */}
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#EF4444"
            side={THREE.DoubleSide}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* Ala inferior (simétrica en Y) */}
        <mesh rotation={[0, 0, Math.PI]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#EF4444"
            side={THREE.DoubleSide}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Rastro de la fuente — point cloud aditivo */}
      <points ref={trailGeom} geometry={trailBufGeom}>
        <pointsMaterial
          vertexColors
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* HUD flotante 3D — f' en tiempo real */}
      <HudLabel
        fPrime={fPrime}
        machAngleDeg={machAngleDeg}
        M={M}
        observerX={observerX}
        approaching={approaching}
      />
    </>
  );
}

// ── Etiqueta HUD 3D (esfera luminosa con texto como overlay DOM) ───────

// Componente separado para evitar problemas con drei Text
function HudLabel({
  fPrime, machAngleDeg, M, observerX, approaching,
}: {
  fPrime: number;
  machAngleDeg: string;
  M: number;
  observerX: number;
  approaching: boolean;
}) {
  // No usamos drei Text — siguiendo las reglas del proyecto
  // El HUD real está en el overlay DOM (ver componente raíz)
  return null;
}


// ── SubEscena con cono dinámico en useFrame ───────────────────────────

interface ConeSceneProps {
  vs: number;
  sceneKey: number;
  running: boolean;
}

function ConeTracker({ vs, sceneKey, running }: ConeSceneProps) {
  const srcXRef = useRef(-TRACK_LEN / 2);
  const emitTimer = useRef(0);

  const line1pts = useMemo(() => new Float32Array(6), []);
  const line2pts = useMemo(() => new Float32Array(6), []);
  const line1Ref = useRef<THREE.BufferAttribute>(null);
  const line2Ref = useRef<THREE.BufferAttribute>(null);

  useEffect(() => {
    srcXRef.current = -TRACK_LEN / 2;
    emitTimer.current = 0;
  }, [sceneKey]);

  const M = Math.abs(vs);

  useFrame((_, delta) => {
    if (!running || M <= 1.001) return;
    const dt = Math.min(delta, 0.05);
    const vsReal = vs * C_SOUND;
    const dirSign = vsReal >= 0 ? 1 : -1;
    srcXRef.current += vsReal * dt;
    if (dirSign > 0 && srcXRef.current > TRACK_LEN / 2)  srcXRef.current = -TRACK_LEN / 2;
    if (dirSign < 0 && srcXRef.current < -TRACK_LEN / 2) srcXRef.current =  TRACK_LEN / 2;

    const alpha = Math.asin(1 / Math.min(M, 10));
    const sx    = srcXRef.current;
    const cDir  = vs > 0 ? -1 : 1; // cono apunta hacia atrás del movimiento
    const len   = TRACK_LEN;
    const bx    = sx + cDir * Math.cos(alpha) * len;
    const bz    = Math.sin(alpha) * len;

    line1pts[0] = sx; line1pts[1] = 0; line1pts[2] = 0;
    line1pts[3] = bx; line1pts[4] = 0; line1pts[5] =  bz;
    line2pts[0] = sx; line2pts[1] = 0; line2pts[2] = 0;
    line2pts[3] = bx; line2pts[4] = 0; line2pts[5] = -bz;

    if (line1Ref.current) { (line1Ref.current.array as Float32Array).set(line1pts); line1Ref.current.needsUpdate = true; }
    if (line2Ref.current) { (line2Ref.current.array as Float32Array).set(line2pts); line2Ref.current.needsUpdate = true; }
  });

  if (M <= 1.001) return null;

  const initPts = new Float32Array([0,0,0, 0,0,0]);

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute
            ref={line1Ref}
            attach="attributes-position"
            count={2}
            array={initPts.slice()}
            itemSize={3}
            args={[initPts.slice(), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#EF4444" linewidth={3} toneMapped={false} transparent opacity={0.85} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            ref={line2Ref}
            attach="attributes-position"
            count={2}
            array={initPts.slice()}
            itemSize={3}
            args={[initPts.slice(), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#EF4444" linewidth={3} toneMapped={false} transparent opacity={0.85} />
      </line>
    </>
  );
}

// ── Componente exportado ──────────────────────────────────────────────

export default function Doppler() {
  const { audience } = useAudience();

  const [sceneId,  setSceneId]  = useState<SceneId>('subsonic');
  const [running,  setRunning]  = useState(true);
  const [sceneKey, setSceneKey] = useState(0);

  const scene = SCENES.find(s => s.id === sceneId)!;
  const vs    = scene.vs;
  const M     = Math.abs(vs);

  const resetScene = useCallback((newId?: SceneId) => {
    if (newId) setSceneId(newId);
    setSceneKey(k => k + 1);
  }, []);

  // Calcular f' observada analíticamente (para el HUD)
  const fPrimeStr = useMemo(() => {
    const approaching = (vs > 0 && scene.observerX > 0) || (vs < 0 && scene.observerX < 0);
    if (M < 0.001) return F0.toFixed(2);
    if (M >= 0.99 && M <= 1.01) return '∞';
    if (M > 1.01) return '0 (boom)';
    if (approaching) {
      return (F0 * C_SOUND / (C_SOUND - M * C_SOUND)).toFixed(2);
    } else {
      return (F0 * C_SOUND / (C_SOUND + M * C_SOUND)).toFixed(2);
    }
  }, [vs, M, scene.observerX]);

  const machAngleDeg = M > 1
    ? (Math.asin(Math.min(1, 1 / M)) * 180 / Math.PI).toFixed(1)
    : '—';

  const approaching = (vs > 0 && scene.observerX > 0) || (vs < 0 && scene.observerX < 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">

      {/* ── Canvas R3F ──────────────────────────────────────────────── */}
      <div className="relative">
        <Stage
          cameraDistance={TRACK_LEN * 0.85}
          bloomIntensity={0.95}
          bloomThreshold={0.08}
          autoRotate
          bgColor="#05060A"
          enablePan
        >
          <DopplerScene
            vs={vs}
            observerX={scene.observerX}
            running={running}
            sceneKey={sceneKey}
          />
          <ConeTracker
            vs={vs}
            sceneKey={sceneKey}
            running={running}
          />
        </Stage>

        {/* HUD overlay */}
        <div className="absolute top-3 left-3 rounded-lg bg-[#05060A]/85 backdrop-blur
                        border border-[#1E293B] px-3 py-2.5 font-mono text-[11px]
                        text-[#CBD5E1] space-y-1.5 min-w-[190px]">
          <div className="text-[#64748B] text-[10px] uppercase tracking-wider mb-1">Efecto Doppler</div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">f (fuente)</span>
            <span className="text-white">{F0.toFixed(2)} Hz</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">f′ (obs.)</span>
            <span className={
              fPrimeStr === '∞' ? 'text-[#EF4444]' :
              fPrimeStr.includes('boom') ? 'text-[#F97316]' :
              approaching ? 'text-[#34D399]' : 'text-[#F59E0B]'
            }>
              {fPrimeStr} Hz
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">M = vs/c</span>
            <span className={M > 1 ? 'text-[#EF4444]' : M > 0.7 ? 'text-[#F59E0B]' : 'text-white'}>
              {M.toFixed(2)}
            </span>
          </div>
          {M > 1 && (
            <div className="flex justify-between gap-4">
              <span className="text-[#64748B]">α (Mach)</span>
              <span className="text-[#EF4444]">{machAngleDeg}°</span>
            </div>
          )}
          <div className="flex gap-1.5 mt-1 text-[10px]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#F97316] mt-0.5" />
            <span className="text-[#64748B]">fuente</span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#06B6D4] mt-0.5 ml-2" />
            <span className="text-[#64748B]">observador</span>
          </div>
        </div>

        {/* Barra de controles */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2
                        bg-[#05060A]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <CtrlBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </CtrlBtn>
          <CtrlBtn onClick={() => resetScene()} title="Reiniciar escena">↺</CtrlBtn>
        </div>
      </div>

      {/* ── Panel pedagógico ────────────────────────────────────────── */}
      <LessonPanel<DopplerLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.sceneId !== undefined) {
            setSceneId(patch.sceneId);
            setSceneKey(k => k + 1);
          }
        }}
        sandbox={
          <>
            {/* Escenas */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Escena</div>
              <div className="space-y-1.5">
                {SCENES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => resetScene(s.id)}
                    className={`w-full text-left text-[11px] px-2.5 py-1.5 rounded border transition ${
                      sceneId === s.id
                        ? 'bg-[#F97316]/15 border-[#F97316]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#F97316]/30 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-[10px] text-[#64748B]">{s.vsBullet}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Estado en vivo */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Física en vivo</div>
              <div className="space-y-1 text-[11px] font-mono">
                <MonoRow label="f₀ (emisión)"  value={`${F0.toFixed(3)} Hz`} />
                <MonoRow label="c (sonido)"    value={`${C_SOUND.toFixed(2)} u/s`} />
                <MonoRow label="vs"            value={`${(Math.abs(vs) * C_SOUND).toFixed(2)} u/s`} />
                <MonoRow label="M = vs/c"      value={M.toFixed(3)} alert={M > 1} />
                <MonoRow label="f′ (obs.)"     value={`${fPrimeStr} Hz`} />
                {M > 1 && (
                  <MonoRow label="α cono"      value={`${machAngleDeg}°`} />
                )}
                {M > 0 && M < 0.99 && (
                  <MonoRow
                    label={approaching ? 'Δf (agudo)' : 'Δf (grave)'}
                    value={approaching
                      ? `+${((F0 * C_SOUND / (C_SOUND - M * C_SOUND)) - F0).toFixed(3)}`
                      : `-${(F0 - F0 * C_SOUND / (C_SOUND + M * C_SOUND)).toFixed(3)}`}
                  />
                )}
              </div>
            </div>

            {/* Ecuación siempre visible */}
            <div className="p-3 border-b border-[#1E293B]">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Fórmula</div>
              <pre className="text-[10px] font-mono text-[#FDB813] bg-[#05060A]
                             border border-[#1E293B] rounded px-2 py-1.5
                             whitespace-pre-wrap leading-relaxed">
{`f' = f · (c ± vo) / (c ∓ vs)

vs > 0 → fuente acercándose:
  f' = f·c/(c−vs)

vs < 0 → fuente alejándose:
  f' = f·c/(c+vs)

M>1: sin α = c/vs (cono de Mach)`}
              </pre>
            </div>

            {/* Detalles para researcher */}
            {audience === 'researcher' && (
              <div className="p-3 text-[10px] text-[#64748B] leading-relaxed border-b border-[#1E293B]">
                <div className="text-[#94A3B8] font-semibold mb-1">Detalles numéricos</div>
                <div>Frentes: esferas que crecen a c={C_SOUND} u/s desde la posición de emisión.</div>
                <div>f₀={F0} Hz → T={`${(1/F0).toFixed(3)}`} s entre frentes.</div>
                <div>M={'>'} 1: frentes forman cono, sin α = 1/M.</div>
                <div>La simulación es cinemática pura (no FDTD): los radios crecen analíticamente.</div>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────

function CtrlBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#F97316]/60 text-[#F97316] bg-[#F97316]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function MonoRow({
  label, value, alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={alert ? 'text-[#EF4444]' : 'text-white'}>{value}</span>
    </div>
  );
}
