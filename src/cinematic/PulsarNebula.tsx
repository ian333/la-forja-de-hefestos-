/**
 * PulsarNebula — la NEBULOSA DE VIENTO DE PÚLSAR (estilo Cangrejo/M1) que RODEA a la
 * estrella de neutrones. Resuelve "demasiado negro": el púlsar joven NO está solo, vive
 * dentro de un MAR de sincrotrón que LLENA el cuadro (ref: docs/referencias-espacial/pulsar/).
 *
 * Raymarcher volumétrico (rayos rectos — a escala de la nebulosa la lente de la NS es
 * despreciable). Modelo fiel al Cangrejo:
 *   · GLO DE SINCROTRÓN azul-blanco difuso llenando el interior (el viento de partículas
 *     relativistas del púlsar, radiación no-térmica) — ref crab-chandra (azul) + crab-hubble (centro).
 *   · JAULA DE FILAMENTOS exteriores (ridged turbulence): líneas de emisión REALES —
 *     Hα/[SII] rojizo-naranja + [OIII] teal-verde (la red lacy del Cangrejo).
 *   · NÚCLEO brillante = el púlsar (punto) + TORO ecuatorial + JET polar (ref crab-chandra).
 *   · Starfield de fondo.
 *
 * Determinista: getTime() puro en t (los filamentos se advectan lento). linearOutput → el
 * único ACES lo hace CinematicPostFX. Uniforms vía useMemo + mutar .value (NUNCA inline).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface PulsarNebulaProps {
  rNeb?: number;          // radio de la nebulosa (unidades de escena)
  period?: number;        // P de rotación (para el pulso del faro del núcleo)
  getTime?: () => number;
  exposure?: number;
  linearOutput?: boolean;
  maxSteps?: number;
  starSeed?: number;
  tilt?: number;          // inclinación del eje del toro/jet (grados)
  coreGain?: number;      // 1=con núcleo púlsar (toro/jet), 0=nebulosa pura (sin morado)
}

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uRNeb, uPeriod, uExposure, uLinearOut, uMaxSteps, uStarSeed, uTilt, uCore;
  uniform vec3  uCamPos, uCamFwd, uCamRight, uCamUp;
  uniform float uTanHalfFov, uAspect;

  // ── ruido 3D ────────────────────────────────────────────────────────
  float h31(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float n3(vec3 x){
    vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z);
  }
  float fbm3(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*n3(p); p*=2.03; a*=0.5; } return v; }
  // ridged = filamentos (crestas afiladas) — la jaula lacy del Cangrejo
  float ridged(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ float n=1.0-abs(2.0*n3(p)-1.0); v+=a*n*n; p*=2.11; a*=0.55; } return v; }

  // starfield
  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  vec3 stars(vec3 dir){
    dir=normalize(dir);
    float th=atan(dir.z,dir.x), ph=asin(clamp(dir.y,-1.0,1.0));
    vec3 col=vec3(0.0);
    for(int L=0;L<3;L++){
      float sc=330.0*pow(1.55,float(L));
      vec2 uvS=vec2(th*sc, ph*sc*2.0)+vec2(uStarSeed*17.7+float(L)*4.1, uStarSeed*31.3+float(L)*7.7);
      vec2 cell=floor(uvS), cf=fract(uvS);
      for(int dx=-1;dx<=1;dx++) for(int dy=-1;dy<=1;dy++){
        vec2 cc=cell+vec2(float(dx),float(dy));
        float h=hash21(cc+float(L)*11.3); float thr=0.972-0.004*float(L);
        if(h>thr){ vec2 pp=vec2(float(dx)+hash21(cc+2.0),float(dy)+hash21(cc+5.0));
          vec2 d=cf-pp; float di2=dot(d,d);
          float it=exp(-di2*92.0)*(h-thr)*330.0; float t=hash21(cc+7.0);
          vec3 tint=mix(vec3(0.7,0.82,1.0),vec3(1.0,0.82,0.6),t); col+=tint*it*(1.0/pow(1.3,float(L))); }
      }
    }
    return col;
  }

  vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }

  // ── MUESTREO DE LA NEBULOSA en un punto p (unidades de escena) ──────
  // Devuelve emisión HDR; escribe densidad (opacidad) en outDens.
  vec3 sampleNebula(vec3 p, out float outDens){
    float R = uRNeb;
    // óvalo (el Cangrejo es más ancho que alto)
    vec3 q = p / vec3(R*1.18, R*0.80, R*1.0);
    float rr = length(q);
    if(rr > 1.15){ outDens=0.0; return vec3(0.0); }

    // advección lenta (la nebulosa "respira"/gira sutil)
    vec3 flow = vec3(uTime*0.012, 0.0, -uTime*0.008);

    // ── SINCROTRÓN: glo azul MUY tenue (solo fondo, NO debe ahogar los filamentos) ──
    float syn = exp(-rr*rr*2.5) * (0.28 + 0.28*fbm3(q*3.0 + flow));
    // ── FILAMENTOS DE NAVAJA: ridged con UMBRAL duro (smoothstep) = bordes nítidos,
    //    3 octavas hasta detalle ultrafino → la red lacy del Cangrejo, no humo. ──
    float shell = smoothstep(0.12, 0.42, rr) * smoothstep(1.12, 0.55, rr);
    // DOMAIN WARP grande → los filamentos CURVAN y se conectan en RED (web lacy del
    // Cangrejo), no grano isotrópico. Es la diferencia entre "humo" y "hebras".
    vec3 warp = vec3(fbm3(q*1.6+flow), fbm3(q*1.6+vec3(11.3)), fbm3(q*1.6+vec3(23.7))) - 0.5;
    vec3 qw = q + warp*0.75;
    float r1 = ridged(qw*6.5  + flow);
    float r2 = ridged(qw*15.0 + flow*1.8);
    float r3 = ridged(qw*32.0 + flow*2.6);
    float fil = smoothstep(0.50, 0.80, r1);          // hebras grandes de borde DURO
    fil *= 0.35 + 0.85*smoothstep(0.44, 0.86, r2);   // sub-hebras nítidas
    fil *= 0.55 + 0.75*r3;                           // grano ultrafino (textura de navaja)
    float densFil = fil * shell;

    // ── COLOR (vívido: líneas de emisión reales saturadas) ──
    vec3 colSyn = vec3(0.52, 0.66, 0.92);           // sincrotrón azul-blanco (desat. → sin morado)
    float hue = fbm3(q*2.4 + 7.3);
    vec3 colFil = mix(vec3(1.0,0.38,0.14), vec3(0.20,0.95,0.62), smoothstep(0.42,0.60,hue)); // Hα/[SII] ↔ [OIII]

    outDens = syn*0.30 + densFil*2.0;
    vec3 emit = colSyn * syn * 0.5 + colFil * densFil * 3.8;   // filamentos NÍTIDOS dominan
    return emit;
  }

  void main(){
    vec2 uv = vUv*2.0 - 1.0; uv.x *= uAspect;
    vec3 rd = normalize(uCamFwd + uv.x*uTanHalfFov*uCamRight + uv.y*uTanHalfFov*uCamUp);
    vec3 ro = uCamPos;

    // intersección con la esfera-envolvente de la nebulosa → marcha acotada
    float RB = uRNeb*1.25;
    float b = dot(ro, rd), c = dot(ro,ro) - RB*RB;
    float disc = b*b - c;

    vec3 accum = vec3(0.0); float trans = 1.0;

    if(disc > 0.0){
      float t0 = max(-b - sqrt(disc), 0.0);
      float t1 = -b + sqrt(disc);
      float span = t1 - t0;
      float steps = uMaxSteps;
      float dt = span / steps;
      // eje del toro/jet (inclinado)
      float ti = radians(uTilt); vec3 axis = normalize(vec3(sin(ti), cos(ti), 0.0));
      for(int i=0;i<200;i++){
        if(float(i) >= steps) break;
        float t = t0 + (float(i)+0.5)*dt;
        vec3 p = ro + rd*t;
        float dens; vec3 emit = sampleNebula(p, dens);

        // ── núcleo: púlsar + TORO ecuatorial + JET polar (ref crab-chandra) ──
        float rc = length(p);
        float along = dot(p, axis);                 // a lo largo del eje
        vec3  perpV = p - along*axis; float perp = length(perpV);
        // TORO ecuatorial NÍTIDO (anillo brillante perpendicular al eje) — ref crab-chandra
        float torR = uRNeb*0.17;
        float torus = exp(-pow(perp - torR, 2.0)/(torR*torR*0.012)) * exp(-along*along/(torR*torR*0.06));
        // JET bipolar definido a lo largo del eje
        float jet = exp(-perp*perp/(uRNeb*uRNeb*0.0016)) * smoothstep(uRNeb*0.62, 0.0, abs(along));
        // PÚLSAR: punto incandescente al centro
        float core = exp(-rc*rc/(uRNeb*uRNeb*0.0022));
        vec3 hot = vec3(0.62,0.78,1.0);
        emit += hot * (core*7.0 + torus*4.5 + jet*3.2) * uCore;   // uCore=0 → nebulosa SIN púlsar (sin punto azul → sin morado)
        dens += (core*1.8 + torus*1.1 + jet*0.5) * uCore;

        // emisión-absorción volumétrica (escala BAJA → no se satura a blanco)
        accum += emit * trans * dt * 0.032;
        trans *= exp(-dens * 0.05 * dt);
        if(trans < 0.02) break;
      }
    }

    vec3 col = accum + stars(rd) * trans * 0.5;
    col *= uExposure;
    if(uLinearOut < 0.5){ col = aces(col); col = pow(col, vec3(0.92)); }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function PulsarNebula({
  rNeb = 30, period = 1.4, getTime, exposure = 1.0, linearOutput = true,
  maxSteps = 110, starSeed = 2.2, tilt = 24, coreGain = 1,
}: PulsarNebulaProps) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uRNeb: { value: rNeb }, uPeriod: { value: period },
    uExposure: { value: exposure }, uLinearOut: { value: linearOutput ? 1 : 0 },
    uMaxSteps: { value: maxSteps }, uStarSeed: { value: starSeed }, uTilt: { value: tilt },
    uCore: { value: coreGain },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: 1 }, uAspect: { value: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const p = useRef({ rNeb, period, exposure, linearOutput, maxSteps, starSeed, tilt, coreGain, getTime });
  p.current = { rNeb, period, exposure, linearOutput, maxSteps, starSeed, tilt, coreGain, getTime };
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const upv = useMemo(() => new THREE.Vector3(), []);
  const WUP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera, clock, size }) => {
    const c = p.current, u = uniforms;
    u.uTime.value = c.getTime ? c.getTime() : clock.elapsedTime;
    u.uRNeb.value = c.rNeb; u.uPeriod.value = c.period; u.uExposure.value = c.exposure;
    u.uLinearOut.value = c.linearOutput ? 1 : 0; u.uMaxSteps.value = c.maxSteps;
    u.uStarSeed.value = c.starSeed; u.uTilt.value = c.tilt; u.uCore.value = c.coreGain;
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(fwd);
    right.crossVectors(fwd, WUP).normalize();
    upv.crossVectors(right, fwd).normalize();
    u.uCamPos.value.copy(cam.position); u.uCamFwd.value.copy(fwd);
    u.uCamRight.value.copy(right); u.uCamUp.value.copy(upv);
    u.uTanHalfFov.value = Math.tan((cam.fov * Math.PI / 180) / 2);
    u.uAspect.value = size.width / size.height;
  });

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial depthWrite={false} depthTest={false} transparent={false}
        toneMapped={false} uniforms={uniforms}
        vertexShader={VERTEX_SHADER} fragmentShader={FRAGMENT_SHADER} />
    </mesh>
  );
}
