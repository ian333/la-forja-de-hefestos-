/**
 * ⚒️ La Forja — GPU Ray March Renderer
 * ======================================
 * Replaces Marching Cubes mesh with real-time GPU sphere tracing.
 * Renders pixel-perfect SDF surfaces — circles are circles, not polygon bags.
 *
 * Pipeline: Scene graph → GLSL compiler → Fragment shader sphere tracing
 *           Fullscreen triangle ➜ per-pixel ray march ➜ PBR-ish shading
 *
 * Uniforms are ALL custom (no reliance on Three.js fragment-shader built-ins)
 * to avoid issues where projectionMatrix is only injected in the vertex prefix.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { compileScene, GLSL_LIB, isPrimitive } from './sdf-engine';
import type { SdfOperation } from './sdf-engine';
import { useForgeStore } from './useForgeStore';
import { sectionToVec4, type SectionState } from './viewport/SectionPlane';

// ══════════════════════════════════════════════════════════════
// Fullscreen Triangle (clip space, single-triangle optimization)
// ══════════════════════════════════════════════════════════════

function makeFullscreenGeo(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [-1, -1, 0, 3, -1, 0, -1, 3, 0], 3,
  ));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(
    [0, 0, 2, 0, 0, 2], 2,
  ));
  return g;
}

// ══════════════════════════════════════════════════════════════
// Shaders (GLSL 300 ES via THREE.GLSL3)
// ══════════════════════════════════════════════════════════════

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function buildFrag(sceneGlsl: string): string {
  return /* glsl */ `
in vec2 vUv;

// All uniforms are custom — avoids Three.js fragment-prefix gaps
uniform mat4 uInvProj;   // camera.projectionMatrixInverse
uniform mat4 uCamWorld;  // camera.matrixWorld  (inverse view)
uniform mat4 uVP;        // projectionMatrix * viewMatrix (for depth)

// ═══ Section Plane (Clip) ═══
uniform int  uClipEnabled;    // 0 or 1
uniform vec4 uClipPlane;      // (nx, ny, nz, d) — dot(p, n) + d > 0 = clipped

layout(location = 0) out vec4 fragColor;

// ═══ SDF Primitive Library (Inigo Quilez) ═══
${GLSL_LIB}

// ═══ Compiled Scene → float map(vec3 p) ═══
${sceneGlsl}

// ── Surface Normal (tetrahedron technique) ──
vec3 calcNormal(vec3 p) {
  const float h = 0.0005;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * map(p + k.xyy * h) +
    k.yyx * map(p + k.yyx * h) +
    k.yxy * map(p + k.yxy * h) +
    k.xxx * map(p + k.xxx * h)
  );
}

// ── Ambient Occlusion (5-tap) ──
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.11 * float(i) / 4.0;
    occ += (h - map(p + h * n)) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

// ── Soft Shadow (improved penumbra) ──
float calcShadow(vec3 ro, vec3 rd, float lo, float hi) {
  float res = 1.0, t = lo, ph = 1e10;
  for (int i = 0; i < 32; i++) {
    float h = map(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(0.0, h * h - y * y));
    res = min(res, 10.0 * d / max(0.001, t - y));
    ph = h;
    t += clamp(h, 0.01, 0.15);
    if (res < 0.001 || t > hi) break;
  }
  return clamp(res, 0.0, 1.0);
}

void main() {
  // ── Reconstruct Ray ──
  vec2 ndc = vUv * 2.0 - 1.0;

  vec4 vd = uInvProj * vec4(ndc, -1.0, 1.0);
  vd.xyz /= vd.w;

  vec3 rd = normalize(mat3(uCamWorld) * normalize(vd.xyz));
  vec3 ro = uCamWorld[3].xyz;                       // camera world position

  // ── Sphere Tracing (256 steps max) ──
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 256; i++) {
    float d = map(ro + rd * t);
    if (abs(d) < 0.0002 * (1.0 + t * 0.05)) { hit = true; break; }
    t += d;
    if (t > 200.0) break;
  }

  if (!hit) {
    // ── Gradient background (Fusion 360-inspired) ──
    vec3 rdn = normalize(rd);
    float horiz = rdn.y;
    vec3 skyHi  = vec3(0.10, 0.12, 0.17);
    vec3 skyLo  = vec3(0.18, 0.20, 0.26);
    vec3 gndCol = vec3(0.07, 0.07, 0.09);
    vec3 bg = horiz > 0.0
      ? mix(skyLo, skyHi, smoothstep(0.0, 0.5, horiz))
      : mix(skyLo, gndCol, smoothstep(0.0, -0.4, horiz));
    bg *= 1.0 - 0.2 * length(vUv - 0.5);
    fragColor = vec4(bg, 1.0);
    gl_FragDepth = 1.0;
    return;
  }

  vec3 pos = ro + rd * t;

  // ── Section Plane Clip + Solid Cap ──
  // When clipping, we also render a filled cap where the clip plane
  // intersects the interior (SDF < 0) — just like Fusion 360.
  bool isCapHit = false;
  if (uClipEnabled == 1) {
    float clipDist = dot(pos, uClipPlane.xyz) + uClipPlane.w;

    // Compute ray–plane intersection analytically
    float denom = dot(rd, uClipPlane.xyz);
    float tPlane = -(dot(ro, uClipPlane.xyz) + uClipPlane.w) / denom;

    if (clipDist > 0.0) {
      // Surface hit is on the clipped side.
      // Check if the clip plane intersection is inside the solid (SDF < 0)
      if (abs(denom) > 0.0001 && tPlane > 0.0) {
        vec3 pPlane = ro + rd * tPlane;
        float sdfAtPlane = map(pPlane);
        if (sdfAtPlane < 0.001) {
          // The plane cuts through solid material — render cap
          pos = pPlane;
          t = tPlane;
          hit = true;
          isCapHit = true;
        } else {
          // No solid here — transparent
          fragColor = vec4(0.0);
          gl_FragDepth = 1.0;
          return;
        }
      } else {
        fragColor = vec4(0.0);
        gl_FragDepth = 1.0;
        return;
      }
    } else {
      // Surface hit is on the visible side — check if cap is closer
      if (abs(denom) > 0.0001 && tPlane > 0.0 && tPlane < t) {
        vec3 pPlane = ro + rd * tPlane;
        float sdfAtPlane = map(pPlane);
        if (sdfAtPlane < 0.001) {
          pos = pPlane;
          t = tPlane;
          isCapHit = true;
        }
      }
    }
  }

  vec3 nor = isCapHit ? -uClipPlane.xyz : calcNormal(pos);
  vec3 eye = normalize(ro - pos);

  // ── Material (Fusion 360-style blue steel / cap hatching) ──
  vec3 base;
  float rough;
  if (isCapHit) {
    // Section cap: warm orange/amber with diagonal hatching pattern
    // Project pos onto clip-plane local coords for hatching
    vec3 cpN = normalize(uClipPlane.xyz);
    vec3 cpT = normalize(cross(cpN, abs(cpN.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
    vec3 cpB = cross(cpN, cpT);
    float u = dot(pos, cpT);
    float v = dot(pos, cpB);
    // Diagonal hatch lines
    float hatch = smoothstep(0.42, 0.5, fract((u + v) * 18.0))
                + smoothstep(0.42, 0.5, fract((u - v) * 18.0));
    hatch = clamp(hatch, 0.0, 1.0);
    vec3 capBase = vec3(0.85, 0.55, 0.20);   // warm amber
    vec3 capLine = vec3(0.60, 0.35, 0.12);   // darker hatch lines
    base = mix(capBase, capLine, hatch * 0.6);
    rough = 0.65;
  } else {
    base = vec3(0.60, 0.65, 0.74);
    rough = 0.30;
  }

  // ── 3-Point Lighting (studio setup) ──
  vec3 keyDir  = normalize(vec3( 0.6,  0.9,  0.4));
  vec3 keyCol  = vec3(1.0, 0.97, 0.92) * 1.6;
  vec3 fillDir = normalize(vec3(-0.5,  0.35, -0.6));
  vec3 fillCol = vec3(0.50, 0.68, 1.0) * 0.55;
  vec3 backDir = normalize(vec3(-0.2, -0.3,  0.8));
  vec3 backCol = vec3(0.95, 0.88, 0.72) * 0.28;

  float ao = calcAO(pos, nor);

  // Key light
  float kDiff = max(dot(nor, keyDir), 0.0);
  float kShad = calcShadow(pos + nor * 0.002, keyDir, 0.01, 25.0);
  float kSpec = pow(max(dot(nor, normalize(keyDir + eye)), 0.0),
                    mix(16.0, 160.0, 1.0 - rough));

  // Fill light
  float fDiff = max(dot(nor, fillDir), 0.0);
  float fSpec = pow(max(dot(nor, normalize(fillDir + eye)), 0.0), 64.0);

  // Back light
  float bDiff = max(dot(nor, backDir), 0.0);

  // Fresnel (Schlick)
  float fresnel = pow(1.0 - max(dot(nor, eye), 0.0), 4.0);

  // ── Combine ──
  vec3 amb = vec3(0.08, 0.10, 0.15);
  vec3 col = base * (
    amb * ao +
    keyCol  * kDiff * kShad * 0.65 +
    fillCol * fDiff * 0.5 +
    backCol * bDiff * 0.3
  ) * ao;

  col += keyCol  * kSpec * kShad * 0.40;
  col += fillCol * fSpec * 0.10;
  col += vec3(0.4, 0.6, 1.0) * fresnel * 0.12 * ao;

  // Edge darkening
  float edge = 1.0 - smoothstep(0.0, 0.12, abs(dot(nor, eye)));
  col *= 1.0 - edge * 0.25;

  // Environment reflection (sky dome approximation)
  vec3 refl = reflect(-eye, nor);
  float envUp = refl.y * 0.5 + 0.5;
  vec3 envCol = mix(vec3(0.10, 0.12, 0.16), vec3(0.28, 0.34, 0.44), envUp);
  col += envCol * fresnel * 0.18 * ao;

  // ACES tone mapping
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);

  // ── Depth for grid / gizmo integration ──
  vec4 cp = uVP * vec4(pos, 1.0);
  gl_FragDepth = cp.z / cp.w * 0.5 + 0.5;
}
`;
}

