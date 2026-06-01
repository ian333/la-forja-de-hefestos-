/**
 * BHRaytraced — raytracing GLSL de geodésicas Schwarzschild en tiempo real.
 *
 * Un único fragment shader fullscreen que para cada pixel:
 *   1. Lanza un rayo desde la cámara
 *   2. Integra la geodésica con el potencial gravitacional 1/r²
 *      hasta ~140 pasos (adaptativos: chicos cerca del BH, grandes lejos)
 *   3. Detecta cruces del plano del disco (y = 0) usando interpolación lineal
 *      entre pasos consecutivos → permite ver el disco del lado de ATRÁS
 *      doblado por encima/abajo del BH (la "ceja" de Interstellar)
 *   4. En cada cruce: T(r) ∝ r⁻³ᐟ⁴ (Shakura-Sunyaev), Doppler δ⁴, redshift
 *   5. Si cae a r < rs · 1.01 → sombra negra
 *   6. Si escapa al infinito → samplea starfield (Vía Láctea + estrellas como
 *      puntos físicos, no como bloques de rejilla)
 *
 * Resultado: imagen "Interstellar-style" sin ray-tracing offline. Es la misma
 * técnica de aproximación que usaba el Double Negative paper de Thorne para
 * los renders cinematográficos preliminares.
 *
 * No simula Kerr (no hay ergosfera, no hay frame dragging). El spin solo
 * cambia r_ISCO para que el disco se vea con borde interior más cercano al
 * horizonte en presets como Gargantua.
 */

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface BHRaytracedProps {
  /** Radio Schwarzschild en unidades de escena (1.0 = referencia) */
  rs?: number;
  /** Inner edge del disco en unidades de r_s */
  rIn?: number;
  /** Outer edge del disco en unidades de r_s */
  rOut?: number;
  /** 0 = sin disco; 1 = lleno */
  diskOpacity?: number;
  /** Inclinación del disco respecto a la línea de visión (grados, 0 = de frente, 90 = canto) */
  inclinationDeg?: number;
  /** Brillo del Doppler beaming. 1 = físico real (δ⁴). Bájalo para uniformizar. */
  dopplerStrength?: number;
  /** Densidad de estrellas del fondo */
  starDensity?: number;
  /** Seed para variación entre escenas */
  starSeed?: number;
  /** Color tinte del disco (default cálido) */
  diskTint?: string;
  /** Mostrar el anillo de fotones (boost luminoso en el rim de la sombra) */
  photonRing?: boolean;
  /** Si se define (≥0), fuerza el tiempo de animación del disco (render determinista). */
  animTime?: number;
  /** Exposición global del HDR antes del tonemap. Reemplaza el *1.5 hardcodeado. Default 1.5. */
  exposure?: number;
  /**
   * Si true: NO aplica ACES inline; emite HDR LINEAL para que el postFX externo
   * (CinematicPostFX) haga el tonemap UNA sola vez. Evita el doble tonemap.
   * Default false (comportamiento legacy: ACES inline + gamma).
   */
  linearOutput?: boolean;
  /** Brillo del fondo nebular lensado (estrellas + Vía Láctea). Default 1. */
  nebulaBoost?: number;
  /** Separación R/G/B (aberración cromática) en los bordes muy lensados. Default 0. */
  chromaticAberration?: number;
  /**
   * Inyección SÍNCRONA opcional (render determinista frame-a-frame): si se pasa,
   * su retorno SOBREESCRIBE animTime/exposure/chromaticAberration en CADA useFrame,
   * leyendo de un ref escrito en el mismo tick (cero skew de 1 frame vs la cámara,
   * cero setState en el camino de render). NO toca la física del shader: solo son
   * los mismos uniforms ya existentes, alimentados por un ref en vez de por estado.
   * Si devuelve undefined para un campo, se usa el prop normal.
   */
  getDynamic?: () => { animTime?: number; exposure?: number; chromaticAberration?: number } | undefined;
  /**
   * Tope de pasos del raymarch de geodésicas. Default 200 (precisión científica
   * de la photon sphere). Bajarlo (p.ej. 110) ALIGERA el shader para render 4K sin
   * disparar el TDR del GPU (WSL/D3D12 resetea la GPU si un frame tarda >~2s). 110
   * basta para el disco/lensing cinemático; 200 para la precisión del anillo.
   */
  maxSteps?: number;
}

