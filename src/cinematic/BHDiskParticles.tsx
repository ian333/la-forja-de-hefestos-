/**
 * BHDiskParticles — disco de acreción de agujero negro como NUBE DE PARTÍCULAS formada
 * desde la física (scripts/bh-disk-sim.py: Kepler + turbulencia MRI vía cara-i + inspiral).
 * Mismo motor que el púlsar; aquí el color y el brillo son los del disco:
 *   · TEMPERATURA Shakura-Sunyaev T∝r^−¾ → color cuerpo negro (interior blanco-azul → exterior ámbar).
 *   · BEAMING DOPPLER δ⁴ del movimiento orbital (lado que se acerca brilla+azulea).
 *   · brillo = concentración (compresión turbulenta) + borde interno incandescente.
 * Disco en el plano XZ (y=grosor). Formato .bin: float32 x,y,z,bright por partícula.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BHDiskParticlesProps {
  url?: string;
  scale?: number;        // posiciones del sim → unidades de escena
  rs?: number;           // radio de Schwarzschild en unidades de escena (para β y color)
  size?: number;
  exposure?: number;
  dopplerStrength?: number;
  getTime?: () => number;
}

export default function BHDiskParticles({
  url = '/bh-disk.bin', scale = 14.0, rs = 2.0, size = 2.2, exposure = 0.5,
  dopplerStrength = 1.0, getTime,
}: BHDiskParticlesProps) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf); const n = Math.floor(f.length / 4);
      const pos = new Float32Array(n * 3), bri = new Float32Array(n);
      let rin = 1e9;
      for (let i = 0; i < n; i++) {
        const x = f[i*4], y = f[i*4+1], z = f[i*4+2];
        pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z; bri[i] = f[i*4+3];
        const rr = Math.hypot(x, z); if (rr < rin) rin = rr;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
      g.userData.rin = rin;
      setGeo(g);
    }).catch(e => console.error('[BHDiskParticles] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uSize: { value: size }, uExposure: { value: exposure }, uScale: { value: scale },
      uRs: { value: rs }, uRin: { value: 0.3 }, uDopK: { value: dopplerStrength },
      uCamPos: { value: new THREE.Vector3() }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute float aBright;
      uniform float uSize, uScale, uRs, uRin, uDopK;
      uniform vec3 uCamPos;
      varying vec3 vCol; varying float vB;
      // cuerpo negro por T normalizada (rampa DOCTRINA-COLOR): ámbar→blanco→azul pálido
      vec3 bb(float t){
        t=clamp(t,0.0,1.0);
        vec3 c0=vec3(1.0,0.30,0.05), c1=vec3(1.0,0.62,0.30), c2=vec3(1.0,0.95,0.88),
             c3=vec3(0.92,0.95,1.0), c4=vec3(0.66,0.78,1.0);
        if(t<0.35) return mix(c0,c1,t/0.35);
        if(t<0.62) return mix(c1,c2,(t-0.35)/0.27);
        if(t<0.82) return mix(c2,c3,(t-0.62)/0.20);
        return mix(c3,c4,(t-0.82)/0.18);
      }
      void main(){
        vec3 wp = position * uScale;
        float r = length(wp.xz) + 1e-4;                 // radio en el plano del disco
        float rInS = uRin * uScale;
        // TEMPERATURA Shakura-Sunyaev T∝r^−¾
        float tN = pow(rInS / r, 0.75);
        float tCol = clamp(0.30 + 0.62*tN, 0.0, 1.0);
        vec3 col = bb(tCol);
        // borde interno incandescente
        float hot = exp(-pow((r - rInS)/(rInS*0.5), 2.0));
        // BEAMING DOPPLER δ⁴ (velocidad orbital Kepleriana β=√(rs/2r))
        vec3 tang = normalize(vec3(-wp.z, 0.0, wp.x));   // tangente orbital (prograda)
        vec3 viewDir = normalize(uCamPos - wp);
        float beta = clamp(sqrt(uRs/(2.0*max(r,uRs*1.1))), 0.0, 0.85);
        float gam = 1.0/sqrt(1.0-beta*beta);
        float cosT = dot(tang, -viewDir);
        float delta = 1.0/(gam*(1.0 - beta*cosT));
        float beam = pow(clamp(delta,0.2,3.0), 4.0)*uDopK + (1.0-uDopK);
        vec3 shift = mix(vec3(1.0,0.6,0.4), vec3(0.7,0.83,1.0), clamp((delta-0.7)/0.7,0.0,1.0));
        vCol = (col + vec3(1.0,0.97,0.93)*hot*0.8) * beam * shift;
        vB = aBright;
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.5 + 1.0*aBright) * (300.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uExposure;
      varying vec3 vCol; varying float vB;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r2 = dot(d,d);
        if(r2 > 0.25) discard;
        float a = exp(-r2*3.2);
        vec3 c = vCol * (0.05 + 0.4*vB) * a * uExposure;
        gl_FragColor = vec4(c, a);
      }`,
  }), [size, exposure, scale, rs, dopplerStrength]);

  const p = useRef({ getTime });
  p.current = { getTime };
  useFrame(({ camera, clock }) => {
    mat.uniforms.uTime.value = p.current.getTime ? p.current.getTime() : clock.elapsedTime;
    mat.uniforms.uCamPos.value.copy(camera.position);
    if (geo) mat.uniforms.uRin.value = geo.userData.rin || 0.3;
  });

  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
