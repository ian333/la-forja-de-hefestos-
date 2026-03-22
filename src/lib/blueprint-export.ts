/**
 * ⚒️ La Forja — Blueprint / Planos de Producción
 * ================================================
 * Generates orthographic projection SVG drawings (front, side, top)
 * with dimension lines and title block — like Fusion 360's Drawing workspace.
 *
 * Uses ray marching on CPU to sample the silhouette and edge contours
 * from each orthographic direction, then renders as clean SVG paths.
 */

import type { SdfNode, SdfPrimitive, SdfOperation } from './sdf-engine';
import { isPrimitive } from './sdf-engine';

type V3 = [number, number, number];

// ═══════════════════════════════════════════════════════════════
// CPU SDF Evaluator (same as stl-export — shared logic)
// ═══════════════════════════════════════════════════════════════

function sub(a: V3, b: V3): V3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a: V3, b: V3): number { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function len(v: V3): number { return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); }

function rotX(a: number, p: V3): V3 { const c=Math.cos(a),s=Math.sin(a); return [p[0],c*p[1]+s*p[2],-s*p[1]+c*p[2]]; }
function rotY(a: number, p: V3): V3 { const c=Math.cos(a),s=Math.sin(a); return [c*p[0]-s*p[2],p[1],s*p[0]+c*p[2]]; }
function rotZ(a: number, p: V3): V3 { const c=Math.cos(a),s=Math.sin(a); return [c*p[0]+s*p[1],-s*p[0]+c*p[1],p[2]]; }

function sdSphere(p: V3, r: number) { return len(p)-r; }
function sdBox(p: V3, b: V3) { const q:V3=[Math.abs(p[0])-b[0],Math.abs(p[1])-b[1],Math.abs(p[2])-b[2]]; return len([Math.max(q[0],0),Math.max(q[1],0),Math.max(q[2],0)])+Math.min(Math.max(q[0],Math.max(q[1],q[2])),0); }
function sdCylinder(p: V3, r: number, h: number) { const dx=Math.sqrt(p[0]*p[0]+p[2]*p[2])-r,dy=Math.abs(p[1])-h; return Math.min(Math.max(dx,dy),0)+Math.sqrt(Math.max(dx,0)**2+Math.max(dy,0)**2); }
function sdTorus(p: V3, R: number, r: number) { const q0=Math.sqrt(p[0]*p[0]+p[2]*p[2])-R; return Math.sqrt(q0*q0+p[1]*p[1])-r; }
function sdCone(p: V3, r: number, h: number) { h=Math.max(h,0.001);const qx=r/h,qy=-1,wx=Math.sqrt(p[0]*p[0]+p[2]*p[2]),wy=p[1]-h;const t=Math.max(0,Math.min(1,(wx*h*qx+wy*h*qy)/(h*h*(qx*qx+qy*qy))));const ax=wx-h*qx*t,ay=wy-h*qy*t;const t2=Math.max(0,Math.min(1,wx/(h*qx)));const bx=wx-h*qx*t2,by=wy-h;const k=Math.sign(h*qy);const d=Math.min(ax*ax+ay*ay,bx*bx+by*by);const s=Math.max(k*(wx*h*qy-wy*h*qx),k*(wy-h*qy));return Math.sqrt(d)*Math.sign(s); }
function sdCapsule(p: V3, a: V3, b: V3, r: number) { const pa=sub(p,a),ba=sub(b,a);const h=Math.max(0,Math.min(1,dot(pa,ba)/dot(ba,ba)));return len(sub(pa,[ba[0]*h,ba[1]*h,ba[2]*h]))-r; }

function opSmoothUnion(d1: number, d2: number, k: number) { const h=Math.max(0,Math.min(1,0.5+0.5*(d2-d1)/k));return d2*(1-h)+d1*h-k*h*(1-h); }