export default function BHRaytraced({
  rs = 1.0,
  rIn = 3.0,
  rOut = 14.0,
  diskOpacity = 1.0,
  inclinationDeg = 78,
  dopplerStrength = 1.0,
  starDensity = 1.0,
  starSeed = 0.0,
  diskTint = '#FFE0A0',
  photonRing = true,
  animTime,
  exposure = 1.5,
  linearOutput = false,
  nebulaBoost = 1,
  chromaticAberration = 0,
  getDynamic,
  maxSteps = 200,
}: BHRaytracedProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const diskTintVec = useMemo(() => {
    const c = new THREE.Color(diskTint);
    return new THREE.Vector3(c.r, c.g, c.b);
  }, [diskTint]);

  // Disk normal — rotated by inclination around X axis
  const diskNormal = useMemo(() => {
    const incl = (90 - inclinationDeg) * Math.PI / 180;
    return new THREE.Vector3(0, Math.cos(incl), Math.sin(incl)).normalize();
  }, [inclinationDeg]);

  // Uniforms ESTABLES (creados una sola vez). NUNCA inline en el JSX: un objeto
  // nuevo por render hace que R3F reasigne material.uniforms y se pierdan las
  // updates GPU — sobre todo si el componente re-renderiza (p.ej. animTime prop).
  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uRs:         { value: rs },
    uRIn:        { value: rIn * rs },
    uROut:       { value: rOut * rs },
    uDiskAlpha:  { value: diskOpacity },
    uDopplerK:   { value: dopplerStrength },
    uStarDensity:{ value: starDensity },
    uStarSeed:   { value: starSeed },
    uDiskTint:   { value: diskTintVec.clone() },
    uPhotonRing: { value: photonRing ? 1.0 : 0.0 },
    uDiskNormal: { value: diskNormal.clone() },
    uCamPos:     { value: new THREE.Vector3() },
    uCamFwd:     { value: new THREE.Vector3() },
    uCamRight:   { value: new THREE.Vector3() },
    uCamUp:      { value: new THREE.Vector3() },
    uTanHalfFov: { value: 0.4 },
    uAspect:     { value: 1.0 },
    uExposure:   { value: exposure },
    uLinearOut:  { value: linearOutput ? 1.0 : 0.0 },
    uNebulaBoost:{ value: nebulaBoost },
    uChromAb:    { value: chromaticAberration },
    uMaxSteps:   { value: maxSteps },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // refs a los props vivos → se leen en useFrame sin recrear los uniforms
  const propsRef = useRef({ rs, rIn, rOut, diskOpacity, dopplerStrength, starDensity, starSeed, photonRing, animTime, diskTintVec, diskNormal, exposure, linearOutput, nebulaBoost, chromaticAberration, getDynamic, maxSteps });
  propsRef.current = { rs, rIn, rOut, diskOpacity, dopplerStrength, starDensity, starSeed, photonRing, animTime, diskTintVec, diskNormal, exposure, linearOutput, nebulaBoost, chromaticAberration, getDynamic, maxSteps };

  useFrame(({ clock, camera }) => {
    const u = uniforms;
    const c = propsRef.current;
    // Inyección síncrona opcional (render determinista): sobreescribe los mismos
    // uniforms con valores leídos de un ref en el MISMO tick (cero skew, cero state).
    const dyn = c.getDynamic ? c.getDynamic() : undefined;
    const animTimeV = dyn?.animTime ?? c.animTime;
    const exposureV = dyn?.exposure ?? c.exposure;
    const chromAbV = dyn?.chromaticAberration ?? c.chromaticAberration;
    u.uTime.value = (animTimeV !== undefined && animTimeV >= 0) ? animTimeV : clock.elapsedTime;
    u.uRs.value = c.rs;
    u.uRIn.value = c.rIn * c.rs;
    u.uROut.value = c.rOut * c.rs;
    u.uDiskAlpha.value = c.diskOpacity;
    u.uDopplerK.value = c.dopplerStrength;
    u.uStarDensity.value = c.starDensity;
    u.uStarSeed.value = c.starSeed;
    u.uPhotonRing.value = c.photonRing ? 1.0 : 0.0;
    u.uDiskTint.value.copy(c.diskTintVec);
    u.uDiskNormal.value.copy(c.diskNormal);
    u.uExposure.value = exposureV;
    u.uLinearOut.value = c.linearOutput ? 1.0 : 0.0;
    u.uNebulaBoost.value = c.nebulaBoost;
    u.uChromAb.value = chromAbV;
    u.uMaxSteps.value = c.maxSteps;
    u.uCamPos.value.copy(camera.position);
    // Camera basis for ray construction in shader
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    u.uCamFwd.value.copy(fwd);
    u.uCamRight.value.copy(right);
    u.uCamUp.value.copy(up);
    const fovY = (camera as THREE.PerspectiveCamera).fov * Math.PI / 180;
    u.uTanHalfFov.value = Math.tan(fovY / 2);
    u.uAspect.value = size.width / size.height;
  });

  return (
    <mesh ref={meshRef} renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        depthWrite={false}
        depthTest={false}
        transparent={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uRs;
  uniform float uRIn;
  uniform float uROut;
  uniform float uDiskAlpha;
  uniform float uDopplerK;
  uniform float uStarDensity;
  uniform float uStarSeed;
  uniform vec3  uDiskTint;
  uniform float uPhotonRing;

  uniform vec3  uDiskNormal;
  uniform vec3  uCamPos;
  uniform vec3  uCamFwd;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;
  uniform float uTanHalfFov;
  uniform float uAspect;
  uniform float uExposure;     // exposición global del HDR antes del tonemap
  uniform float uLinearOut;    // 1.0 = emite HDR lineal (postFX hace ACES); 0.0 = ACES inline
  uniform float uNebulaBoost;  // brillo del fondo nebular lensado
  uniform float uChromAb;      // separación R/G/B en bordes muy lensados
  uniform float uMaxSteps;     // tope de pasos del raymarch (200 default; 110 para 4K)

  // ── Hashes ──────────────────────────────────────────────────────────
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1, 0));
    float c = hash21(i + vec2(0, 1));
    float d = hash21(i + vec2(1, 1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise2(p);
      p *= 2.07;
      a *= 0.5;
    }
    return v;
  }

  // ── Starfield: puntos finos (no rejilla cuadrada) ──────────────────
  // Trick: usamos hash sobre la dirección esférica con threshold MUY alto.
  // En vez de rejilla cúbica, usamos dos hashes ortogonales para evitar artefactos.
  vec3 stars(vec3 dir) {
    dir = normalize(dir);
    // Coords esféricas
    float theta = atan(dir.z, dir.x);
    float phi = asin(clamp(dir.y, -1.0, 1.0));

    vec3 col = vec3(0.0);

    // Cuatro capas Halton-like: dispersas + algunas brillantes
    for (int layer = 0; layer < 4; layer++) {
      float scale = 350.0 * pow(1.55, float(layer));
      vec2 uvS = vec2(theta * scale, phi * scale * 2.0) + vec2(uStarSeed * 17.7 + float(layer) * 4.1, uStarSeed * 31.3 + float(layer) * 7.7);
      vec2 cell = floor(uvS);
      vec2 cf = fract(uvS);
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          vec2 cc = cell + vec2(float(dx), float(dy));
          float h = hash21(cc + float(layer) * 11.3);
          float threshold = 0.965 - 0.005 * float(layer);  // más permisivo → más estrellas
          if (h > threshold) {
            vec2 pp = vec2(float(dx) + hash21(cc + 2.0), float(dy) + hash21(cc + 5.0));
            vec2 d = cf - pp;
            float dist2 = dot(d, d);
            // Gaussian más suave (más pequeñas y limpias)
            float intensity = exp(-dist2 * 80.0) * (h - threshold) * 380.0 * uStarDensity;
            float t = hash21(cc + 7.0);
            vec3 tint = mix(vec3(0.65, 0.80, 1.0), vec3(1.0, 0.78, 0.50), t);
            if (t > 0.9) tint = vec3(1.0);
            col += tint * intensity * (1.0 / pow(1.3, float(layer)));
          }
        }
      }
    }

    // Vía Láctea: banda de polvo + nubes nebulares.
    // FIX MORADO: el tinte era vec3(0.55,0.45,0.7) = LAVANDA (azul 0.7 > rojo) y
    // cubría TODO el cielo vía 'band' → el "negro" del void leía MORADO. Ahora un
    // gris-azulado MUY tenue y frío (sin exceso de azul) y MITAD de intensidad:
    // el polvo se intuye pero el void se mantiene NEGRO de verdad.
    float band = exp(- dir.y * dir.y * 4.5);
    float dust = fbm(vec2(theta * 6.0, phi * 4.0)) * band;
    col += vec3(0.34, 0.36, 0.42) * dust * 0.09;   // gris-azulado frío, tenue
    col += vec3(0.80, 0.78, 0.70) * pow(band, 1.6) * 0.05;  // núcleo galáctico cálido-neutro
    // Polvo oscuro: silhouettes
    float darkBand = smoothstep(0.3, 0.55, fbm(vec2(theta * 5.0, phi * 3.0 + uStarSeed))) * band;
    col *= 1.0 - darkBand * 0.4;

    return col;
  }

  // ── Blackbody color por temperatura normalizada ────────────────────
  vec3 blackbody(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.55, 0.06, 0.02);   // deep red
    vec3 c1 = vec3(1.00, 0.32, 0.06);   // orange
    vec3 c2 = vec3(1.00, 0.88, 0.50);   // yellow-warm
    vec3 c3 = vec3(1.00, 1.00, 1.00);   // white
    vec3 c4 = vec3(0.65, 0.82, 1.10);   // blue
    vec3 c5 = vec3(0.50, 0.40, 1.20);   // violet
    if (t < 0.2)  return mix(c0, c1, t / 0.2);
    if (t < 0.45) return mix(c1, c2, (t - 0.2) / 0.25);
    if (t < 0.65) return mix(c2, c3, (t - 0.45) / 0.20);
    if (t < 0.85) return mix(c3, c4, (t - 0.65) / 0.20);
    return mix(c4, c5, (t - 0.85) / 0.15);
  }

  // ── ACES filmic tonemap (Narkowicz 2015): comprime HDR y lava picos a blanco
  vec3 acesFilmic(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  // ── Texture del disco en coordenadas locales (r, phi) ───────────────
  // Devuelve emisión (HDR) + alpha cubriendo el plano del disco.
  vec4 sampleDiskLocal(float r, float phi, vec3 viewDir, vec3 vTangent) {
    if (r < uRIn || r > uROut) return vec4(0.0);

    // Temperatura
    float tNorm = pow(uRIn / r, 0.75);

    // Velocidad orbital prograda β = √(rs / 2r). Cerca de ISCO ~0.5c.
    float beta = sqrt(uRs / (2.0 * r));
    beta = clamp(beta, 0.0, 0.96);
    float gamma = 1.0 / sqrt(1.0 - beta * beta);

    // Doppler factor δ. cosθ = dot(viewDir_to_source, vTangent_orbital_motion)
    // viewDir aquí es la dirección desde el punto al observador (cámara), por
    // lo que el material que se acerca al observador tiene δ>1.
    float cosTheta = dot(vTangent, -viewDir);
    float delta = 1.0 / (gamma * (1.0 - beta * cosTheta));
    float boost = pow(delta, 4.0) * uDopplerK + (1.0 - uDopplerK);
    boost = max(boost, 0.05);

    // Redshift gravitacional: factor (1 - rs/r)^(1/2)
    float zFactor = sqrt(max(1e-3, 1.0 - uRs / r));

    // Streamers logarítmicos + filamentos finos (textura sedosa tipo Schnittman)
    float lr = log(r / uRIn + 0.1);
    vec2 swirl = vec2(phi * 4.0 + lr * 6.0 - uTime * 0.7,
                      lr * 5.0 - uTime * 0.3);
    float turb1 = fbm(swirl);
    float turb2 = fbm(swirl * 3.5 + vec2(uTime * 0.6, 0.0));
    float fine  = fbm(swirl * 8.0 + vec2(uTime * 0.9, lr * 2.0));
    float turb = mix(turb1, turb2, 0.42);
    float streamer = pow(0.5 + 0.5 * turb, 1.7) * (0.60 + 0.55 * fine);

    // Bordes y densidad
    float u = (r - uRIn) / (uROut - uRIn);
    float edge = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.85, 1.0, u));
    float density = pow(uRIn / r, 1.4) * 1.0 + 0.3;

    // Color — la temperatura define el hue; el tinte solo da un sesgo cálido
    // suave para que el borde interno caliente pueda llegar a BLANCO (ACES lo lava).
    float tColor = clamp(tNorm * zFactor + 0.05, 0.0, 1.0);
    vec3 warmBias = mix(vec3(1.0), uDiskTint, 0.30);
    vec3 col = blackbody(tColor) * warmBias * 2.4;

    // Aplica Doppler — HDR sin clamp (ACES comprime los picos al final)
    col *= boost * streamer * density * edge;

    // Hot inner edge — blanco incandescente cerca de ISCO
    float hotRim = exp(-pow((r - uRIn) / (uRIn * 0.16), 2.0));
    col += vec3(1.0, 0.96, 0.90) * hotRim * density * edge * boost * 2.0;

    float alpha = clamp(edge * density * (0.55 + 0.45 * streamer), 0.0, 1.0)
                 * uDiskAlpha;
    return vec4(col, alpha);
  }

  void main() {
    // ── Construcción del rayo desde la cámara ──────────────────────
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uAspect;
    vec3 rayDir = normalize(uCamFwd + uv.x * uTanHalfFov * uCamRight
                                     + uv.y * uTanHalfFov * uCamUp);
    vec3 rayPos = uCamPos;

    // Disk plane: pasa por origen, normal uDiskNormal. Construimos un par
    // de tangentes (e1, e2) para coords locales del disco.
    vec3 n = normalize(uDiskNormal);
    vec3 e1 = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
    vec3 e2 = cross(n, e1);

    vec3 accumulated = vec3(0.0);
    float transmittance = 1.0;
    float totalDeflect = 0.0;   // ángulo de flexión acumulado (para aberración cromática)

    // ── Raymarch ───────────────────────────────────────────────────
    float maxR = length(uCamPos) + 60.0;
    float dt = 0.18 * uRs;
    vec3 prevPos = rayPos;
    float prevPlaneDist = dot(rayPos, n);

    bool escaped = false;
    bool absorbed = false;

    for (int i = 0; i < 200; i++) {
      // Tope dinámico: el loop GLSL debe tener cota constante (200), pero cortamos
      // antes si uMaxSteps es menor — aligera el shader para render 4K sin TDR.
      if (float(i) >= uMaxSteps) break;
      float r = length(rayPos);
      if (r < uRs * 1.01) {
        absorbed = true;
        break;
      }
      if (r > maxR) {
        escaped = true;
        break;
      }

      // Disk crossing detection
      float planeDist = dot(rayPos, n);
      if (planeDist * prevPlaneDist < 0.0) {
        // Linear interp for crossing point
        float frac = abs(prevPlaneDist) / (abs(prevPlaneDist) + abs(planeDist));
        vec3 cross_ = mix(prevPos, rayPos, frac);
        // Coords locales en el disco
        float xLocal = dot(cross_, e1);
        float yLocal = dot(cross_, e2);
        float rLocal = sqrt(xLocal * xLocal + yLocal * yLocal);
        float phi = atan(yLocal, xLocal);
        // Velocidad tangente prograda en mundo: rotar (xLocal, yLocal) +90° en plano del disco
        vec3 vTan = (-yLocal * e1 + xLocal * e2) / max(rLocal, 1e-4);

        // -rayDir es desde el punto del disco hacia la cámara (aprox)
        vec4 d = sampleDiskLocal(rLocal, phi, -rayDir, vTan);
        accumulated += d.rgb * d.a * transmittance;
        transmittance *= (1.0 - d.a);
        if (transmittance < 0.02) break;
      }

      // ── Gravitational bend ────────────────────────────────────
      // Para luz: dv/dt = -1.5 rs / r² · r̂  (geodésica nula Schwarzschild
      // ecuatorial linealizada). Multiplicamos × 2 para que el shadow
      // tenga el radio correcto √27/2 rs en weak-field también.
      vec3 toBh = -rayPos / r;
      float strength = 2.0 * uRs / (r * r);
      vec3 bentDir = normalize(rayDir + toBh * strength * dt);
      // magnitud del giro de esta sub-etapa = ángulo entre rayDir y bentDir.
      // se acumula → mide cuánto se lensó el rayo (máximo cerca del photon ring).
      totalDeflect += length(bentDir - rayDir);
      rayDir = bentDir;

      dt = max(0.04 * uRs, r * 0.06);

      prevPos = rayPos;
      prevPlaneDist = planeDist;
      rayPos += rayDir * dt;
    }

    vec3 finalColor = accumulated;

    // ── Si escapó: samplea starfield en dirección final ────────
    if (escaped) {
      // Aberración cromática FÍSICA en bordes muy lensados: donde el rayo se
      // dobló más (totalDeflect grande, cerca de la sombra) las componentes
      // R/G/B se separan, como una lente real estirada por la gravedad. Cada
      // canal samplea el fondo en una dirección ligeramente girada en el plano
      // tangente al rayo. Cero costo si uChromAb=0 (caso por defecto).
      vec3 nebula;
      if (uChromAb > 1e-5) {
        float sep = uChromAb * totalDeflect;
        vec3 tangent = normalize(cross(rayDir, uCamUp) + vec3(1e-5));
        vec3 dirR = normalize(rayDir + tangent * sep);
        vec3 dirB = normalize(rayDir - tangent * sep);
        nebula = vec3(stars(dirR).r, stars(rayDir).g, stars(dirB).b);
      } else {
        nebula = stars(rayDir);
      }
      finalColor += nebula * transmittance * 0.55 * uNebulaBoost;
    }

    // ── Photon ring: boost luminoso al final de la línea si el rayo
    //    quedó cerca del límite de la sombra (b ≈ b_crit = √27/2 rs).
    //    Equivalente a "esto pasó por la photon sphere muchas veces".
    if (uPhotonRing > 0.5 && !absorbed) {
      // Heurística: rayos que terminaron en órbita radial cercana a ~2.6 rs.
      // Calculamos el impact parameter b ≈ r · sin(angle entre rayDir y radial).
      float rNow = length(rayPos);
      vec3 radial = rayPos / rNow;
      float sinTheta = length(cross(rayDir, radial));
      float b = rNow * sinTheta;
      float bcrit = 2.598 * uRs;   // √27/2 · rs
      float dband = abs(b - bcrit) / (0.07 * uRs);
      float pr = exp(-dband * dband) * 1.7 * transmittance;
      finalColor += vec3(1.0, 0.95, 0.82) * pr;
    }

    // Exposición global (reemplaza el *1.5 hardcodeado).
    finalColor *= uExposure;

    // DOBLE TONEMAP GUARD: si linearOutput, emitimos HDR LINEAL y dejamos que el
    // postFX externo (CinematicPostFX) haga el ACES UNA sola vez. Si no, ACES
    // inline + gamma (comportamiento legacy para los labs sin postFX cinemático).
    if (uLinearOut < 0.5) {
      finalColor = acesFilmic(finalColor);
      finalColor = pow(finalColor, vec3(0.92));
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
