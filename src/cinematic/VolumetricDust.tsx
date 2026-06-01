// VolumetricDust.tsx
// ---------------------------------------------------------------------------
// Capa de polvo / nebulosa volumetrica REUTILIZABLE para escenas con geometria
// 3D real (magnetar, quasar). Su unico trabajo es ATMOSFERA: separar planos,
// dar perspectiva atmosferica y, con eso, ESCALA. Profundidad = miedo.
//
// Esto NO es para el agujero negro: ahi el polvo vive DENTRO del shader
// fullscreen para que se lense. Aqui es un volumen real en la escena, pensado
// para envolver objetos con geometria (estrella de neutrones, disco de quasar).
//
// Tecnica: raymarching LIGERO dentro de una caja unitaria (box -1..1) escalada
// por `scale`. fbm 3D barato (pocas octavas) con marcha de pocos pasos. La luz
// del objeto central (lightPos / lightColor) ilumina el medio con scattering
// hacia adelante (Henyey-Greenstein aprox) + atenuacion por densidad acumulada.
//
// Reglas duras respetadas:
//  - Uniforms ESTABLES: se crean una sola vez con useMemo y se MUTAN .value en
//    useFrame. Nunca se hace inline el objeto uniforms en <shaderMaterial>.
//  - Determinista: la animacion clave (deriva del campo de ruido) es funcion
//    pura de uTime. Si llega la prop `time`, ese valor MANDA y se ignora el
//    clock de three -> frames 100% reproducibles para el render offline.
//  - HDR lineal: el material emite color LINEAL premultiplicado por alpha y NO
//    aplica tonemapping (toneMapped = false). El ACES global del postFX lo hace
//    una sola vez. Cero doble tonemap.
//  - Sin drei <Text> aqui: es solo geometria + shader.
//  - Parallax: al ser un volumen real en world-space, la camara lo atraviesa y
//    los planos internos se separan solos. Ademas el ruido deriva lento para
//    vender el peso del medio.
// ---------------------------------------------------------------------------

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface VolumetricDustProps {
  /** Densidad del medio (0 = transparente, ~1.5 = nube espesa). Default 0.6. */
  density?: number;
  /** Color base frio del polvo (la sombra del medio, void azul-violeta). */
  color?: THREE.ColorRepresentation;
  /** Color de las "brasas": el polvo cercano a la luz se calienta a esto. */
  emberColor?: THREE.ColorRepresentation;
  /** Posicion world-space del emisor central (estrella/disco). */
  lightPos?: THREE.Vector3 | [number, number, number];
  /** Color de la luz que ilumina el medio (color del objeto central). */
  lightColor?: THREE.ColorRepresentation;
  /** Tamano del volumen en world units. Escalar = mas atmosfera. Default 6. */
  scale?: number | [number, number, number];
  /** Numero de pasos del raymarch. Pocos = barato. 24-48 recomendado. */
  layers?: number;
  /**
   * Tiempo forzado desde fuera (segundos). Si se pasa, MANDA sobre el clock.
   * Para el render offline determinista: window.__cinematic*.renderAt(t) -> time=t.
   */
  time?: number;
  /** Posicion world del centro del volumen. Default origen. */
  position?: [number, number, number];
}

const vertexShader = /* glsl */ `
  varying vec3 vLocalPos;   // posicion en espacio del box (-1..1 * half-size)
  varying vec3 vWorldPos;   // posicion world para el calculo de luz
  void main() {
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;

  uniform float uTime;
  uniform float uDensity;
  uniform vec3  uColor;       // polvo frio (sombra)
  uniform vec3  uEmberColor;  // brasas calientes cerca de la luz
  uniform vec3  uLightPos;    // emisor central (world)
  uniform vec3  uLightColor;  // color de la luz central
  uniform vec3  uHalfSize;    // medias dimensiones del box (world)
  uniform vec3  uCamPos;      // posicion de la camara (world)
  uniform int   uSteps;       // pasos del raymarch (layers)

  // ---- hash / value noise determinista (sin texturas, sin reloj) ----------
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f); // smoothstep
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  // fbm barato: 4 octavas con deriva lenta (funcion PURA de uTime)
  float fbm(vec3 p) {
    float drift = uTime * 0.04;
    p += vec3(drift, drift * 0.5, -drift * 0.7); // medio que respira, deriva
    float a = 0.5;
    float sum = 0.0;
    for (int o = 0; o < 4; o++) {
      sum += a * vnoise(p);
      p = p * 2.02 + vec3(11.3, 7.7, 5.1);
      a *= 0.5;
    }
    return sum;
  }

  // densidad del medio en un punto WORLD: fbm recortado por la "burbuja" del box
  float densityAt(vec3 wp) {
    // coordenada normalizada -1..1 dentro del box (recorte suave de la nube)
    vec3 local = clamp(wp / max(uHalfSize, vec3(0.0001)), vec3(-1.0), vec3(1.0));
    // caida suave hacia los bordes del box -> sin cantos duros
    float edge = (1.0 - dot(local, local) * 0.5);
    edge = clamp(edge, 0.0, 1.0);
    float d = fbm(wp * 0.55);
    d = smoothstep(0.42, 0.95, d);     // umbral: filamentos, no sopa uniforme
    return d * edge * uDensity;
  }

  void main() {
    // rayo de la camara hacia este fragmento (entramos por la cara del box)
    vec3 ro = uCamPos;
    vec3 rd = normalize(vWorldPos - uCamPos);

    // marchamos desde la cara visible hacia adentro una distancia acotada
    float boxR = length(uHalfSize);
    float marchLen = boxR * 2.0;
    int steps = uSteps;
    float dt = marchLen / float(steps);

    // empezamos en la cara que ve la camara (vWorldPos) y avanzamos hacia dentro
    vec3 pos = vWorldPos;

    vec3  accumCol = vec3(0.0);
    float transmittance = 1.0; // 1 = totalmente transparente

    for (int i = 0; i < 256; i++) {
      if (i >= steps) break;
      if (transmittance < 0.01) break;

      float dens = densityAt(pos);
      if (dens > 0.001) {
        // iluminacion: marcha CORTA hacia la luz para sombra propia (2 taps)
        vec3 toLight = uLightPos - pos;
        float distL = length(toLight);
        vec3 ld = toLight / max(distL, 0.0001);
        float shadow = 0.0;
        shadow += densityAt(pos + ld * (boxR * 0.18));
        shadow += densityAt(pos + ld * (boxR * 0.40)) * 0.5;
        float lightT = exp(-shadow * 2.5);

        // atenuacion radial de la luz central (inverse-square suavizado)
        float falloff = 1.0 / (1.0 + distL * distL * 0.05);

        // forward scattering (Henyey-Greenstein aprox, g positivo)
        float ndl = max(dot(rd, ld), 0.0);
        float g = 0.55;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ndl, 1.5);

        // brasas: lo que recibe luz se calienta hacia emberColor
        float warm = clamp(lightT * falloff * (0.5 + 0.5 * hg), 0.0, 1.0);
        vec3 medium = mix(uColor, uEmberColor, warm);
        vec3 lit = medium * uLightColor * (lightT * falloff) * (0.6 + 0.9 * hg);
        // un piso de ambiente frio para que el polvo en sombra siga leyendose
        lit += uColor * 0.06;

        float a = dens * dt * 1.5;
        a = clamp(a, 0.0, 1.0);
        accumCol += transmittance * a * lit;
        transmittance *= (1.0 - a);
      }
      pos += rd * dt;
    }

    float alpha = 1.0 - transmittance;
    if (alpha < 0.004) discard; // no pintar vacio -> barato y limpio

    // HDR LINEAL premultiplicado por alpha. SIN tonemap: el ACES global del
    // postFX lo hace una sola vez. (toneMapped=false en el material.)
    gl_FragColor = vec4(accumCol, alpha);
  }
`;

