/**
 * MilkyWayBackground — Vía Láctea como fondo: disco galáctico + dust band +
 * bulge + ~25k estrellas distribuidas con perfil real.
 *
 * Modelo de luminosidad:
 *   - thin disk:  ρ(R,z) ∝ exp(-R/R_d) · sech²(z/z_thin)   z_thin = 300 pc
 *   - thick disk: ρ(R,z) ∝ exp(-R/R_d) · exp(-|z|/z_thick) z_thick = 900 pc
 *   - bulge:      ρ(r) ∝ exp(-(r/r_b)^(1/4))               Vaucouleurs (R^1/4)
 *   - halo:       ρ(r) ∝ r^(-3.5)                          dispersión esférica
 *
 * Refs: Bovy et al. 2012 (MWPotential2014), Jurić et al. 2008 (SDSS thin/thick),
 *       Bland-Hawthorn & Gerhard 2016 ARA&A review.
 *
 * También incluye MagnetarMarkers: catálogo de ~12 magnetares reales
 * (McGill Magnetar Catalog) ubicados en sus coordenadas galácticas (l, b).
 */

import { useMemo } from 'react';
import * as THREE from 'three';

/* ─── Sampling del modelo de la galaxia ──────────────────────────────── */
// Unidades: kpc en código, pero el render usa una escala arbitraria (el
// observador está en el sistema del magnetar, la galaxia "rodea" la escena).
// Para no romper la cámara del Magnetar (~3-60 units), ponemos la galaxia
// a distancia "infinita" — un sphere shell a R_SHELL = 80 wu.
const R_SHELL = 85;

const N_THIN  = 18000;
const N_THICK = 5000;
const N_BULGE = 4500;
const N_HALO  = 1800;