function evalNode(node: SdfNode, p: V3): number {
  if (isPrimitive(node)) {
    const pr = node as SdfPrimitive;
    const pm = pr.params;
    if (pr.type==='capsule') return sdCapsule(p,[pm.ax??0,pm.ay??0,pm.az??0],[pm.bx??0,pm.by??1,pm.bz??0],pm.radius??0.02);
    let lp=sub(p,pr.position);const rot=pr.rotation||[0,0,0];
    if(rot[0]!==0||rot[1]!==0||rot[2]!==0) lp=rotZ(rot[2],rotY(rot[1],rotX(rot[0],lp)));
    switch(pr.type){
      case'sphere':return sdSphere(lp,pm.radius??1);
      case'box':return sdBox(lp,[(pm.sizeX??1)*0.5,(pm.sizeY??1)*0.5,(pm.sizeZ??1)*0.5]);
      case'cylinder':return sdCylinder(lp,pm.radius??0.5,(pm.height??1)*0.5);
      case'torus':return sdTorus(lp,pm.majorRadius??1,pm.minorRadius??0.25);
      case'cone':return sdCone(lp,pm.radius??0.5,pm.height??1);
      default:return 1000;
    }
  }
  const op=node as SdfOperation;
  if(op.children.length===0) return 1000;
  if(op.children.length===1) return evalNode(op.children[0],p);
  let result=evalNode(op.children[0],p);
  for(let i=1;i<op.children.length;i++){
    const d=evalNode(op.children[i],p);
    switch(op.type){
      case'union':result=Math.min(result,d);break;
      case'subtract':result=Math.max(result,-d);break;
      case'intersect':result=Math.max(result,d);break;
      case'smoothUnion':result=opSmoothUnion(result,d,op.smoothness);break;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Orthographic Silhouette Sampler
// ═══════════════════════════════════════════════════════════════

type View = 'front' | 'side' | 'top';

interface ViewConfig {
  label: string;
  // Maps (u,v) pixel coords to world-space ray origin & direction
  project: (u: number, v: number, depth: number) => V3;
  hAxis: string;
  vAxis: string;
}

const VIEW_CONFIGS: Record<View, ViewConfig> = {
  front: {
    label: 'FRONTAL (X-Y)',
    project: (u, v, d) => [u, v, d],
    hAxis: 'X', vAxis: 'Y',
  },
  side: {
    label: 'LATERAL (Z-Y)',
    project: (u, v, d) => [d, v, u],
    hAxis: 'Z', vAxis: 'Y',
  },
  top: {
    label: 'PLANTA (X-Z)',
    project: (u, v, d) => [u, d, v],
    hAxis: 'X', vAxis: 'Z',
  },
};

interface SilhouetteResult {
  pixels: boolean[];  // true = material present
  edges: boolean[];   // true = silhouette edge
  width: number;
  height: number;
  bounds: { uMin: number; uMax: number; vMin: number; vMax: number };
}

function sampleSilhouette(
  scene: SdfNode,
  view: View,
  res: number,
  worldBounds: [V3, V3],
): SilhouetteResult {
  const cfg = VIEW_CONFIGS[view];
  const [bMin, bMax] = worldBounds;

  // Determine the 2D bounds for this view
  let uMin: number, uMax: number, vMin: number, vMax: number, dMin: number, dMax: number;
  switch (view) {
    case 'front': uMin=bMin[0];uMax=bMax[0];vMin=bMin[1];vMax=bMax[1];dMin=bMin[2];dMax=bMax[2]; break;
    case 'side':  uMin=bMin[2];uMax=bMax[2];vMin=bMin[1];vMax=bMax[1];dMin=bMin[0];dMax=bMax[0]; break;
    case 'top':   uMin=bMin[0];uMax=bMax[0];vMin=bMin[2];vMax=bMax[2];dMin=bMin[1];dMax=bMax[1]; break;
  }

  const stepU = (uMax - uMin) / res;
  const stepV = (vMax - vMin) / res;
  const depthSteps = Math.max(20, Math.round(res * 0.3));
  const stepD = (dMax - dMin) / depthSteps;

  const pixels = new Array(res * res).fill(false);

  // For each pixel, march along depth to check if material exists
  for (let iv = 0; iv < res; iv++) {
    const v = vMin + (iv + 0.5) * stepV;
    for (let iu = 0; iu < res; iu++) {
      const u = uMin + (iu + 0.5) * stepU;
      for (let id = 0; id < depthSteps; id++) {
        const d = dMin + (id + 0.5) * stepD;
        const p = cfg.project(u, v, d);
        if (evalNode(scene, p) < 0) {
          pixels[iv * res + iu] = true;
          break;
        }
      }
    }
  }

  // Extract edges (Sobel-like: pixel on but neighbor off)
  const edges = new Array(res * res).fill(false);
  for (let iv = 1; iv < res - 1; iv++) {
    for (let iu = 1; iu < res - 1; iu++) {
      if (!pixels[iv * res + iu]) continue;
      if (!pixels[(iv-1)*res+iu] || !pixels[(iv+1)*res+iu] ||
          !pixels[iv*res+iu-1] || !pixels[iv*res+iu+1]) {
        edges[iv * res + iu] = true;
      }
    }
  }

  return { pixels, edges, width: res, height: res, bounds: { uMin, uMax, vMin, vMax } };
}

// ═══════════════════════════════════════════════════════════════
// SVG Blueprint Generator
// ═══════════════════════════════════════════════════════════════

function findExtents(sil: SilhouetteResult): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = sil.width, x1 = 0, y0 = sil.height, y1 = 0;
  for (let y = 0; y < sil.height; y++) {
    for (let x = 0; x < sil.width; x++) {
      if (sil.pixels[y * sil.width + x]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  return { x0, x1, y0, y1 };
}

function dimMM(worldSize: number): string {
  return (worldSize * 100).toFixed(1);  // scene units → mm (scale factor 100)
}

export interface BlueprintOptions {
  title?: string;
  author?: string;
  date?: string;
  scale?: string;
  material?: string;
  res?: number;
}

export function generateBlueprint(
  scene: SdfNode,
  options: BlueprintOptions = {},
): string {
  const {
    title = 'BICICLETA — LA FORJA',
    author = 'Ingeniero',
    date = new Date().toISOString().slice(0, 10),
    scale = '1:1',
    material = 'Acero AISI 4130',
    res = 200,
  } = options;

  const worldBounds: [V3, V3] = [[-1.2, -0.2, -0.5], [1.2, 1.4, 0.5]];

  // Generate three views
  const front = sampleSilhouette(scene, 'front', res, worldBounds);
  const side = sampleSilhouette(scene, 'side', res, worldBounds);
  const top = sampleSilhouette(scene, 'top', res, worldBounds);

  // SVG Canvas — A3 landscape proportions (420 × 297 mm)
  const W = 1200;
  const H = 850;
  const MARGIN = 40;
  const TITLE_H = 80;

  // Each view gets a cell
  const cellW = (W - MARGIN * 4) / 3;
  const cellH = H - MARGIN * 2 - TITLE_H - 20;

  function renderView(
    sil: SilhouetteResult,
    viewCfg: ViewConfig,
    ox: number, oy: number,
    cw: number, ch: number,
  ): string {
    const ext = findExtents(sil);
    if (ext.x1 < ext.x0) return ''; // empty

    const pw = ext.x1 - ext.x0 + 1;
    const ph = ext.y1 - ext.y0 + 1;
    const scaleX = cw / (pw + 4);
    const scaleY = ch / (ph + 4);
    const sc = Math.min(scaleX, scaleY);

    const drawW = pw * sc;
    const drawH = ph * sc;
    const dx = ox + (cw - drawW) / 2;
    const dy = oy + (ch - drawH) / 2;

    let svg = '';

    // View label
    svg += `<text x="${ox + cw/2}" y="${oy - 8}" text-anchor="middle" class="view-label">${viewCfg.label}</text>\n`;

    // Render silhouette as filled rectangles (compact path)
    svg += `<g transform="translate(${dx},${dy}) scale(${sc})">\n`;

    // Fill (light blue hatching for material)
    for (let y = ext.y0; y <= ext.y1; y++) {
      for (let x = ext.x0; x <= ext.x1; x++) {
        if (sil.pixels[y * sil.width + x]) {
          const py = (sil.height - 1 - y) - (sil.height - 1 - ext.y1);
          const px = x - ext.x0;
          svg += `<rect x="${px}" y="${py}" width="1" height="1" class="fill"/>\n`;
        }
      }
    }

    // Edges (black outline)
    for (let y = ext.y0; y <= ext.y1; y++) {
      for (let x = ext.x0; x <= ext.x1; x++) {
        if (sil.edges[y * sil.width + x]) {
          const py = (sil.height - 1 - y) - (sil.height - 1 - ext.y1);
          const px = x - ext.x0;
          svg += `<rect x="${px}" y="${py}" width="1" height="1" class="edge"/>\n`;
        }
      }
    }
    svg += '</g>\n';

    // Dimension lines
    const worldW = (pw / sil.width) * (sil.bounds.uMax - sil.bounds.uMin);
    const worldH = (ph / sil.height) * (sil.bounds.vMax - sil.bounds.vMin);

    // Bottom dimension (width)
    const dimY = dy + drawH + 18;
    svg += `<line x1="${dx}" y1="${dimY}" x2="${dx + drawW}" y2="${dimY}" class="dim-line"/>`;
    svg += `<line x1="${dx}" y1="${dimY-4}" x2="${dx}" y2="${dimY+4}" class="dim-line"/>`;
    svg += `<line x1="${dx+drawW}" y1="${dimY-4}" x2="${dx+drawW}" y2="${dimY+4}" class="dim-line"/>`;
    svg += `<text x="${dx + drawW/2}" y="${dimY+14}" text-anchor="middle" class="dim-text">${dimMM(worldW)} mm</text>\n`;

    // Right dimension (height)
    const dimX = dx + drawW + 18;
    svg += `<line x1="${dimX}" y1="${dy}" x2="${dimX}" y2="${dy+drawH}" class="dim-line"/>`;
    svg += `<line x1="${dimX-4}" y1="${dy}" x2="${dimX+4}" y2="${dy}" class="dim-line"/>`;
    svg += `<line x1="${dimX-4}" y1="${dy+drawH}" x2="${dimX+4}" y2="${dy+drawH}" class="dim-line"/>`;
    svg += `<text x="${dimX+6}" y="${dy+drawH/2}" dominant-baseline="middle" class="dim-text" transform="rotate(-90,${dimX+6},${dy+drawH/2})">${dimMM(worldH)} mm</text>\n`;

    // Axis indicators
    svg += `<text x="${dx + drawW/2}" y="${oy + ch + 10}" text-anchor="middle" class="axis-label">${viewCfg.hAxis}</text>`;
    svg += `<text x="${ox - 10}" y="${oy + ch/2}" text-anchor="middle" class="axis-label" transform="rotate(-90,${ox-10},${oy+ch/2})">${viewCfg.vAxis}</text>\n`;

    return svg;
  }

  // Build SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>
  .bg { fill: #ffffff; }
  .border { fill: none; stroke: #000; stroke-width: 2; }
  .frame { fill: none; stroke: #000; stroke-width: 0.5; }
  .fill { fill: #d4e8f7; stroke: none; }
  .edge { fill: #1a1a2e; stroke: none; }
  .dim-line { stroke: #e74c3c; stroke-width: 0.8; fill: none; }
  .dim-text { font-family: 'Courier New', monospace; font-size: 10px; fill: #e74c3c; }
  .view-label { font-family: 'Arial', sans-serif; font-size: 11px; fill: #333; font-weight: bold; letter-spacing: 2px; }
  .axis-label { font-family: 'Courier New', monospace; font-size: 9px; fill: #666; }
  .title-text { font-family: 'Arial', sans-serif; font-size: 16px; fill: #1a1a2e; font-weight: bold; }
  .title-sub { font-family: 'Courier New', monospace; font-size: 10px; fill: #555; }
  .title-brand { font-family: 'Arial', sans-serif; font-size: 12px; fill: #2980b9; font-weight: bold; }
</style>
</defs>

<!-- Background -->
<rect class="bg" width="${W}" height="${H}"/>
<rect class="border" x="5" y="5" width="${W-10}" height="${H-10}"/>

<!-- Views -->
`;

  const vy = MARGIN + 20;
  svg += renderView(front, VIEW_CONFIGS.front, MARGIN, vy, cellW, cellH);
  svg += renderView(side, VIEW_CONFIGS.side, MARGIN * 2 + cellW, vy, cellW, cellH);
  svg += renderView(top, VIEW_CONFIGS.top, MARGIN * 3 + cellW * 2, vy, cellW, cellH);

  // Title block
  const tbY = H - TITLE_H - 5;
  svg += `
<!-- Title Block -->
<rect class="frame" x="${MARGIN}" y="${tbY}" width="${W - MARGIN*2}" height="${TITLE_H}"/>
<line x1="${MARGIN}" y1="${tbY + 28}" x2="${W - MARGIN}" y2="${tbY + 28}" class="frame"/>
<line x1="${W - MARGIN - 300}" y1="${tbY}" x2="${W - MARGIN - 300}" y2="${tbY + TITLE_H}" class="frame"/>

<text x="${MARGIN + 12}" y="${tbY + 20}" class="title-text">${escapeXml(title)}</text>
<text x="${MARGIN + 12}" y="${tbY + 45}" class="title-sub">Material: ${escapeXml(material)}</text>
<text x="${MARGIN + 12}" y="${tbY + 60}" class="title-sub">Escala: ${escapeXml(scale)}  ·  Unidades: mm</text>

<text x="${W - MARGIN - 288}" y="${tbY + 20}" class="title-brand">⚒ LA FORJA DE HEFESTOS</text>
<text x="${W - MARGIN - 288}" y="${tbY + 40}" class="title-sub">Autor: ${escapeXml(author)}</text>
<text x="${W - MARGIN - 288}" y="${tbY + 55}" class="title-sub">Fecha: ${escapeXml(date)}</text>
<text x="${W - MARGIN - 288}" y="${tbY + 70}" class="title-sub">F-Rep Engine v0.1 · Online CAD</text>
`;

  svg += '</svg>';
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Download blueprint as SVG file */
export function downloadBlueprint(
  scene: SdfNode,
  options?: BlueprintOptions,
  filename = 'forja-plano.svg',
) {
  const svg = generateBlueprint(scene, options);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
