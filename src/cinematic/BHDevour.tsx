/**
 * BHDevour — un AGUJERO NEGRO DEVORANDO UNA ESTRELLA (disrupción de marea, TDE).
 * La primera "monstruosidad" del catálogo (docs/FILOSOFIA-CINE.md §5).
 *
 * Hermano de BHRaytraced/NSLensed: reusa la integración de geodésicas nulas de
 * Schwarzschild (dv/dt = -2·rs/r²·r̂) → LENTE GRAVITACIONAL real, y le añade tres
 * cuerpos nuevos, todos LENSADOS y con BEAMING DOPPLER δ⁴:
 *
 *   1. LA ESTRELLA (cuerpo negro ~5800 K, color solar #fff4ea por la rampa de
 *      Planck de docs/DOCTRINA-COLOR.md). Cae hacia el BH y, al cruzar el radio
 *      de marea r_t = R·(M_bh/M★)^⅓, se ESPAGUETIFICA: la modelamos como un
 *      elipsoide volumétrico estirado a lo largo de su órbita (stretch ∝ disrupción).
 *   2. LA CORRIENTE DE MAREA (el "espagueti"): una espiral LOGARÍTMICA de plasma
 *      que sale de la estrella y se enrosca hacia el disco, calentándose hacia
 *      adentro (color: solar tibio en la cabeza → blanco-azul pálido cerca de r_in).
 *   3. EL DISCO DE ACRECIÓN que SE ENCIENDE conforme el material cae (T∝r^−¾,
 *      Shakura-Sunyaev) + un PUNTO CALIENTE donde la corriente golpea el disco.
 *
 * Física real: lente gravitacional (Thorne/DNGR), beaming δ⁴ (que Nolan ATENUÓ en
 * Interstellar — aquí va completo, somos más fieles), redshift gravitacional
 * √(1−rs/r), anillo de fotones (b_crit=√27/2·rs), T∝r^−¾, β orbital=√(rs/2r).
 * Lo EVOCATIVO (tamaños relativos comprimidos, periodo ralentizado) se etiqueta.
 *
 * Determinista: getTime() (= window.__cinematicTDE.t) → función PURA de t; uPhase
 * y la animación derivan de él. Uniforms vía useMemo + mutar .value (NUNCA inline).
 * linearOutput=true: emite HDR lineal, el ÚNICO ACES lo hace CinematicPostFX.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BHDevourProps {
  rs?: number;            // radio Schwarzschild en unidades de escena (def 1.0)
  rIn?: number;           // borde interno del disco (·rs)
  rOut?: number;          // borde externo del disco (·rs)
  rStart?: number;        // radio inicial de la estrella (·rs) — de dónde cae
  rTidal?: number;        // radio de marea (·rs): adentro de aquí se desgarra
  starR?: number;         // radio de la estrella (·rs)
  stretch?: number;       // estiramiento máximo de la espaguetificación
  windings?: number;      // vueltas que da la estrella al caer
  duration?: number;      // duración del clip (s) — define el ritmo del phase
  getTime?: () => number; // tiempo determinista (renderAt); si null → reloj
  inclinationDeg?: number;// inclinación del disco vs línea de visión
  exposure?: number;
  dopplerStrength?: number;
  linearOutput?: boolean;
  maxSteps?: number;
  starSeed?: number;
  nebulaBoost?: number;
}

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform float uTime, uPhase, uRs, uRIn, uROut, uRStart, uRTidal, uStarR;
  uniform float uStretch, uWind, uExposure, uDopplerK, uLinearOut, uMaxSteps;
  uniform float uStarSeed, uNebula, uDiskBuild, uAng0;
  uniform vec3  uDiskNormal, uCamPos, uCamFwd, uCamRight, uCamUp;
  uniform float uTanHalfFov, uAspect;

  // ── Hashes / ruido ──────────────────────────────────────────────────
  float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise2(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise2(p); p*=2.07; a*=0.5; } return v; }
  // fbm barato (3 octavas) para el caos del disco volumétrico — se evalúa por PASO
  // dentro del slab, así que el costo importa (evita TDR a 4K).
  float fbm3(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){ v+=a*noise2(p); p*=2.13; a*=0.5; } return v; }

  // ── Starfield gris-azulado frío (sin lavanda → void NEGRO) ──────────
  vec3 stars(vec3 dir){
    dir=normalize(dir);
    float theta=atan(dir.z,dir.x), phi=asin(clamp(dir.y,-1.0,1.0));
    vec3 col=vec3(0.0);
    for(int layer=0; layer<3; layer++){
      float scale=340.0*pow(1.55,float(layer));
      vec2 uvS=vec2(theta*scale, phi*scale*2.0)+vec2(uStarSeed*17.7+float(layer)*4.1, uStarSeed*31.3+float(layer)*7.7);
      vec2 cell=floor(uvS), cf=fract(uvS);
      for(int dx=-1;dx<=1;dx++) for(int dy=-1;dy<=1;dy++){
        vec2 cc=cell+vec2(float(dx),float(dy));
        float h=hash21(cc+float(layer)*11.3);
        float thr=0.971-0.004*float(layer);
        if(h>thr){
          vec2 pp=vec2(float(dx)+hash21(cc+2.0), float(dy)+hash21(cc+5.0));
          vec2 d=cf-pp; float di2=dot(d,d);
          float inten=exp(-di2*90.0)*(h-thr)*340.0;
          float t=hash21(cc+7.0);
          vec3 tint=mix(vec3(0.66,0.80,1.0), vec3(1.0,0.80,0.55), t);
          if(t>0.92) tint=vec3(1.0);
          col+=tint*inten*(1.0/pow(1.3,float(layer)));
        }
      }
    }
    float band=exp(-dir.y*dir.y*4.5);
    float dust=fbm(vec2(theta*6.0,phi*4.0))*band;
    col+=vec3(0.34,0.36,0.42)*dust*0.08;
    col+=vec3(0.80,0.78,0.70)*pow(band,1.6)*0.04;
    return col;
  }

  // ── Cuerpo negro → sRGB (rampa de docs/DOCTRINA-COLOR.md, t01 normalizado) ──
  // 0=brasa #ff3800 · ~0.6=sol #fff4ea · 0.7=D65 blanco · 1=#94b1ff (tope Rayleigh-Jeans)
  vec3 bb(float t){
    t=clamp(t,0.0,1.0);
    vec3 c0=vec3(1.00,0.22,0.00);   // 0.00  brasa profunda
    vec3 c1=vec3(1.00,0.537,0.07);  // 0.20  naranja
    vec3 c2=vec3(1.00,0.616,0.36);  // 0.35  ámbar cálido
    vec3 c3=vec3(1.00,0.851,0.72);  // 0.50  durazno claro
    vec3 c4=vec3(1.00,0.957,0.918); // 0.62  blanco solar (#fff4ea)
    vec3 c5=vec3(1.00,1.00,1.00);   // 0.70  D65
    vec3 c6=vec3(0.890,0.914,1.00); // 0.82  azul pálido (#e3e9ff)
    vec3 c7=vec3(0.580,0.690,1.00); // 1.00  #94b1ff (tope)
    if(t<0.20) return mix(c0,c1,t/0.20);
    if(t<0.35) return mix(c1,c2,(t-0.20)/0.15);
    if(t<0.50) return mix(c2,c3,(t-0.35)/0.15);
    if(t<0.62) return mix(c3,c4,(t-0.50)/0.12);
    if(t<0.70) return mix(c4,c5,(t-0.62)/0.08);
    if(t<0.82) return mix(c5,c6,(t-0.70)/0.12);
    return mix(c6,c7,(t-0.82)/0.18);
  }

  vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }

  // ── Beaming Doppler δ⁴ + corrimiento de color de un orbitador prograde a radio r ──
  // n = normal del disco; rHat/tHat en el plano; viewDir = dir del punto a la cámara.
  // Devuelve color multiplicativo (intensidad·tinte) que ya incluye el shift azul/rojo.
  vec3 dopplerBoost(float r, vec3 tHat, vec3 viewDir){
    float beta = clamp(sqrt(uRs/(2.0*r)), 0.0, 0.96);
    float gam  = 1.0/sqrt(1.0-beta*beta);
    float cosT = dot(tHat, -viewDir);            // material que se acerca → cosT>0
    float delta= 1.0/(gam*(1.0-beta*cosT));
    float boost= pow(delta,4.0)*uDopplerK + (1.0-uDopplerK);
    boost = clamp(boost, 0.10, 2.8);   // domado FUERTE: el disco ENTERO caliente (no medio café), asimetría sutil
    // shift de color: que se ACERCA → azulea, que se ALEJA → enrojece (sutil)
    vec3 shift = mix(vec3(1.0,0.62,0.42), vec3(0.72,0.84,1.0), clamp((delta-0.7)/0.8,0.0,1.0));
    return boost*shift;
  }

  void main(){
    vec2 uv = vUv*2.0 - 1.0;  uv.x *= uAspect;
    vec3 rayDir = normalize(uCamFwd + uv.x*uTanHalfFov*uCamRight + uv.y*uTanHalfFov*uCamUp);
    vec3 rayPos = uCamPos;

    // Base del plano del disco
    vec3 n  = normalize(uDiskNormal);
    vec3 e1 = normalize(cross(n, abs(n.y)<0.95 ? vec3(0,1,0) : vec3(1,0,0)));
    vec3 e2 = cross(n, e1);

    // ── Estado de la estrella (función PURA de uPhase) ──────────────────
    float ph = clamp(uPhase, 0.0, 1.0);
    // cae acelerando (ease-in): rHead de rStart → justo afuera de rIn
    float rHead = mix(uRIn*1.25, uRStart, pow(1.0-ph, 1.9));
    // se enrosca al caer (más vueltas al final, prograde)
    float angHead = uAng0 + uWind*6.2831853*(1.0 - pow(1.0-ph, 2.1));
    vec2  hxy = vec2(cos(angHead), sin(angHead))*rHead;
    vec3  headW = hxy.x*e1 + hxy.y*e2;            // centro de la estrella (en el plano)
    // disrupción: 0 intacta lejos → 1 desgarrada dentro del radio de marea
    float disr = smoothstep(uRTidal*1.4, uRTidal*0.55, rHead);
    // direcciones orbitales en la cabeza
    vec3 tHatH = normalize(-sin(angHead)*e1 + cos(angHead)*e2);
    vec3 rHatH = normalize( cos(angHead)*e1 + sin(angHead)*e2);
    float stretch = 1.0 + uStretch*disr;          // estiramiento a lo largo de la órbita

    // acumuladores
    vec3  accum = vec3(0.0);
    float trans = 1.0;
    float totalDeflect = 0.0;

    float maxR = length(uCamPos) + 70.0;
    float dt   = 0.18*uRs;
    vec3  prevPos = rayPos;
    float prevPlane = dot(rayPos, n);
    bool  escaped=false, absorbed=false;

    for(int i=0;i<220;i++){
      if(float(i) >= uMaxSteps) break;
      float r = length(rayPos);
      if(r < uRs*1.02){ absorbed=true; break; }
      if(r > maxR){ escaped=true; break; }

      vec3 viewDir = normalize(uCamPos - rayPos);   // del punto a la cámara

      // ════ VOLUMEN: estrella + corriente de marea ═══════════════════════
      // proyección al plano del disco
      float hgt = dot(rayPos, n);
      vec3  inPlane = rayPos - hgt*n;
      float rLoc = length(inPlane);
      float phiLoc = atan(dot(rayPos,e2), dot(rayPos,e1));

      vec3  volCol = vec3(0.0);
      float volDen = 0.0;

      // --- estrella / cabeza del espagueti (elipsoide estirado en tHatH) ---
      vec3  dS = rayPos - headW;
      float aT = dot(dS, tHatH)/(uStarR*stretch);
      float aR = dot(dS, rHatH)/(uStarR*(1.0+0.30*disr));
      float aN = dot(dS, n)/(uStarR*0.80);
      float sd = aT*aT + aR*aR + aN*aN;
      float starDen = exp(-sd*3.4)*(1.0 - 0.35*disr);   // núcleo denso que sobrevive
      if(starDen > 0.0015){
        // núcleo solar #fff4ea; cara hacia el BH se calienta por la marea (más blanca-azul)
        float towardBH = clamp(dot(normalize(-headW), normalize(dS)+1e-5), -1.0, 1.0);
        float tStar = 0.58 + 0.18*disr + 0.12*max(towardBH,0.0);
        vec3  sc = bb(tStar) * 4.4;
        sc *= dopplerBoost(max(rHead, uRIn), tHatH, viewDir);
        volCol += sc * starDen;
        volDen += starDen * 1.4;
      }

      // --- corriente de marea (espiral logarítmica, el "espagueti") ---
      if(disr > 0.01 && rLoc > uRIn*0.9 && rLoc < rHead*1.7){
        // ángulo de la centerline de la corriente a este radio (se enrosca hacia adentro)
        float phiStream = angHead - uWind*1.7*log(max(rLoc/rHead, 1e-3));
        float dphi = phiLoc - phiStream;
        dphi = atan(sin(dphi), cos(dphi));
        float lateral = dphi*rLoc;
        float width = uStarR*(0.18 + 0.30*rLoc/uRStart);  // ESTRECHA = arco definido
        float prof = exp(-(lateral*lateral)/(width*width) - (hgt*hgt)/(width*width*0.35));
        float rmask = smoothstep(uRIn*0.9, uRIn*1.5, rLoc)*(1.0 - smoothstep(rHead*1.2, rHead*1.7, rLoc));
        // turbulencia sedosa con contraste (no niebla plana)
        float turb = pow(0.5 + 0.65*fbm(vec2(phiStream*2.5 + log(rLoc)*3.5 - uTime*0.5, log(rLoc)*4.5)), 1.5);
        float strDen = pow(prof, 1.25)*rmask*disr*turb;
        if(strDen > 0.0015){
          // se calienta hacia adentro: cabeza solar (afuera) → blanco-azul cerca de rIn
          float fr = clamp((rLoc-uRIn)/(rHead-uRIn+1e-3), 0.0, 1.0);
          float tStr = mix(0.82, 0.60, fr);   // inner blanco-cálido (no azul → sin morado)
          vec3  vTan = normalize(-sin(phiLoc)*e1 + cos(phiLoc)*e2);
          vec3  cc = bb(tStr) * 4.6;
          cc *= dopplerBoost(rLoc, vTan, viewDir);
          // redshift gravitacional
          cc *= sqrt(max(1e-3, 1.0 - uRs/rLoc));
          volCol += cc * strDen;
          volDen += strDen;
        }
      }

      // ════ DISCO VOLUMÉTRICO = INFIERNO DE PLASMA (slab 3D, caos, no líneas) ════
      // Volumen con GROSOR alrededor del plano → la cámara puede meterse ADENTRO
      // (POV de una partícula en el infierno) y lensea igual. Caos REAL: cizalla
      // Kepleriana (interior gira más rápido = se desgarra) + domain-warp (remolinos)
      // + hot spots de reconexión (millones de K parpadeando), no streamers limpios.
      {
        float hgtA = abs(hgt);
        float diskThick = uRs * (0.5 + 0.10 * rLoc);            // grosor; flarea hacia afuera
        if(rLoc > uRIn*0.96 && rLoc < uROut && hgtA < diskThick*2.6 && uDiskBuild > 0.001){
          float vert   = exp(-(hgtA*hgtA)/(diskThick*diskThick));
          float radial = smoothstep(uRIn*0.96, uRIn*1.15, rLoc) * (1.0 - smoothstep(uROut*0.62, uROut, rLoc));
          float omega  = pow(uRIn/rLoc, 1.5);                    // Ω Kepleriano (cizalla)
          // SIN COSTURA: roto el punto en el plano por la advección orbital Ω·t (moderada,
          // no sobre-enrolla) + WARP FUERTE → rompe lo concéntrico en clumps turbulentos.
          float rot    = omega * uTime * 0.9;
          vec2  ip     = vec2(dot(rayPos,e1), dot(rayPos,e2)) / uRs;
          float cs=cos(rot), sn=sin(rot);
          vec2  rp     = vec2(cs*ip.x - sn*ip.y, sn*ip.x + cs*ip.y);
          vec2  wv     = vec2(fbm3(rp*0.7), fbm3(rp*0.7 + vec2(3.7,1.9)));  // domain-warp 2D
          float chaos  = fbm3(rp*1.2 + wv*3.4);                  // clumps (warp fuerte = turbulento)
          float fine   = fbm3(rp*3.4 + wv*3.0);                  // filamentos finos
          float fine2  = fbm3(rp*7.8 + wv*2.5);                  // detalle MUY fino (textura al estar ADENTRO)
          float plasma = pow(0.26 + 0.74*chaos, 2.4) * (0.42 + 0.65*fine + 0.42*fine2) * 1.6;
          // hot spots de reconexión (millones de K, colisiones): celdas que REVIENTAN
          float flare  = pow(fbm3(rp*1.9 + wv*2.2), 5.0) * 6.0;
          // el choque de la corriente de marea SOBREALIMENTA el disco (fogonazo extra)
          float phiHit = angHead - uWind*1.7*log(max(uRIn/rLoc,1e-3));
          float feed   = exp(-pow(atan(sin(phiLoc-phiHit),cos(phiLoc-phiHit)),2.0)*3.0)*disr;
          float tNorm  = pow(uRIn/rLoc, 0.75);                   // T∝r^−¾
          float tBase  = clamp(0.36 + 0.46*tNorm, 0.0, 1.0);     // ámbar BRILLANTE → interior blanco
          float tHot   = clamp(tBase + flare*0.04 + feed*0.12, 0.0, 1.0);
          vec3  vTanD  = normalize(-sin(phiLoc)*e1 + cos(phiLoc)*e2);
          vec3  dcol   = bb(tHot) * (1.8*plasma + flare + feed*5.0);
          dcol *= dopplerBoost(rLoc, vTanD, viewDir);
          dcol *= sqrt(max(1e-3, 1.0 - uRs/rLoc));               // redshift gravitacional
          float dop = vert * radial * (0.05 + plasma*0.95 + feed*0.5) * uDiskBuild;  // translúcido → PROFUNDIDAD + la sombra asoma a través del infierno
          volCol += dcol * dop;
          volDen += dop * 1.25;
        }
      }

      if(volDen > 0.0){
        float a = 1.0 - exp(-volDen * 1.1 * dt);
        accum += volCol * a * trans;
        trans *= (1.0 - a);
      }
      if(trans < 0.012) break;

      // ════ Curvatura gravitacional (geodésica nula) ═════════════════════
      vec3  toBh = -rayPos/r;
      float strength = 2.0*uRs/(r*r);
      rayDir = normalize(rayDir + toBh*strength*dt);
      // paso FINO dentro del slab del disco (integra el volumen + el POV adentro),
      // grande lejos (rápido). hgt/rLoc ya calculados arriba para este rayPos.
      float thick  = uRs*(0.5 + 0.10*rLoc);
      float inSlab = (abs(hgt) < thick*2.6 && rLoc < uROut*1.05) ? 1.0 : 0.0;
      dt = mix(max(0.05*uRs, r*0.06), uRs*0.13, inSlab);
      rayPos += rayDir*dt;
    }

    vec3 finalColor = accum;

    if(escaped){
      finalColor += stars(rayDir) * trans * 0.55 * uNebula;
    }

    // Anillo de fotones (b ≈ √27/2·rs)
    if(!absorbed){
      float rNow = length(rayPos);
      vec3 radial = rayPos/rNow;
      float sinT = length(cross(rayDir, radial));
      float b = rNow*sinT;
      float bcrit = 2.598*uRs;
      float db = abs(b-bcrit)/(0.07*uRs);
      finalColor += vec3(1.0,0.95,0.82)*exp(-db*db)*1.6*trans;
    }

    finalColor *= uExposure;

    if(uLinearOut < 0.5){
      finalColor = aces(finalColor);
      finalColor = pow(finalColor, vec3(0.92));
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function BHDevour({
  rs = 1.0, rIn = 2.6, rOut = 13.0, rStart = 15.0, rTidal = 7.0, starR = 1.7,
  stretch = 8.0, windings = 1.6, duration = 18, getTime, inclinationDeg = 76,
  exposure = 1.0, dopplerStrength = 1.0, linearOutput = true, maxSteps = 160,
  starSeed = 3.0, nebulaBoost = 1.0,
}: BHDevourProps) {
  const diskNormal = useMemo(() => {
    const incl = (90 - inclinationDeg) * Math.PI / 180;
    return new THREE.Vector3(0, Math.cos(incl), Math.sin(incl)).normalize();
  }, [inclinationDeg]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uPhase: { value: 0 },
    uRs: { value: rs }, uRIn: { value: rIn * rs }, uROut: { value: rOut * rs },
    uRStart: { value: rStart * rs }, uRTidal: { value: rTidal * rs }, uStarR: { value: starR * rs },
    uStretch: { value: stretch }, uWind: { value: windings }, uAng0: { value: 0.6 },
    uExposure: { value: exposure }, uDopplerK: { value: dopplerStrength },
    uLinearOut: { value: linearOutput ? 1 : 0 }, uMaxSteps: { value: maxSteps },
    uStarSeed: { value: starSeed }, uNebula: { value: nebulaBoost }, uDiskBuild: { value: 0 },
    uDiskNormal: { value: diskNormal.clone() },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: 1 }, uAspect: { value: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const p = useRef({ rs, rIn, rOut, rStart, rTidal, starR, stretch, windings, duration, getTime, exposure, dopplerStrength, linearOutput, maxSteps, starSeed, nebulaBoost, diskNormal });
  p.current = { rs, rIn, rOut, rStart, rTidal, starR, stretch, windings, duration, getTime, exposure, dopplerStrength, linearOutput, maxSteps, starSeed, nebulaBoost, diskNormal };

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const WORLD_UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera, clock, size }) => {
    const c = p.current; const u = uniforms;
    const t = c.getTime ? c.getTime() : clock.elapsedTime;
    const ph = Math.max(0, Math.min(1, t / Math.max(1e-3, c.duration)));
    u.uTime.value = t;
    u.uPhase.value = ph;
    u.uRs.value = c.rs; u.uRIn.value = c.rIn * c.rs; u.uROut.value = c.rOut * c.rs;
    u.uRStart.value = c.rStart * c.rs; u.uRTidal.value = c.rTidal * c.rs; u.uStarR.value = c.starR * c.rs;
    u.uStretch.value = c.stretch; u.uWind.value = c.windings;
    u.uExposure.value = c.exposure; u.uDopplerK.value = c.dopplerStrength;
    u.uLinearOut.value = c.linearOutput ? 1 : 0; u.uMaxSteps.value = c.maxSteps;
    u.uStarSeed.value = c.starSeed; u.uNebula.value = c.nebulaBoost;
    u.uDiskNormal.value.copy(c.diskNormal);
    // El disco YA EXISTE (es un BH ACTIVO / AGN, no nace vacío). La estrella que cae
    // lo FLAREA — no lo crea. Base fuerte desde t=0 + brillo extra cuando es devorada.
    const flare = Math.min(1, Math.max(0, (ph - 0.34) / 0.4));
    u.uDiskBuild.value = 0.72 + 0.28 * flare;
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(fwd);
    right.crossVectors(fwd, WORLD_UP).normalize();
    up.crossVectors(right, fwd).normalize();
    u.uCamPos.value.copy(cam.position);
    u.uCamFwd.value.copy(fwd); u.uCamRight.value.copy(right); u.uCamUp.value.copy(up);
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