function buildMilkyWayStars(): { positions: Float32Array; colors: Float32Array; sizes: Float32Array } {
  const total = N_THIN + N_THICK + N_BULGE + N_HALO;
  const positions = new Float32Array(total * 3);
  const colors    = new Float32Array(total * 3);
  const sizes     = new Float32Array(total);
  let idx = 0;

  // Helper: sample disco exponential R · sech²(z) para thin/thick
  // El plano galáctico será el plano XZ (para no chocar con eje rotación Y del magnetar)
  const sampleDisk = (Rd_kpc: number, z_kpc: number, sech2: boolean): [number, number, number] => {
    // R exponencial: -Rd * ln(U), U uniform en (0,1)
    const R = -Rd_kpc * Math.log(1 - Math.random()) * 0.5;   // *0.5 para concentrar más
    // z: sech² o exp(-|z|)
    let z: number;
    if (sech2) {
      // sech² inverse: z = z_kpc · atanh(2u-1)
      const u = Math.random();
      z = z_kpc * 0.5 * Math.log((1 + u) / (1 - u)) * 0.3;
    } else {
      z = z_kpc * (Math.random() - 0.5) * 2;
    }
    const phi = Math.random() * 2 * Math.PI;
    return [R * Math.cos(phi), z, R * Math.sin(phi)];
  };

  // Color por tipo espectral, ponderado a M-K (rojo dominante en MWG)
  const sampleColor = (T_bias: number): [number, number, number] => {
    const u = Math.random() + T_bias * 0.3;
    if (u < 0.05)      return [0.65, 0.78, 1.00];     // O/B caliente azul
    if (u < 0.20)      return [0.85, 0.92, 1.00];     // A blanca-azulada
    if (u < 0.40)      return [1.00, 0.95, 0.80];     // F amarilla-blanca
    if (u < 0.55)      return [1.00, 0.92, 0.62];     // G amarilla (Sol)
    if (u < 0.78)      return [1.00, 0.78, 0.50];     // K naranja
    return                      [1.00, 0.55, 0.35];   // M roja
  };

  // Helper: proyectar pos kpc → posición en sphere shell R_SHELL
  // (efecto "skybox": distancia se descarta, solo direction matters)
  const proj = (p: [number, number, number]): [number, number, number] => {
    const norm = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
    if (norm < 1e-6) {
      // bulge center → random dir
      const phi = Math.random() * 2 * Math.PI;
      const cosTheta = (Math.random() - 0.5) * 0.4;
      const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
      return [R_SHELL * sinTheta * Math.cos(phi), R_SHELL * cosTheta, R_SHELL * sinTheta * Math.sin(phi)];
    }
    // Pequeña perturbación radial para no quedar en sphere perfecta
    const r = R_SHELL * (0.92 + Math.random() * 0.16);
    return [p[0] / norm * r, p[1] / norm * r, p[2] / norm * r];
  };

  // ── Thin disk (Rd ~ 3 kpc, z_thin ~ 0.3 kpc) ──────────────────────
  for (let i = 0; i < N_THIN; i++) {
    const p = proj(sampleDisk(3.0, 0.3, true));
    positions[idx*3+0] = p[0]; positions[idx*3+1] = p[1]; positions[idx*3+2] = p[2];
    const c = sampleColor(0.3);
    colors[idx*3+0] = c[0]; colors[idx*3+1] = c[1]; colors[idx*3+2] = c[2];
    sizes[idx] = 0.45 + Math.random() * 0.45;
    idx++;
  }

  // ── Thick disk (Rd ~ 4 kpc, z_thick ~ 0.9 kpc) — más viejas, rojas ─
  for (let i = 0; i < N_THICK; i++) {
    const p = proj(sampleDisk(4.0, 0.9, false));
    positions[idx*3+0] = p[0]; positions[idx*3+1] = p[1]; positions[idx*3+2] = p[2];
    const c = sampleColor(0.7);
    colors[idx*3+0] = c[0]; colors[idx*3+1] = c[1]; colors[idx*3+2] = c[2];
    sizes[idx] = 0.40 + Math.random() * 0.30;
    idx++;
  }

  // ── Bulge (r_b ~ 1 kpc, Vaucouleurs) ──────────────────────────────
  for (let i = 0; i < N_BULGE; i++) {
    // Sample r con perfil R^(1/4) via rejection
    let r: number;
    let attempts = 0;
    do {
      r = -1.2 * Math.log(1 - Math.random());
      attempts++;
    } while (attempts < 50 && Math.random() > Math.exp(-7.67 * (Math.pow(r / 1.0, 0.25) - 1)));
    const phi = Math.random() * 2 * Math.PI;
    const cosTh = (Math.random() - 0.5) * 0.6;  // achatado al plano
    const sinTh = Math.sqrt(1 - cosTh * cosTh);
    const raw: [number, number, number] = [r * sinTh * Math.cos(phi), r * cosTh, r * sinTh * Math.sin(phi)];
    const p = proj(raw);
    positions[idx*3+0] = p[0]; positions[idx*3+1] = p[1]; positions[idx*3+2] = p[2];
    const c = sampleColor(0.6);
    colors[idx*3+0] = c[0]; colors[idx*3+1] = c[1]; colors[idx*3+2] = c[2];
    sizes[idx] = 0.55 + Math.random() * 0.40;
    idx++;
  }

  // ── Halo (esférico disperso) ──────────────────────────────────────
  for (let i = 0; i < N_HALO; i++) {
    const phi = Math.random() * 2 * Math.PI;
    const cosTh = 2 * Math.random() - 1;
    const sinTh = Math.sqrt(1 - cosTh * cosTh);
    const r = R_SHELL * (0.90 + Math.random() * 0.20);
    positions[idx*3+0] = r * sinTh * Math.cos(phi);
    positions[idx*3+1] = r * cosTh;
    positions[idx*3+2] = r * sinTh * Math.sin(phi);
    const c = sampleColor(0.5);
    colors[idx*3+0] = c[0] * 0.7; colors[idx*3+1] = c[1] * 0.7; colors[idx*3+2] = c[2] * 0.7;
    sizes[idx] = 0.30 + Math.random() * 0.25;
    idx++;
  }

  return { positions, colors, sizes };
}

/* ─── Catálogo magnetares reales (McGill Magnetar Catalog) ────────────
 * Coordenadas galácticas (l, b) en grados, mapeadas a posición en R_SHELL.
 * Sources: Olausen & Kaspi 2014 ApJS, magnetar.mcgill.ca catalog (2024 update).
 */