// ══════════════════════════════════════════════════════════════
// React Component
// ══════════════════════════════════════════════════════════════

/** Scratch matrices — reused every frame (zero allocation) */
const _vpMat = new THREE.Matrix4();

export default function RayMarchMesh() {
  const scene = useForgeStore(s => s.scene);
  const section = useForgeStore(s => s.section);
  const { camera } = useThree();

  const geoRef  = useRef<THREE.BufferGeometry | null>(null);
  const matRef  = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh>(null!);

  // Lazily create geometry once
  if (!geoRef.current) geoRef.current = makeFullscreenGeo();

  // Is the scene empty?
  const isEmpty = !isPrimitive(scene)
    && (scene as SdfOperation).children.length === 0;

  // Compile scene → GLSL map()
  const sceneGlsl = useMemo(() => compileScene(scene), [scene]);

  // (Re)create material whenever GLSL changes
  useEffect(() => {
    if (isEmpty) { matRef.current = null; return; }

    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: buildFrag(sceneGlsl),
      uniforms: {
        uInvProj:     { value: new THREE.Matrix4() },
        uCamWorld:    { value: new THREE.Matrix4() },
        uVP:          { value: new THREE.Matrix4() },
        uClipEnabled: { value: 0 },
        uClipPlane:   { value: new THREE.Vector4(0, 1, 0, 0) },
      },
      depthTest:  false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    matRef.current = mat;
    if (meshRef.current) {
      meshRef.current.material = mat;
    }

    return () => { mat.dispose(); };
  }, [sceneGlsl, isEmpty]);

  // Update camera uniforms every frame
  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const cam = camera as THREE.PerspectiveCamera;
    mat.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    mat.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    _vpMat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    mat.uniforms.uVP.value.copy(_vpMat);

    // Section plane
    mat.uniforms.uClipEnabled.value = section.enabled ? 1 : 0;
    if (section.enabled) {
      const [nx, ny, nz, d] = sectionToVec4(section);
      mat.uniforms.uClipPlane.value.set(nx, ny, nz, d);
    }
  });

  if (isEmpty) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geoRef.current!}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
}
