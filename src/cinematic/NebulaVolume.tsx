/**
 * NebulaVolume — EL GRIAL: raymarcher volumétrico alimentado por la DENSIDAD REAL de la
 * simulación de partículas (turbulent-nebula-sim.py exporta <out>-vol.bin, un campo de
 * densidad 3D uint8). Las FORMAS son física pura (concentración lagrangiana), pero el
 * render aplica un UMBRAL DURO (smoothstep) sobre la densidad → talla HILOS FILOSOS
 * (iso-render), lo que el aditivo de puntos no podía. Color por densidad (azul→teal→oro→rojo,
 * líneas de emisión del Velo/Cangrejo). Salida LINEAL → el único ACES lo hace CinematicPostFX.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface NebulaVolumeProps {
  url?: string; dim?: number; scale?: number; getTime?: () => number;
  exposure?: number; thresh?: number; soft?: number; gamma?: number;
  steps?: number; rot?: number; absorb?: number; starSeed?: number;
}

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
  uniform float uTime, uScale, uExposure, uThresh, uSoft, uGamma, uSteps, uRot, uAbsorb, uStarSeed;
  uniform vec3  uCamPos, uCamFwd, uCamRight, uCamUp;
  uniform float uTanHalfFov, uAspect;

  // color de líneas de emisión por densidad: azul → cian → verde → oro → rojo (Velo/Cangrejo)
  // FRÍA / etérea (sincrotrón). ROJO BAJO en TODA la rampa → aunque el aditivo acumule,
  // el canal R no sube → los hilos densos se quedan CIAN/TEAL, NO se blanquean.
  vec3 nebColor(float d){
    vec3 c1=vec3(0.05,0.18,0.75);  // azul profundo (difuso)
    vec3 c2=vec3(0.05,0.52,1.00);  // azul-cian
    vec3 c3=vec3(0.08,0.88,1.00);  // cian
    vec3 c4=vec3(0.16,1.00,0.96);  // teal (R BAJO → no blanquea)
    vec3 c5=vec3(0.38,1.00,0.92);  // teal claro (solo nudos; R aún moderado)
    d=clamp(d,0.0,1.0);
    if(d<0.30) return mix(c1,c2,d/0.30);
    if(d<0.60) return mix(c2,c3,(d-0.30)/0.30);
    if(d<0.85) return mix(c3,c4,(d-0.60)/0.25);
    return mix(c4,c5,(d-0.85)/0.15);
  }
  // starfield (mismo método que PulsarNebula) — void con estrellas, no negro muerto
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

  void main(){
    vec2 uv = vUv*2.0 - 1.0; uv.x *= uAspect;
    vec3 rd = normalize(uCamFwd + uv.x*uTanHalfFov*uCamRight + uv.y*uTanHalfFov*uCamUp);
    vec3 ro = uCamPos;
    // rota el RAYO al marco del volumen (la nebulosa "gira" como las partículas)
    float ang = uTime*uRot; float ca=cos(ang), sa=sin(ang);
    mat3 Rinv = mat3(ca,0.0,-sa, 0.0,1.0,0.0, sa,0.0,ca);
    vec3 roL = Rinv*ro, rdL = Rinv*rd;
    // intersección con el cubo [-uScale,uScale]^3
    vec3 inv = 1.0/rdL;
    vec3 ta = (-vec3(uScale)-roL)*inv, tb = (vec3(uScale)-roL)*inv;
    vec3 tmin = min(ta,tb), tmax = max(ta,tb);
    float tn = max(max(tmin.x,tmin.y),tmin.z);
    float tf = min(min(tmax.x,tmax.y),tmax.z);
    vec3 col = vec3(0.0); float trans = 1.0;
    if(tf > tn && tf > 0.0){
      tn = max(tn, 0.0);
      float dt = (tf-tn)/uSteps;
      // jitter para romper el banding del raymarch
      float j = hash21(gl_FragCoord.xy)*dt;
      for(int i=0;i<256;i++){
        if(float(i) >= uSteps) break;
        float t = tn + (float(i)+0.5)*dt + j;
        vec3 pL = roL + rdL*t;
        vec3 tc = (pL/uScale)*0.5 + 0.5;                 // → [0,1] coords de textura
        float d = texture(uVol, tc).r;
        // TRANSFER CRISP: umbral duro → solo lo denso emite (hilos filosos)
        float fil = smoothstep(uThresh, uThresh+uSoft, d);
        float em  = fil * pow(d, uGamma);
        // COLOR por DENSIDAD (fría/etérea): difuso azul-cian, hilos teal, nudos oro pálido.
        vec3  c   = nebColor(d) * em;
        float dens = fil * d;
        col   += c * trans * dt * 9.0;                   // emisión
        trans *= exp(-dens * uAbsorb * dt);              // absorción
        if(trans < 0.02) break;
      }
    }
    col += stars(rd) * trans * 0.5;
    fragColor = vec4(col * uExposure, 1.0);              // LINEAL → ACES único en CinematicPostFX
  }
`;

export default function NebulaVolume({
  url = '/turb-nebula-vol.bin', dim = 192, scale = 30, getTime,
  exposure = 1.0, thresh = 0.12, soft = 0.10, gamma = 1.1, steps = 128, rot = 0.035,
  absorb = 5.0, starSeed = 2.2,
}: NebulaVolumeProps) {
  const [tex, setTex] = useState<THREE.Data3DTexture | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const data = new Uint8Array(buf);
      const t = new THREE.Data3DTexture(data, dim, dim, dim);
      t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      setTex(t);
    }).catch(e => console.error('[NebulaVolume] no cargó', url, e));
    return () => { alive = false; };
  }, [url, dim]);

  const uniforms = useMemo(() => ({
    uVol: { value: null as THREE.Data3DTexture | null }, uTime: { value: 0 },
    uScale: { value: scale }, uExposure: { value: exposure }, uThresh: { value: thresh },
    uSoft: { value: soft }, uGamma: { value: gamma }, uSteps: { value: steps },
    uRot: { value: rot }, uAbsorb: { value: absorb }, uStarSeed: { value: starSeed },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
    uTanHalfFov: { value: 1 }, uAspect: { value: 1 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const p = useRef({ scale, exposure, thresh, soft, gamma, steps, rot, absorb, starSeed, getTime });
  p.current = { scale, exposure, thresh, soft, gamma, steps, rot, absorb, starSeed, getTime };
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const upv = useMemo(() => new THREE.Vector3(), []);
  const WUP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera, clock, size }) => {
    const c = p.current, u = uniforms;
    if (tex) u.uVol.value = tex;
    u.uTime.value = c.getTime ? c.getTime() : clock.elapsedTime;
    u.uScale.value = c.scale; u.uExposure.value = c.exposure; u.uThresh.value = c.thresh;
    u.uSoft.value = c.soft; u.uGamma.value = c.gamma; u.uSteps.value = c.steps;
    u.uRot.value = c.rot; u.uAbsorb.value = c.absorb; u.uStarSeed.value = c.starSeed;
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
