#!/usr/bin/env node
/**
 * ⚒️ Fitting Diagnostic — Analyze REAL contour shapes vs entity output
 * Usage: node scripts/fitting-diagnostic.cjs <file.stp>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const occtFactory = require('occt-import-js');

class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
}
class BufferGeometry {
  constructor() { this._attrs = {}; this._index = null; }
  setAttribute(n, a) { this._attrs[n] = a; }
  getAttribute(n) { return this._attrs[n]; }
  setIndex(a) { this._index = a; }
  getIndex() { return this._index; }
}

async function loadStep(filePath, occt) {
  const data = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(data), null);
  if (!result.success) return null;
  const allPos = [], allIdx = [];
  let offset = 0;
  for (const m of result.meshes) {
    const pos = new Float32Array(m.attributes.position.array);
    const idx = m.index ? new Uint32Array(m.index.array) : null;
    for (let i = 0; i < pos.length; i++) allPos.push(pos[i]);
    if (idx) for (let i = 0; i < idx.length; i++) allIdx.push(idx[i] + offset);
    else for (let i = 0; i < pos.length / 3; i++) allIdx.push(i + offset);
    offset += pos.length / 3;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  geo.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  return geo;
}

function computeBB(geo) {
  const pos = geo.getAttribute('position');
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;
  }
  return {min:[x0,y0,z0],max:[x1,y1,z1]};
}

function sliceMesh(geo, axisIdx, depth) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  const segments = [];
  const u = axisIdx === 0 ? 1 : 0;
  const v = axisIdx === 2 ? 1 : 2;
  for (let fi = 0; fi < idx.count; fi += 3) {
    const i0=idx.array[fi],i1=idx.array[fi+1],i2=idx.array[fi+2];
    const verts=[[pos.getX(i0),pos.getY(i0),pos.getZ(i0)],[pos.getX(i1),pos.getY(i1),pos.getZ(i1)],[pos.getX(i2),pos.getY(i2),pos.getZ(i2)]];
    const d = verts.map(p => p[axisIdx] - depth);
    const above = d.map(x => x >= 0);
    const crossings = [];
    for (let e = 0; e < 3; e++) {
      const a=e,b=(e+1)%3;
      if(above[a]!==above[b]) {
        const t = d[a]/(d[a]-d[b]);
        crossings.push(verts[a].map((c,j) => c + t*(verts[b][j]-c)));
      }
    }
    if (crossings.length === 2) {
      segments.push({x1:crossings[0][u],y1:crossings[0][v],x2:crossings[1][u],y2:crossings[1][v]});
    }
  }
  return segments;
}

function buildContours(segments, eps) {
  if (segments.length === 0) return [];
  const used = new Uint8Array(segments.length);
  const contours = [];
  for (let seed = 0; seed < segments.length; seed++) {
    if (used[seed]) continue;
    used[seed] = 1;
    const s = segments[seed];
    const pts = [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}];
    let changed = true;
    while (changed) {
      changed = false;
      const last = pts[pts.length-1];
      for (let ri = 0; ri < segments.length; ri++) {
        if (used[ri]) continue;
        const seg = segments[ri];
        if (Math.hypot(seg.x1-last.x,seg.y1-last.y) < eps) { pts.push({x:seg.x2,y:seg.y2}); used[ri]=1; changed=true; break; }
        if (Math.hypot(seg.x2-last.x,seg.y2-last.y) < eps) { pts.push({x:seg.x1,y:seg.y1}); used[ri]=1; changed=true; break; }
      }
    }
    contours.push(pts);
  }
  return contours;
}

function kasaFit(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let mx=0,my=0;
  for (const p of pts) { mx+=p.x; my+=p.y; }
  mx/=n; my/=n;
  let Suu=0,Svv=0,Suv=0,Suuu=0,Svvv=0,Suvv=0,Svuu=0;
  for (const p of pts) { const u=p.x-mx,v=p.y-my; Suu+=u*u;Svv+=v*v;Suv+=u*v;Suuu+=u*u*u;Svvv+=v*v*v;Suvv+=u*v*v;Svuu+=v*u*u; }
  const det = Suu*Svv-Suv*Suv;
  if (Math.abs(det) < 1e-20) return null;
  const uc=(Svv*(Suuu+Suvv)-Suv*(Svvv+Svuu))/(2*det);
  const vc=(Suu*(Svvv+Svuu)-Suv*(Suuu+Suvv))/(2*det);
  const cx=uc+mx,cy=vc+my;
  const r = Math.sqrt(uc*uc+vc*vc+(Suu+Svv)/n);
  let maxErr=0;
  for (const p of pts) { const d=Math.abs(Math.hypot(p.x-cx,p.y-cy)-r); if(d>maxErr)maxErr=d; }
  const angles = pts.map(p => Math.atan2(p.y-cy,p.x-cx));
  const sorted = [...angles].sort((a,b)=>a-b);
  let maxGap = 0;
  for (let i = 0; i < sorted.length-1; i++) maxGap=Math.max(maxGap,sorted[i+1]-sorted[i]);
  maxGap=Math.max(maxGap,2*Math.PI-sorted[sorted.length-1]+sorted[0]);
  return { cx,cy,r, maxErr, relErr: maxErr/r, spanDeg: (2*Math.PI-maxGap)*180/Math.PI };
}

function classifyContour(pts) {
  const n=pts.length;
  if (n<3) return {cls:'TINY',ideal:0,desc:`${n} pts`};
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
  for (const p of pts) { xMin=Math.min(xMin,p.x);xMax=Math.max(xMax,p.x);yMin=Math.min(yMin,p.y);yMax=Math.max(yMax,p.y); }
  const dw=xMax-xMin, dh=yMax-yMin, diag=Math.hypot(dw,dh);
  const closureDist = Math.hypot(pts[0].x-pts[n-1].x, pts[0].y-pts[n-1].y);
  const isClosed = closureDist < diag * 0.02;
  const cf = kasaFit(pts);
  
  // Count corners
  const w = Math.max(3, Math.floor(n * 0.03));
  const cornerCandidates = [];
  for (let i = w; i < n-w; i++) {
    const bx=pts[i].x-pts[i-w].x,by=pts[i].y-pts[i-w].y;
    const fx=pts[i+w].x-pts[i].x,fy=pts[i+w].y-pts[i].y;
    const bl=Math.hypot(bx,by),fl=Math.hypot(fx,fy);
    if(bl<1e-12||fl<1e-12) continue;
    const dot = (bx*fx+by*fy)/(bl*fl);
    if (dot < Math.cos(30*Math.PI/180)) cornerCandidates.push({i,sharpness:-dot});
  }
  cornerCandidates.sort((a,b)=>b.sharpness-a.sharpness);
  const corners = [];
  for (const c of cornerCandidates) {
    if (corners.some(s => Math.abs(s-c.i) < w*3)) continue;
    corners.push(c.i);
  }
  const nCorners = corners.length;
  
  if (cf && cf.relErr < 0.03 && cf.spanDeg > 340 && isClosed) {
    return {cls:'CIRCLE',ideal:1,desc:`⊙ R=${cf.r.toFixed(4)} span=${cf.spanDeg.toFixed(0)}° err=${cf.relErr.toFixed(4)}`};
  }
  if (nCorners >= 3 && isClosed) {
    return {cls:'POLYGON',ideal:nCorners,desc:`▭ ${nCorners} corners ${dw.toFixed(2)}×${dh.toFixed(2)}`};
  }
  return {cls:'COMPLEX',ideal:Math.max(4,nCorners+2),desc:`◇ ${nCorners}c ${dw.toFixed(2)}×${dh.toFixed(2)}`};
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/fitting-diagnostic.cjs <file.stp>'); process.exit(1); }
  
  console.log(`\n⚒️ FITTING DIAGNOSTIC — ${path.basename(file)}`);
  const occt = await occtFactory();
  const geo = await loadStep(file, occt);
  if (!geo) { console.error('Load failed'); process.exit(1); }
  
  const bb = computeBB(geo);
  const diag = Math.hypot(bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]);
  console.log(`  BB: [${bb.min.map(v=>v.toFixed(2))}] → [${bb.max.map(v=>v.toFixed(2))}] diag=${diag.toFixed(2)}`);
  
  const axes = ['X','Y','Z'];
  const N = 15; // slices per axis

  // Track unique features across all slices
  const circleRegistry = []; // { axis, r, cx, cy, depths[] }
  const polyRegistry = [];   // { axis, corners, w, h, depths[] }
  let totalContours = 0, totalIdealEnts = 0;
  
  for (const axis of axes) {
    const ai=axis==='X'?0:axis==='Y'?1:2;
    const lo=bb.min[ai],hi=bb.max[ai],range=hi-lo;
    console.log(`\n═══ ${axis} [${lo.toFixed(2)}→${hi.toFixed(2)}] ═══`);
    
    for (let si = 0; si < N; si++) {
      const depth = lo + range*(si+0.5)/N;
      const segs = sliceMesh(geo, ai, depth);
      if (segs.length < 2) continue;
      const contours = buildContours(segs, range*0.001);
      
      for (let ci = 0; ci < contours.length; ci++) {
        const pts = contours[ci];
        if (pts.length < 4) continue;
        const c = classifyContour(pts);
        totalContours++;
        totalIdealEnts += c.ideal;
        
        console.log(`  ${axis}@${depth.toFixed(2)} C${ci}: ${c.cls.padEnd(8)} ideal=${c.ideal} │ ${c.desc}`);
        
        if (c.cls === 'CIRCLE') {
          const cf = kasaFit(pts);
          const match = circleRegistry.find(u =>
            u.axis===axis && Math.abs(u.r-cf.r)<Math.max(cf.r*0.02,0.01) &&
            Math.abs(u.cx-cf.cx)<Math.max(cf.r*0.05,0.01) &&
            Math.abs(u.cy-cf.cy)<Math.max(cf.r*0.05,0.01)
          );
          if (match) match.depths.push(depth);
          else circleRegistry.push({axis,r:cf.r,cx:cf.cx,cy:cf.cy,depths:[depth]});
        }
        if (c.cls === 'POLYGON') {
          const match = polyRegistry.find(u =>
            u.axis===axis && u.corners===c.ideal
          );
          if (match) match.depths.push(depth);
          else polyRegistry.push({axis,corners:c.ideal,w:0,h:0,depths:[depth]});
        }
      }
    }
  }
  
  console.log('\n\n╔═══════════════════════════════════════════╗');
  console.log('║          DIAGNOSTIC RESULTS               ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║ Total contours sampled:    ${String(totalContours).padStart(6)}        ║`);
  console.log(`║ Total ideal entities:      ${String(totalIdealEnts).padStart(6)}        ║`);
  console.log(`║ Unique circles:            ${String(circleRegistry.length).padStart(6)}        ║`);
  console.log(`║ Unique polygons:           ${String(polyRegistry.length).padStart(6)}        ║`);
  console.log(`║ REAL unique features:      ${String(circleRegistry.length+polyRegistry.length).padStart(6)}        ║`);
  console.log('╠═══════════════════════════════════════════╣');
  
  if (circleRegistry.length > 0) {
    console.log('║ UNIQUE CIRCLES:                           ║');
    for (const c of circleRegistry) {
      const dMin = Math.min(...c.depths).toFixed(2);
      const dMax = Math.max(...c.depths).toFixed(2);
      console.log(`║  ${c.axis} ⊙ R=${c.r.toFixed(3)} C=(${c.cx.toFixed(2)},${c.cy.toFixed(2)}) ${c.depths.length}× [${dMin}→${dMax}]`);
    }
  }
  if (polyRegistry.length > 0) {
    console.log('║ UNIQUE POLYGONS:                          ║');
    for (const p of polyRegistry) {
      console.log(`║  ${p.axis} ▭ ${p.corners}-gon seen ${p.depths.length}×`);
    }
  }
  
  const sliceContours = circleRegistry.reduce((s,c)=>s+c.depths.length,0) + polyRegistry.reduce((s,p)=>s+p.depths.length,0);
  const real = circleRegistry.length + polyRegistry.length;
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║ REDUNDANCY: ${sliceContours} sliced contours → ${real} unique feats`);
  console.log(`║ OVERSAMPLING: ${(sliceContours/Math.max(1,real)).toFixed(1)}×                       `);
  console.log(`║                                           ║`);
  console.log(`║ CONCLUSION: Instead of fitting each        ║`);
  console.log(`║ slice independently, we should DEDUPLICATE ║`);
  console.log(`║ across slices — same circle at different    ║`);
  console.log(`║ depths = ONE feature with depth range.      ║`);
  console.log('╚═══════════════════════════════════════════╝\n');
}

main().catch(e => { console.error(e); process.exit(1); });
