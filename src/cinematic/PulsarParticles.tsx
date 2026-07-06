/**
 * PulsarParticles — render de la nebulosa de viento de púlsar formada desde la FÍSICA.
 * Carga las partículas precomputadas por scripts/turbulent-nebula-sim.py (turbulencia
 * incompresible cara-i + advección lagrangiana). La CONCENTRACIÓN de partículas
 * (compresión física) = la NITIDEZ — no se finge con noise.
 *
 * Formato .bin: float32 [x,y,z,bright] por partícula (bright = densidad local = compresión).
 * Color: por radio (sincrotrón azul-blanco al centro → líneas Hα/[OIII] naranja/teal afuera)
 * modulado por brillo. Aditivo + bloom → las hebras densas REVIENTAN nítidas.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface PulsarParticlesProps {
  url?: string;          // ruta al .bin servido (public/)
  scale?: number;        // escala de las posiciones a unidades de escena
  getTime?: () => number;
  size?: number;         // tamaño base de punto
  exposure?: number;
}

export default function PulsarParticles({
  url = '/rt-nebula.bin', scale = 9.0, getTime, size = 2.4, exposure = 1.0,
}: PulsarParticlesProps) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf);
      const n = Math.floor(f.length / 4);
      const pos = new Float32Array(n * 3);
      const bri = new Float32Array(n);
      let rmax = 1e-6;
      for (let i = 0; i < n; i++) {
        const x = f[i * 4], y = f[i * 4 + 1], z = f[i * 4 + 2];
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        bri[i] = f[i * 4 + 3];
        const r = Math.hypot(x, y, z); if (r > rmax) rmax = r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
      g.userData.rmax = rmax;
      setGeo(g);
    }).catch(e => console.error('[PulsarParticles] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSize: { value: size }, uExposure: { value: exposure },
      uRmax: { value: 4.0 }, uScale: { value: scale }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute float aBright;
      uniform float uSize, uRmax, uScale, uTime;
      varying vec3 vCol; varying float vB;
      // paleta por radio normalizado: centro sincrotrón azul → cáscara Hα/[OIII]
      vec3 palette(float rn, float h){
        vec3 syn  = vec3(0.55,0.72,1.0);     // sincrotrón azul-blanco (interior)
        vec3 ha   = vec3(1.0,0.40,0.16);     // Hα/[SII] naranja-rojo (filamentos)
        vec3 oiii = vec3(0.22,0.95,0.62);    // [OIII] teal-verde
        vec3 fil  = mix(ha, oiii, h);
        return mix(syn, fil, smoothstep(0.20, 0.62, rn));
      }
      float hash(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        // rotación LENTA de la nebulosa (vive, no solo la cámara orbita)
        float ang = uTime * 0.035;
        mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        vec3 pr = position; pr.xz = R * pr.xz;
        vec3 p = pr * uScale;
        float rn = length(position) / uRmax;
        float h = hash(floor(position*40.0));
        vCol = palette(rn, h);
        vB = aBright;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.5 + 1.2*aBright) * (300.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uExposure;
      varying vec3 vCol; varying float vB;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d,d);
        if(r2 > 0.25) discard;
        float a = exp(-r2*3.2);                 // punto MÁS ANCHO/suave → se funden (sin granulado)
        // brillo bajo por punto: con 5M + puntos anchos, el aditivo suma a gradiente liso
        vec3 c = vCol * (0.05 + 0.32*vB) * a * uExposure;
        gl_FragColor = vec4(c, a);
      }`,
  }), [size, exposure, scale]);

  const p = useRef({ getTime });
  p.current = { getTime };
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = p.current.getTime ? p.current.getTime() : clock.elapsedTime;
    if (geo) mat.uniforms.uRmax.value = geo.userData.rmax || 4.0;
  });

  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-50} />;
}
