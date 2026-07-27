/**
 * CinematicRomerNebula — "La nube que no podía brillar" (Romer 1990, Nobel 2018).
 * EL MUNDO-NEBULOSA: el raymarcher volumétrico del púlsar (NebulaVolume, EL GRIAL)
 * contando el modelo Solow→Romer REAL.
 *
 * LA METÁFORA (física real de regiones HII):
 *   · La economía = nube molecular. El capital K = el polvo/gas que acumula.
 *     Acumular SIN ideas solo la hace MÁS OSCURA (más polvo = más extinción). LA TRAMPA.
 *   · La idea = una estrella que se ENCIENDE adentro. Su frente de ionización
 *     (esfera de Strömgren, R(t) = Rs·(1−e^(−t/trec))^{1/3} — ley real) barre los
 *     filamentos y los prende uno a uno. La MISMA luz toca todo el polvo sin
 *     gastarse: la idea es NO-RIVAL.
 *   · La copia = la luz alcanza a la nube vecina (la besa por el lado que mira a
 *     la estrella), y el vecino enciende su PROPIA estrella. Nada se apaga en la
 *     primera: formación estelar disparada. dA/dt = g·A compone y ambas arden.
 *
 * El modelo económico se integra UNA vez (Euler, dt=0.02) y sus series A(τ), K(τ),
 * Y(τ) mandan luminosidades, frentes y extinción. Nada inventado.
 * Determinista: window.__cinematicRomer.renderAt(t) PURO en t ∈ [0, 62].
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CinematicPostFX from './CinematicPostFX';

const DURATION = 62;
type Vec3 = [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const ss = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// ── EL MODELO (Solow→Romer), integrado UNA vez: arrays muestreados a 0.1 s ──
const ALPHA = 1 / 3, S1 = 0.55, S2 = 0.30, DELTA = 0.13;
const T_IDEA = 20, T_COPY = 36, G_IDEAS = 0.058;
const T_B = T_COPY + 1.5;                                    // el vecino enciende en τ=37.5
const KSTAR = Math.pow(S1 / DELTA, 1 / (1 - ALPHA));         // steady state SIN ideas (la trampa)
const KSTAR2 = Math.pow(S2 / DELTA, 1 / (1 - ALPHA));
type ModelRow = { K1: number; A1: number; K2: number; A2: number };
function integrateModel(): ModelRow[] {
  const rows: ModelRow[] = [];
  let K1 = 0.35, A1 = 1, K2 = 0.22, A2 = 1;
  const dt = 0.02;
  for (let tau = 0; tau <= 70 + 1e-9; tau += dt) {
    if (rows.length <= tau * 10 + 0.5 && Math.round(tau * 10) / 10 === Math.round(rows.length * 0.1 * 10) / 10) {
      rows.push({ K1, A1, K2, A2 });
    }
    const g1 = G_IDEAS * ss((tau - T_IDEA) / 4);
    const g2 = G_IDEAS * ss((tau - T_B) / 4);
    const Y1 = A1 * Math.pow(Math.max(K1, 1e-6), ALPHA);
    const Y2 = A2 * Math.pow(Math.max(K2, 1e-6), ALPHA);
    K1 += (S1 * Y1 - DELTA * K1) * dt;
    K2 += (S2 * Y2 - DELTA * K2) * dt;
    A1 += g1 * A1 * dt;
    A2 += g2 * A2 * dt;
  }
  return rows;
}
const MODEL = integrateModel();
function modelAt(tau: number): ModelRow {
  const x = Math.max(0, Math.min(MODEL.length - 1.001, tau * 10));
  const i = Math.floor(x), f = x - i;
  const a = MODEL[i], b = MODEL[i + 1];
  return { K1: lerp(a.K1, b.K1, f), A1: lerp(a.A1, b.A1, f), K2: lerp(a.K2, b.K2, f), A2: lerp(a.A2, b.A2, f) };
}
// FLASH-FORWARD puro en t: los primeros 1.5 s enseñan el clímax (τ≈50) y CORTE seco a τ=t.
const modelTau = (t: number) => (t < 1.5 ? 49 + t * 2.0 : t);

// ── GEOMETRÍA (apilado vertical → llena el 9:16) ──
const CTR_A: Vec3 = [0, 2.4, 0];       const RAD_A = 3.2;    // nuestra economía (arriba)
const CTR_B: Vec3 = [0.35, -3.5, 0.3]; const RAD_B = 2.2;    // el vecino (abajo, más pobre)
const STAR_A: Vec3 = [0.55, 2.7, 0.35];                      // donde nace la idea
const STAR_B: Vec3 = [0.15, -3.3, 0.15];
const BOX: Vec3 = [7.5, 7.5, 6.0];

// ── DRIVE: modelo → luminosidades, frentes, extinción (PURO en τ) ──
type Drive = {
  lumA: number; frontA: number; emA: number; preA: number; radA: number;
  lumB: number; frontB: number; emB: number; extB: number; radB: number;
  absorb: number;
};
function driveAt(tau: number): Drive {
  const m = modelAt(tau);
  // frente de ionización: saturación exponencial (ritmo fase-D, legible en cámara;
  // la fase R real barre en ~ms — eso no se puede filmar)
  const frontA = tau > T_IDEA ? 1.38 * (1 - Math.exp(-(tau - T_IDEA) / 6.5)) : 0;
  const frontB = tau > T_B ? 1.32 * (1 - Math.exp(-(tau - T_B) / 5.5)) : 0;
  // flash de encendido (pico corto) + luminosidad ∝ A(τ) (las ideas componen)
  const flashA = ss((tau - T_IDEA) / 0.7) * (1 - ss((tau - T_IDEA - 1.6) / 2.8));
  const flashB = ss((tau - T_B) / 0.7) * (1 - ss((tau - T_B - 1.6) / 2.8));
  const lumA = ss((tau - T_IDEA) / 1.1) * (0.55 + 0.45 * Math.min(1, (m.A1 - 1) / 2.5)) + flashA * 0.9;
  const lumB = ss((tau - T_B) / 1.1) * (0.55 + 0.45 * Math.min(1, (m.A2 - 1) / 2.5)) + flashB * 0.9;
  // Y(τ) manda la ganancia de emisión del gas ionizado
  const Y1 = m.A1 * Math.pow(Math.max(m.K1, 1e-6), ALPHA);
  const Y2 = m.A2 * Math.pow(Math.max(m.K2, 1e-6), ALPHA);
  const emA = 0.45 + 0.55 * Math.min(1, Y1 / 9.0);
  const emB = 0.45 + 0.55 * Math.min(1, Y2 / 6.0);
  // brasa pre-ignición (anticipación: algo se forma en el núcleo)
  const preA = ss((tau - 17.5) / 2.2) * (1 - ss((tau - T_IDEA) / 0.6));
  // K = polvo: la nube CRECE con K; en la trampa se aprieta; al encender, respira
  const kn1 = Math.min(1, m.K1 / KSTAR), kn2 = Math.min(1, m.K2 / KSTAR2);
  const squeeze = 1 - 0.05 * ss((tau - 13) / 7) * (1 - ss((tau - T_IDEA) / 2));
  const breathe = 1 + 0.06 * ss((tau - T_IDEA) / 8);
  const radA = RAD_A * (0.80 + 0.20 * kn1) * squeeze * breathe;
  const radB = RAD_B * (0.80 + 0.20 * kn2) * (1 + 0.06 * ss((tau - T_B) / 8));
  // más capital sin ideas = más polvo = MÁS OSCURA (la trampa, literal)
  const absorb = 7.5 * (0.55 + 0.45 * kn1);
  // luz de A besando al vecino (no-rival: A no pierde nada)
  const extB = lumA * 1.15;
  return { lumA, frontA, emA, preA, radA, lumB, frontB, emB, extB, radB, absorb };
}

// ── EL RAYMARCHER (fork de NebulaVolume: 2 nubes + ignición Strömgren + estrellas embebidas) ──
const VERT = /* glsl */`
  out vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAG = /* glsl */`
  precision highp float;
  precision highp sampler3D;
  in vec2 vUv;
  out vec4 fragColor;
  uniform sampler3D uVol;
  uniform float uTime, uAspect, uTanHalfFov, uSteps, uThresh, uSoft, uGamma, uAbsorb, uExposure, uStarSeed;
  uniform vec3 uCamPos, uCamFwd, uCamRight, uCamUp, uBoxHalf;
  uniform vec3 uCtrA, uStarA; uniform float uRadA, uLumA, uFrontA, uEmA, uPreA;
  uniform vec3 uCtrB, uStarB; uniform float uRadB, uLumB, uFrontB, uEmB, uExtB;

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
          vec2 dd=cf-pp; float di2=dot(dd,dd);
          float it=exp(-di2*92.0)*(h-thr)*330.0; float tt=hash21(cc+7.0);
          vec3 tint=mix(vec3(0.7,0.82,1.0),vec3(1.0,0.82,0.6),tt); col+=tint*it*(1.0/pow(1.3,float(L))); }
      }
    }
    return col;
  }

  // polvo FRÍO: azul profundo apenas dispersando luz de estrellas (R≈0 → nunca blanquea)
  vec3 coldRamp(float d){
    vec3 c1=vec3(0.012,0.030,0.085);
    vec3 c2=vec3(0.045,0.075,0.190);
    vec3 c3=vec3(0.085,0.115,0.280);
    if(d<0.5) return mix(c1,c2,d/0.5);
    return mix(c2,c3,(d-0.5)/0.5);
  }
  // gas IONIZADO: temperatura cae con la distancia a la estrella →
  // oro junto a ella, ámbar en medio, teal (OIII) en la periferia. El mix va
  // gamma-pesado para cruzar rápido la zona media (nada de verdes sucios).
  vec3 hotColor(float d, float irr){
    vec3 far_ =vec3(0.055,0.46,0.60);
    vec3 mid_ =vec3(0.95,0.42,0.12);
    vec3 near_=vec3(1.00,0.80,0.42);
    float w=clamp(irr,0.0,1.0);
    vec3 base = (w<0.55) ? mix(far_,mid_,pow(w/0.55,1.6)) : mix(mid_,near_,(w-0.55)/0.45);
    return base*(0.65+0.6*d);
  }
  // muestrea la nube: coords locales esféricas + rotación lenta propia; el vecino
  // usa un swizzle del MISMO campo → forma distinta sin otra textura
  float sampleNeb(vec3 p, vec3 ctr, float rad, float flavor, float ang, out float rr){
    vec3 q=(p-ctr)/rad;
    rr=length(q);
    if(rr>1.0) return 0.0;
    float ca=cos(ang), sa=sin(ang);
    q.xz=mat2(ca,-sa,sa,ca)*q.xz;
    vec3 tc = flavor<0.5 ? q : vec3(-q.z, q.y*0.92, q.x);
    float d=texture(uVol, tc*0.5+0.5).r;
    return d*smoothstep(1.0,0.72,rr);
  }

  void main(){
    vec2 uv=vUv*2.0-1.0; uv.x*=uAspect;
    vec3 rd=normalize(uCamFwd + uv.x*uTanHalfFov*uCamRight + uv.y*uTanHalfFov*uCamUp);
    vec3 ro=uCamPos;
    vec3 inv=1.0/rd;
    vec3 ta=(-uBoxHalf-ro)*inv, tb=(uBoxHalf-ro)*inv;
    vec3 tmin=min(ta,tb), tmax=max(ta,tb);
    float tn=max(max(tmin.x,tmin.y),tmin.z);
    float tf=min(min(tmax.x,tmax.y),tmax.z);
    vec3 col=vec3(0.0); float trans=1.0;
    // estrellas embebidas: acorde de máximo acercamiento + transmitancia AL cruzarlas
    float tSA=clamp(dot(uStarA-ro,rd),0.0,1e5), tSB=clamp(dot(uStarB-ro,rd),0.0,1e5);
    float transA=-1.0, transB=-1.0;
    float angA=0.55+uTime*0.016, angB=2.10-uTime*0.013;
    if(tf>tn && tf>0.0){
      tn=max(tn,0.0);
      float dt=(tf-tn)/uSteps;
      float j=hash21(gl_FragCoord.xy)*dt;
      for(int i=0;i<256;i++){
        if(float(i)>=uSteps) break;
        float t=tn+(float(i)+0.5)*dt+j;
        if(transA<0.0 && t>tSA) transA=trans;
        if(transB<0.0 && t>tSB) transB=trans;
        vec3 p=ro+rd*t;
        float dens=0.0;
        // ── nube A (nuestra economía) ──
        float rrA; float dA=sampleNeb(p,uCtrA,uRadA,0.0,angA,rrA);
        if(dA>0.004){
          float fil=smoothstep(uThresh,uThresh+uSoft,dA);
          float em=fil*pow(dA,uGamma);
          float rs=length(p-uStarA)/uRadA;
          float ion=(1.0-smoothstep(uFrontA-0.16,uFrontA+0.05,rs))*step(0.02,uFrontA);
          float rim=exp(-pow((rs-uFrontA)/0.055,2.0))*step(0.02,uFrontA);
          float irr=clamp(uLumA*0.18/(rs*rs+0.04),0.0,1.0);
          vec3 cCold=coldRamp(dA)*0.55
                    + vec3(1.0,0.42,0.12)*uPreA*exp(-rs*rs*9.0)*1.6;   // brasa pre-ignición
          vec3 cHot=hotColor(dA,irr)*(0.22+0.60*irr)*uEmA;
          vec3 c=mix(cCold,cHot,ion)*em
                + vec3(1.0,0.85,0.55)*rim*fil*(0.5+0.5*uLumA)*0.85;     // el FRENTE brilla
          col+=c*trans*dt*9.0;
          dens+=fil*dA*(1.0-0.38*ion);                                  // ionizado = tallado
        }
        // ── nube B (el vecino) ──
        float rrB; float dB=sampleNeb(p,uCtrB,uRadB,1.0,angB,rrB);
        if(dB>0.004){
          float fil=smoothstep(uThresh,uThresh+uSoft,dB);
          float em=fil*pow(dB,uGamma);
          float rs=length(p-uStarB)/uRadB;
          float ion=(1.0-smoothstep(uFrontB-0.16,uFrontB+0.05,rs))*step(0.02,uFrontB);
          float rim=exp(-pow((rs-uFrontB)/0.055,2.0))*step(0.02,uFrontB);
          float irr=clamp(uLumB*0.18/(rs*rs+0.04),0.0,1.0);
          // la luz de A lo BESA por el lado que la mira (no-rival: A no pierde nada)
          vec3 toA=p-uStarA; float d2A=dot(toA,toA);
          float ext=uExtB*3.0/(d2A+1.0);
          vec3 cCold=coldRamp(dB)*0.55 + vec3(1.0,0.60,0.28)*ext*dB*1.2;
          vec3 cHot=hotColor(dB,irr)*(0.22+0.60*irr)*uEmB;
          vec3 c=mix(cCold,cHot,ion)*em
                + vec3(1.0,0.85,0.55)*rim*fil*(0.5+0.5*uLumB)*0.85;
          col+=c*trans*dt*9.0;
          dens+=fil*dB*(1.0-0.38*ion);
        }
        trans*=exp(-dens*uAbsorb*dt);
        if(trans<0.015) break;
      }
    }
    if(transA<0.0) transA=trans;
    if(transB<0.0) transB=trans;
    // las estrellas-idea: núcleo caliente + halo 1/r² — el polvo las OCLUYE de verdad
    if(uLumA>0.003){
      vec3 pc=ro+rd*tSA; vec3 dv=pc-uStarA; float b2=dot(dv,dv);
      col+=vec3(1.0,0.92,0.78)*uLumA*(exp(-b2*900.0)*22.0+0.007/(b2+0.002))*transA;
    }
    if(uLumB>0.003){
      vec3 pc=ro+rd*tSB; vec3 dv=pc-uStarB; float b2=dot(dv,dv);
      col+=vec3(0.95,0.90,0.82)*uLumB*(exp(-b2*900.0)*22.0+0.007/(b2+0.002))*transB;
    }
    col+=stars(rd)*trans*0.5;
    fragColor=vec4(col*uExposure,1.0);                                  // LINEAL → ACES único en PostFX
  }
