/**
 * NSLensed — superficie de estrella de neutrones CON LENTE GRAVITACIONAL real.
 * Hermano de BHRaytraced: reusa la integración de geodésicas nulas de Schwarzschild
 * (dv/dt = -2·rs/r²·r̂) pero con PARADA INVERTIDA: el rayo INTERSECTA la esfera
 * R_STAR → muestrea el mapa térmico NICER de J0030 (Riley 2019) en el impacto.
 *
 * Con R/rs≈3.07 (J0030: M=1.4M☉,R=12.7km → rs=4.13km) se ve ~3/4 de la superficie
 * (los hot spots del lado lejano se enroscan al frente) y el LIMBO BRILLA. Verificado
 * numéricamente (b=5rs impacta a colatitud 102° → vemos detrás del limbo). NO hay
 * sombra (la estrella tapa su propia photon sphere). Color = cuerpo negro a ~10^6 K
 * en visible = BLANCO-AZUL PÁLIDO (cola Rayleigh-Jeans), crust casi-negro, NO cobalto.
 *
 * Determinista: usa getTime() (= window.__cinematicPulsar.t) → función pura de t.
 * Uniforms vía useMemo + mutar .value en useFrame (NUNCA inline). linearOutput=true:
 * emite HDR lineal y deja el ÚNICO ACES a CinematicPostFX (cero doble tonemap).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface NSLensedProps {
  rs?: number;          // radio Schwarzschild en unidades de escena (def 1.0)
  rStar?: number;       // R_STAR (compacidad = rs/rStar). J0030 fiel: 3.07
  period?: number;      // P de rotación (s) — barre los hot spots (pulso térmico)
  getTime?: () => number; // tiempo determinista (renderAt). Si null → reloj
  exposure?: number;
  limbBoost?: number;
  tEffNorm?: number;
  beta?: number;        // β ecuatorial = v_eq/c (ms-pulsar real ~0.18) → beaming Doppler
  starDensity?: number;
  starSeed?: number;
  linearOutput?: boolean;
  maxSteps?: number;
}

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform float uTime, uRs, uRStar, uPeriod, uExposure, uLimbBoost, uTEff;
  uniform float uStarDensity, uStarSeed, uLinearOut, uMaxSteps, uBeta;
  uniform vec3  uCamPos, uCamFwd, uCamRight, uCamUp;
  uniform float uTanHalfFov, uAspect;

  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  vec3 stars(vec3 dir){
    dir=normalize(dir);
    float theta=atan(dir.z,dir.x), phi=asin(clamp(dir.y,-1.0,1.0));
    vec3 col=vec3(0.0);
    for(int layer=0; layer<3; layer++){
      float scale=350.0*pow(1.55,float(layer));
      vec2 uvS=vec2(theta*scale, phi*scale*2.0)+vec2(uStarSeed*17.7+float(layer)*4.1, uStarSeed*31.3+float(layer)*7.7);
      vec2 cell=floor(uvS), cf=fract(uvS);
      for(int dx=-1;dx<=1;dx++) for(int dy=-1;dy<=1;dy++){
        vec2 cc=cell+vec2(float(dx),float(dy));
        float h=hash21(cc+float(layer)*11.3);
        float thr=0.972-0.004*float(layer);
        if(h>thr){
          vec2 pp=vec2(float(dx)+hash21(cc+2.0), float(dy)+hash21(cc+5.0));
          vec2 d=cf-pp; float di2=dot(d,d);
          float inten=exp(-di2*90.0)*(h-thr)*360.0*uStarDensity;
          float t=hash21(cc+7.0);
          vec3 tint=mix(vec3(0.7,0.82,1.0), vec3(1.0,0.82,0.6), t);
          col+=tint*inten*(1.0/pow(1.3,float(layer)));
        }
      }
    }
    return col;
  }

  vec3 spinY(vec3 p, float a){ float c=cos(a),s=sin(a); return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z); }

  float cap(vec3 n, vec3 c, float coreDeg, float edgeDeg){
    float d = dot(n, normalize(c));
    return smoothstep(cos(radians(edgeDeg)), cos(radians(coreDeg)), d);
  }
  // Mapa NICER de PSR J0030+0451 (Riley 2019): mancha chica + media luna alargada,
  // AMBAS en el MISMO hemisferio (no antipodales) — el hallazgo que rompió el dipolo.
  float nicerMap(vec3 n){
    float spot = cap(n, vec3(0.60, 0.77, 0.22), 6.0, 11.0);
    float cre = 0.0;
    cre = max(cre, cap(n, vec3(-0.10, 0.82, 0.565), 4.0, 8.0));
    cre = max(cre, cap(n, vec3(-0.287,0.82, 0.497), 4.0, 8.0));
    cre = max(cre, cap(n, vec3(-0.44, 0.82, 0.369), 4.0, 8.0));
    cre = max(cre, cap(n, vec3(-0.55, 0.80, 0.24 ), 4.0, 8.0));
    return max(spot, cre);
  }

  // Cuerpo negro NS a ~1e6 K: crust casi-negro frío (Rayleigh-Jeans, NO cobalto);
  // hot spots HDR pálidos (el bloom los revienta conservando forma). Planck→sRGB.
  vec3 nsColor(float t){
    vec3 crust = vec3(0.301, 0.439, 1.0) * 0.010;   // tenue, frío, casi negro
    vec3 hot   = vec3(0.685, 0.747, 1.0) * 5.2;     // HDR: blanco-azul pálido
    return crust + hot * t;
  }

  vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }

  void main(){
    vec2 uv = vUv*2.0 - 1.0;  uv.x *= uAspect;
    vec3 rayDir = normalize(uCamFwd + uv.x*uTanHalfFov*uCamRight + uv.y*uTanHalfFov*uCamUp);
    vec3 rayPos = uCamPos;

    float rot = 6.28318530718 * uTime / max(uPeriod, 1e-3);

    float maxR = length(uCamPos) + 60.0;
    float dt   = 0.18 * uRs;
    vec3  prevPos = rayPos;
    float prevR   = length(rayPos);

    bool  hit = false, escaped = false;
    vec3  hitPos = vec3(0.0);
    vec3  hitDir = rayDir;

    for(int i=0;i<200;i++){
      if(float(i) >= uMaxSteps) break;
      float r = length(rayPos);
      if(r < uRStar){
        float frac = (prevR - uRStar) / max(prevR - r, 1e-4);
        hitPos = mix(prevPos, rayPos, clamp(frac,0.0,1.0));
        hit = true; hitDir = rayDir;
        break;
      }
      if(r > maxR){ escaped = true; break; }
      vec3  toBh = -rayPos / r;
      float strength = 2.0 * uRs / (r*r);
      rayDir = normalize(rayDir + toBh * strength * dt);
      float near = step(r, uRStar*1.4);
      dt = mix(max(0.04*uRs, r*0.06), max(0.03*uRs, r*0.035), near);
      prevPos = rayPos;  prevR = r;
      rayPos += rayDir * dt;
    }

    vec3 finalColor = vec3(0.0);

    if(hit){
      vec3 nWorld = normalize(hitPos);
      vec3 nMap = spinY(nWorld, -rot);
      float heat = nicerMap(nMap);
      // emisión térmica: TODO el cuerpo a ~1e6 K emite (tenue, frío) + hot spots NICER
      vec3 surf = vec3(0.05,0.062,0.09) + nsColor(pow(heat, 0.8));
      // ── DOPPLER BEAMING RELATIVISTA del giro (eje Y, β=v_eq/c real ~0.18) ──
      // El ecuador de un ms-pulsar va a ~0.18c → el lado que se ACERCA revienta
      // (δ⁴, igual que el disco del BH), el que se ALEJA se apaga y enrojece.
      vec3 vdir = normalize(cross(vec3(0.0,1.0,0.0), nWorld) + vec3(1e-6));
      float sinT = clamp(length(nWorld.xz), 0.0, 1.0);
      float betaL = uBeta * sinT;
      float gam = 1.0 / sqrt(max(1e-3, 1.0 - betaL*betaL));
      float dopp = 1.0 / (gam * (1.0 - dot(vdir*betaL, -hitDir)));
      float beam = pow(clamp(dopp, 0.25, 3.0), 4.0);
      vec3 dShift = mix(vec3(1.0,0.5,0.32), vec3(0.55,0.74,1.0), clamp((dopp-0.65)/0.7,0.0,1.0));
      surf *= beam * dShift;
      float cosI = clamp(dot(-hitDir, nWorld), 0.05, 1.0);
      float limb = uLimbBoost * (0.55 + 0.45 / sqrt(cosI));
      float zSurf = sqrt(max(1e-3, 1.0 - uRs/uRStar));
      finalColor = surf * limb * zSurf;
      // anillo de limbo lensado: más brillante y ancho = el WOW de la lente
      float rim = smoothstep(0.42, 0.03, cosI);
      finalColor += vec3(0.13,0.18,0.32) * rim * 1.7;
    } else if(escaped){
      finalColor += stars(rayDir) * 0.5;
    }

    finalColor *= uExposure;

    if(uLinearOut < 0.5){
      finalColor = aces(finalColor);
      finalColor = pow(finalColor, vec3(0.92));
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function NSLensed({
  rs = 1.0, rStar = 3.07, period = 1.4, getTime, exposure = 1.4, limbBoost = 1.0,
  tEffNorm = 0.62, beta = 0.18, starDensity = 1.0, starSeed = 1.7, linearOutput = true, maxSteps = 140,
}: NSLensedProps) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uRs: { value: rs }, uRStar: { value: rStar }, uPeriod: { value: period },
    uExposure: { value: exposure }, uLimbBoost: { value: limbBoost }, uTEff: { value: tEffNorm },
    uBeta: { value: beta },
    uStarDensity: { value: starDensity }, uStarSeed: { value: starSeed },
    uLinearOut: { value: linearOutput ? 1 : 0 }, uMaxSteps: { value: maxSteps },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: 1 }, uAspect: { value: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const p = useRef({ rs, rStar, period, exposure, limbBoost, tEffNorm, beta, starDensity, starSeed, linearOutput, maxSteps, getTime });
  p.current = { rs, rStar, period, exposure, limbBoost, tEffNorm, beta, starDensity, starSeed, linearOutput, maxSteps, getTime };

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const WORLD_UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera, clock, size }) => {
    const c = p.current; const u = uniforms;
    u.uRs.value = c.rs; u.uRStar.value = c.rStar; u.uPeriod.value = c.period;
    u.uExposure.value = c.exposure; u.uLimbBoost.value = c.limbBoost; u.uTEff.value = c.tEffNorm;
    u.uTEff.value = c.tEffNorm; u.uBeta.value = c.beta;
    u.uStarDensity.value = c.starDensity; u.uStarSeed.value = c.starSeed;
    u.uLinearOut.value = c.linearOutput ? 1 : 0; u.uMaxSteps.value = c.maxSteps;
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(fwd);
    right.crossVectors(fwd, WORLD_UP).normalize();
    up.crossVectors(right, fwd).normalize();
    u.uCamPos.value.copy(cam.position);
    u.uCamFwd.value.copy(fwd); u.uCamRight.value.copy(right); u.uCamUp.value.copy(up);
    u.uTanHalfFov.value = Math.tan((cam.fov * Math.PI / 180) / 2);
    u.uAspect.value = size.width / size.height;
    u.uTime.value = c.getTime ? c.getTime() : clock.elapsedTime;
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