function toVec3(v: THREE.Vector3 | [number, number, number] | undefined, dx: number, dy: number, dz: number): THREE.Vector3 {
  if (v instanceof THREE.Vector3) return v.clone();
  if (Array.isArray(v)) return new THREE.Vector3(v[0], v[1], v[2]);
  return new THREE.Vector3(dx, dy, dz);
}

function toHalfSize(scale: number | [number, number, number] | undefined): THREE.Vector3 {
  if (Array.isArray(scale)) return new THREE.Vector3(scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5);
  const s = (typeof scale === "number" ? scale : 6) * 0.5;
  return new THREE.Vector3(s, s, s);
}

/**
 * Volumen de polvo/nebulosa. Coloca <VolumetricDust .../> dentro del Canvas,
 * idealmente envolviendo el objeto central (lightPos = centro del objeto).
 * Para escala extra: usa 2-3 instancias con `scale` y `density` distintos
 * (una nube cercana tenue + una lejana densa = parallax = profundidad).
 */
export default function VolumetricDust({
  density = 0.6,
  color = "#1a2740",          // void azul-violeta frio
  emberColor = "#ff7a2a",     // brasa calida
  lightPos,
  lightColor = "#ffd9a0",
  scale = 6,
  layers = 32,
  time,
  position = [0, 0, 0],
}: VolumetricDustProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  // medias dimensiones del box -> tambien las usa el shader para recortar
  const halfSize = useMemo(() => toHalfSize(scale), [scale]);

  // UNIFORMS ESTABLES: se crean UNA sola vez. Nunca inline en <shaderMaterial>.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDensity: { value: density },
      uColor: { value: new THREE.Color(color) },
      uEmberColor: { value: new THREE.Color(emberColor) },
      uLightPos: { value: toVec3(lightPos, 0, 0, 0) },
      uLightColor: { value: new THREE.Color(lightColor) },
      uHalfSize: { value: halfSize.clone() },
      uCamPos: { value: new THREE.Vector3() },
      uSteps: { value: Math.max(4, Math.min(256, Math.round(layers))) },
    }),
    // intencional: creamos una sola vez; el resto se MUTA en useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    const u = uniforms;
    // DETERMINISMO: si llega `time`, manda. Nunca caemos al clock si esta dado.
    u.uTime.value = time !== undefined ? time : state.clock.getElapsedTime();

    // props que pueden cambiar entre frames -> mutamos .value (no recreamos)
    u.uDensity.value = density;
    u.uColor.value.set(color);
    u.uEmberColor.value.set(emberColor);
    u.uLightColor.value.set(lightColor);
    u.uHalfSize.value.copy(halfSize);
    u.uSteps.value = Math.max(4, Math.min(256, Math.round(layers)));

    if (lightPos instanceof THREE.Vector3) u.uLightPos.value.copy(lightPos);
    else if (Array.isArray(lightPos)) u.uLightPos.value.set(lightPos[0], lightPos[1], lightPos[2]);

    // parallax / atmosfera: el shader necesita la posicion de la camara
    u.uCamPos.value.copy(state.camera.position);
  });

  return (
    <mesh position={position} renderOrder={-1} frustumCulled={false}>
      {/* caja unitaria escalada por las medias dimensiones (geometria 1x1x1) */}
      <boxGeometry args={[halfSize.x * 2, halfSize.y * 2, halfSize.z * 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={true}
        side={THREE.BackSide}     // pintamos desde dentro: vemos la cara trasera
        blending={THREE.NormalBlending}
        toneMapped={false}        // HDR lineal: el ACES global tonemap una vez
      />
    </mesh>
  );
}