`;

let VOL_READY = false;

function RomerVolume({ getTime }: { getTime: () => number }) {
  const [tex, setTex] = useState<THREE.Data3DTexture | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/turb-nebula-vol.bin').then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const data = new Uint8Array(buf);
      const t = new THREE.Data3DTexture(data, 192, 192, 192);
      t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      setTex(t); VOL_READY = true;
    }).catch(e => console.error('[RomerVolume] no cargó /turb-nebula-vol.bin', e));
    return () => { alive = false; };
  }, []);

  const uniforms = useMemo(() => ({
    uVol: { value: null as THREE.Data3DTexture | null },
    uTime: { value: 0 }, uAspect: { value: 1 }, uTanHalfFov: { value: 1 },
    uSteps: { value: 150 }, uThresh: { value: 0.15 }, uSoft: { value: 0.09 },
    uGamma: { value: 1.35 }, uAbsorb: { value: 7.5 }, uExposure: { value: 1.0 },
    uStarSeed: { value: 3.7 },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
    uBoxHalf: { value: new THREE.Vector3(...BOX) },
    uCtrA: { value: new THREE.Vector3(...CTR_A) }, uStarA: { value: new THREE.Vector3(...STAR_A) },
    uRadA: { value: RAD_A }, uLumA: { value: 0 }, uFrontA: { value: 0 }, uEmA: { value: 0.5 }, uPreA: { value: 0 },
    uCtrB: { value: new THREE.Vector3(...CTR_B) }, uStarB: { value: new THREE.Vector3(...STAR_B) },
    uRadB: { value: RAD_B }, uLumB: { value: 0 }, uFrontB: { value: 0 }, uEmB: { value: 0.5 }, uExtB: { value: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const upv = useMemo(() => new THREE.Vector3(), []);
  const WUP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera, size }) => {
    const u = uniforms;
    if (tex) u.uVol.value = tex;
    const t = getTime();
    const tau = modelTau(t);
    const d = driveAt(tau);
    u.uTime.value = t;
    u.uLumA.value = d.lumA; u.uFrontA.value = d.frontA; u.uEmA.value = d.emA;
    u.uPreA.value = d.preA; u.uRadA.value = d.radA;
    u.uLumB.value = d.lumB; u.uFrontB.value = d.frontB; u.uEmB.value = d.emB;
    u.uExtB.value = d.extB; u.uRadB.value = d.radB;
    u.uAbsorb.value = d.absorb;
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(fwd);
    right.crossVectors(fwd, WUP).normalize();
    upv.crossVectors(right, fwd).normalize();
    u.uCamPos.value.copy(cam.position); u.uCamFwd.value.copy(fwd);
    u.uCamRight.value.copy(right); u.uCamUp.value.copy(upv);
    u.uTanHalfFov.value = Math.tan((cam.fov * Math.PI / 180) / 2);
    u.uAspect.value = size.width / size.height;
  });

  if (!tex) return null;
  return (
    <mesh renderOrder={-90} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial glslVersion={THREE.GLSL3} depthWrite={false} depthTest={false}
        transparent={false} toneMapped={false} uniforms={uniforms}
        vertexShader={VERT} fragmentShader={FRAG} />
    </mesh>
  );
}

// ── CÁMARA: planos FIJOS + cortes secos, micro-drift de peso (lenguaje Limones) ──
type Shot = { t0: number; t1: number; pos: Vec3; look: Vec3; fov: number; drift?: number; zoom?: number };
const SHOTS: Shot[] = [
  // FF — el clímax YA: la nube ardiendo, la estrella entre filamentos
  { t0: 0,    t1: 1.5,  pos: [2.6, 0.8, 5.0],   look: [0, 1.9, 0],        fov: 46, drift: 0.10 },
  // A1 TRAMPA — wide: dos nubes OSCURAS contra el campo de estrellas (silueta)
  { t0: 1.5,  t1: 12,   pos: [0.4, 0.4, 11.8],  look: [0, 0.6, 0],        fov: 44, drift: 0.05 },
  // A2 PREGUNTA — pegado a los filamentos en silueta; la brasa asoma al final
  { t0: 12,   t1: 20,   pos: [2.3, 2.6, 5.4],   look: [-0.3, 2.5, 0],     fov: 44, drift: 0.09 },
  // A3 LA IDEA — la estrella ENCIENDE y el frente barre los filamentos
  { t0: 20,   t1: 32,   pos: [2.0, 1.7, 5.6],   look: [0.55, 2.7, 0.35],  fov: 44, drift: 0.07, zoom: 0.10 },
  // A4 LA COPIA — two-shot: A arde arriba, su luz besa a B, B enciende
  { t0: 32,   t1: 42,   pos: [1.4, -0.7, 12.2], look: [0.1, -0.5, 0],     fov: 44, drift: 0.05 },
  // A5 BOLA DE NIEVE — cerca del vecino ardiendo, A brillando arriba
  { t0: 42,   t1: 52,   pos: [2.5, -2.9, 5.6],  look: [0.2, -2.4, 0],     fov: 44, drift: 0.08 },
  // A6 LA PAZ — pull-back wide: dos economías ardiendo (peak-end)
  { t0: 52,   t1: 62.1, pos: [0.3, -0.6, 15.0], look: [0, -0.2, 0],       fov: 44, drift: 0.03, zoom: -0.04 },
];
function cameraAt(t: number): { pos: Vec3; look: Vec3; fov: number } {
  let s = SHOTS[SHOTS.length - 1];
  for (const sh of SHOTS) { if (t >= sh.t0 && t < sh.t1) { s = sh; break; } }
  const k = (t - s.t0) / Math.max(0.001, s.t1 - s.t0);
  const d = s.drift ?? 0.05;
  const f = 1 - (s.zoom ?? 0.03) * ss(k);
  const bobY = Math.sin(t * 0.45 + s.t0) * d * 0.4;
  const bobX = Math.cos(t * 0.33 + s.t0 * 2) * d * 0.3;
  return { pos: [s.pos[0] * f + bobX, s.pos[1] * f + bobY, s.pos[2] * f], look: s.look, fov: s.fov };
}

function CameraRig({ getTime, vertical }: { getTime: () => number; vertical: boolean }) {
  const { camera } = useThree();
  useFrame(() => {
    const { pos, look, fov } = cameraAt(getTime());
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = vertical ? fov * 1.32 : fov;
    cam.near = 0.1; cam.far = 900;
    cam.updateProjectionMatrix();
  });
  return null;
}

// ── Main ──
export default function CinematicRomerNebula({ live = false }: { live?: boolean }) {
  const timeRef = useRef(0);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );
  useEffect(() => {
    const onR = () => setVertical(window.innerHeight > window.innerWidth);
    onR(); window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); },
      duration: DURATION,
      get ready() { return VOL_READY; },
      get t() { return timeRef.current; },
      beats: [
        { name: 'FF', t0: 0, t1: 1.5 }, { name: 'trampa', t0: 1.5, t1: 12 },
        { name: 'pregunta', t0: 12, t1: 20 }, { name: 'idea', t0: 20, t1: 32 },
        { name: 'copia', t0: 32, t1: 42 }, { name: 'bola', t0: 42, t1: 52 },
        { name: 'paz', t0: 52, t1: 62 },
      ],
    };
    const w = window as unknown as { __cinematicRomer?: typeof api; __cinematicAtom?: typeof api };
    w.__cinematicRomer = api; w.__cinematicAtom = api;   // alias: reusar tooling de stills/render
    return () => { delete w.__cinematicRomer; delete w.__cinematicAtom; };
  }, [live]);

  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      timeRef.current = ((now - start) / 1000) % DURATION;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0.4, 0.6, 14.5], fov: 44, near: 0.1, far: 900 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={1}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}
        style={{ background: '#000' }}
      >
        <CameraRig getTime={() => timeRef.current} vertical={vertical} />
        <RomerVolume getTime={() => timeRef.current} />
        <CinematicPostFX preset="pulsar" bloomIntensity={0.75} bloomThreshold={0.30}
          saturation={0.22} contrast={0.15} grainOpacity={0.06} vignetteDarkness={0.58} />
      </Canvas>
    </div>
  );
}