const REAL_MAGNETARS = [
  { name: 'SGR 1806-20',     l: 10.0,  b: -0.24, kind: 'SGR · giant flare 2004', P_s: 7.55 },
  { name: 'SGR 1900+14',     l: 43.0,  b: 0.83,  kind: 'SGR · giant flare 1998', P_s: 5.17 },
  { name: 'SGR 1935+2154',   l: 57.25, b: 0.82,  kind: 'SGR · FRB 200428',       P_s: 3.24 },
  { name: 'SGR 0501+4516',   l: 161.6, b: -1.18, kind: 'SGR',                    P_s: 5.76 },
  { name: '1E 1841-045',     l: 27.4,  b: -0.01, kind: 'AXP · Kes 73',           P_s: 11.78 },
  { name: '4U 0142+61',      l: 129.4, b: -0.43, kind: 'AXP · brightest',        P_s: 8.69 },
  { name: '1E 1048.1-5937',  l: 288.3, b: -0.49, kind: 'AXP',                    P_s: 6.45 },
  { name: '1E 2259+586',     l: 109.1, b: -1.00, kind: 'AXP · CTB 109',          P_s: 6.98 },
  { name: 'XTE J1810-197',   l: 10.7,  b: -0.16, kind: 'transient · radio',      P_s: 5.54 },
  { name: 'PSR J1745-2900',  l: 359.94, b: -0.05, kind: 'Galactic Center',       P_s: 3.76 },
  { name: 'SGR J0418+5729',  l: 147.96, b: 5.12, kind: 'low-B magnetar',         P_s: 9.08 },
  { name: 'CXOU J1714-3810', l: 348.69, b: 0.32, kind: 'AXP · RCW 103',          P_s: 24050 },  // 6.7h!
] as const;

function galacticToCartesian(l_deg: number, b_deg: number, r: number): [number, number, number] {
  const l = l_deg * Math.PI / 180;
  const b = b_deg * Math.PI / 180;
  return [
    r * Math.cos(b) * Math.cos(l),
    r * Math.sin(b),
    r * Math.cos(b) * Math.sin(l),
  ];
}

/* ─── React components ──────────────────────────────────────────────── */

export function MilkyWay() {
  const { positions, colors, sizes } = useMemo(() => buildMilkyWayStars(), []);
  return (
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]}
          count={positions.length / 3} itemSize={3} array={positions} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]}
          count={colors.length / 3} itemSize={3} array={colors} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]}
          count={sizes.length} itemSize={1} array={sizes} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
        }}
        vertexShader={`
          attribute vec3 color;
          attribute float size;
          uniform float uPixelRatio;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * uPixelRatio * (120.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            float r2 = dot(d, d);
            if (r2 > 0.25) discard;
            float fall = exp(-r2 * 12.0);
            gl_FragColor = vec4(vColor * fall, fall * 0.85);
          }
        `}
      />
    </points>
  );
}

/* ─── Magnetares reales como puntos magenta identificables ──────────── */
export function MagnetarMarkers() {
  // Color magenta característico para distinguir de starfield
  const data = useMemo(() => {
    const pos: number[] = [];
    for (const m of REAL_MAGNETARS) {
      const [x, y, z] = galacticToCartesian(m.l, m.b, 75);   // r=75 < R_SHELL=85
      pos.push(x, y, z);
    }
    return new Float32Array(pos);
  }, []);

  return (
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]}
          count={data.length / 3} itemSize={3} array={data} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
        }}
        vertexShader={`
          uniform float uPixelRatio;
          uniform float uTime;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Pulsation sutil — los magnetares "respiran" en la imagen
            float pulse = 0.85 + 0.15 * sin(uTime * 1.4 + position.x * 0.07);
            gl_PointSize = 8.0 * uPixelRatio * pulse;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            float r2 = dot(d, d);
            if (r2 > 0.25) discard;
            float fall = exp(-r2 * 6.0);
            // Magenta saturated, brilla más en el centro
            vec3 col = vec3(1.0, 0.35, 0.95) * (1.5 - r2 * 2.0);
            gl_FragColor = vec4(col * fall, fall * 0.95);
          }
        `}
      />
    </points>
  );
}

/* Exportar también el catálogo para usar en HUD */
export const MAGNETAR_CATALOG = REAL_MAGNETARS;
