/**
 * PulsarEngine — el MOTOR del púlsar (núcleo NS + toro ecuatorial + jets bipolares),
 * partículas de scripts/pulsar-engine.py. Emisión de rayos X = azul-blanco sincrotrón;
 * el núcleo revienta a blanco. Va al CENTRO de la nebulosa (mismo scale) → se ve el púlsar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface PulsarEngineProps {
  url?: string; scale?: number; size?: number; exposure?: number; getTime?: () => number;
}

export default function PulsarEngine({
  url = '/pulsar-engine.bin', scale = 24.0, size = 2.0, exposure = 0.7, getTime,
}: PulsarEngineProps) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf); const n = Math.floor(f.length / 4);
      const pos = new Float32Array(n * 3), bri = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i*3] = f[i*4]; pos[i*3+1] = f[i*4+1]; pos[i*3+2] = f[i*4+2]; bri[i] = f[i*4+3];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
      setGeo(g);
    }).catch(e => console.error('[PulsarEngine] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: size }, uExposure: { value: exposure }, uScale: { value: scale }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aBright;
      uniform float uSize, uScale, uTime;
      varying vec3 vCol; varying float vB;
      void main(){
        // rota con la nebulosa (misma ω) para que el motor gire con ella
        float ang = uTime * 0.035;
        mat2 R = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
        vec3 pr = position; pr.xz = R * pr.xz;
        vec3 wp = pr * uScale;
        // sincrotrón X azul-blanco; el núcleo (brillo alto) → blanco puro
        vCol = mix(vec3(0.55,0.72,1.0), vec3(1.0,1.0,1.0), smoothstep(0.7,1.0,aBright));
        vB = aBright;
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.5 + 1.4*aBright) * (300.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uExposure; varying vec3 vCol; varying float vB;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r2 = dot(d,d);
        if(r2 > 0.25) discard;
        float a = exp(-r2*3.5);
        vec3 c = vCol * (0.15 + 1.3*vB) * a * uExposure;
        gl_FragColor = vec4(c, a);
      }`,
  }), [size, exposure, scale]);

  const p = useRef({ getTime }); p.current = { getTime };
  useFrame(({ clock }) => { mat.uniforms.uTime.value = p.current.getTime ? p.current.getTime() : clock.elapsedTime; });

  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-40} />;
}
