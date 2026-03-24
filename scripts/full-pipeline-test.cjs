#!/usr/bin/env node
/**
 * ⚒️ La Forja — Full Pipeline Entity Extraction + Roundtrip × 3
 * ================================================================
 *
 * STEP → detect planar directions (v3 σ_θ) → slice mesh → chain contours
 *   → fitContour (Kasa + Gauss-Newton) → lines + arcs + circles
 *   → reconstruct points → fitContour again → compare × 3 iters
 *
 * Runs on ALL 38 .stp files in models/step/
 *
 * Reports per-model:
 *   - Directions detected
 *   - Contours extracted
 *   - Entities fitted: Lines, Arcs (partial), Circles (full)
 *   - Max/avg reconstruction error
 *   - Roundtrip fidelity: entities stable across 3 iterations?
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// Three.js polyfill (minimal for Node)
// ═══════════════════════════════════════════════════════════════

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize;
  }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
}

class BufferGeometry {
  constructor() { this._attributes = {}; this._index = null; this.boundingBox = null; }
  setAttribute(name, attr) { this._attributes[name] = attr; }
  getAttribute(name) { return this._attributes[name]; }
  setIndex(attr) { this._index = attr; }
  getIndex() { return this._index; }
  computeBoundingBox() {
    const pos = this._attributes.position;
    if (!pos) return;
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;
    }
    this.boundingBox = {min:{x:minX,y:minY,z:minZ},max:{x:maxX,y:maxY,z:maxZ}};
  }
}

// ═══════════════════════════════════════════════════════════════
// vec3 math
// ═══════════════════════════════════════════════════════════════
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len3=(a)=>Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
const norm3=(a)=>{const l=len3(a);return l<1e-15?[0,0,0]:[a[0]/l,a[1]/l,a[2]/l]};
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale3=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const neg3=(a)=>[-a[0],-a[1],-a[2]];

// ═══════════════════════════════════════════════════════════════
// v3 Direction Detection (σ_θ angular dispersion)
// ═══════════════════════════════════════════════════════════════

function computeBB3(faces) {
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for (const f of faces) {
    const [x,y,z] = f.center;
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;
  }
  return {min:[x0,y0,z0],max:[x1,y1,z1]};
}

function detectPlanarDirectionsV3(faces, bb) {
  if (faces.length === 0) return [];
  const totalArea = faces.reduce((s,f) => s + f.area, 0);
  const diag = len3(sub3(bb.max, bb.min));
  const COS5 = Math.cos(5*Math.PI/180);
  const clusters = [];

  for (const f of faces) {
    let best = null, bestDot = -Infinity;
    for (const cl of clusters) {
      const d = Math.abs(dot3(f.normal, cl.normal));
      if (d > COS5 && d > bestDot) { bestDot = d; best = cl; }
    }
    if (best) {
      const fn = dot3(f.normal,best.normal) < 0 ? neg3(f.normal) : [...f.normal];
      best.faceNormals.push(fn); best.faceAreas.push(f.area);
      best.offsets.push(dot3(f.center, best.normal));
      const t = best.area + f.area;
      best.normal = norm3(add3(scale3(best.normal, best.area/t), scale3(fn, f.area/t)));
      best.area = t; best.faceCount++;
    } else {
      clusters.push({
        normal:[...f.normal], area:f.area, faceCount:1,
        faceNormals:[[...f.normal]], faceAreas:[f.area], offsets:[dot3(f.center,f.normal)],
      });
    }
  }

  for (const cl of clusters) {
    let sumWT2=0,sumW=0;
    for (let i=0;i<cl.faceNormals.length;i++){
      const cosT=Math.min(1,Math.abs(dot3(cl.faceNormals[i],cl.normal)));
      const theta=Math.acos(cosT);
      sumWT2+=cl.faceAreas[i]*theta*theta; sumW+=cl.faceAreas[i];
    }
    cl.sigmaTheta=Math.sqrt(sumWT2/Math.max(sumW,1e-15))*180/Math.PI;
    const meanOff=cl.offsets.reduce((s,o)=>s+o,0)/cl.offsets.length;
    const varOff=cl.offsets.reduce((s,o)=>s+(o-meanOff)**2,0)/cl.offsets.length;
    cl.sigmaOffsetRel=diag>0?Math.sqrt(varOff)/diag:0;
    cl.areaPct=totalArea>0?(cl.area/totalArea)*100:0;
  }

  const planar = clusters.filter(cl => {
    const isCop = cl.sigmaTheta<1.5 && cl.sigmaOffsetRel<0.001;
    const hasMass = cl.faceCount>=3 || cl.areaPct>0.3;
    return (isCop && hasMass) || cl.areaPct>3.0;
  });

  planar.sort((a,b)=>b.area-a.area);
  const COS10=Math.cos(10*Math.PI/180);
  const merged = [];

  for (const cl of planar) {
    let target=null;
    for (const m of merged) {
      if (Math.abs(dot3(cl.normal,m.anchor))>COS10) { target=m; break; }
    }
    if (target) {
      if (dot3(cl.normal,target.anchor)<0) cl.normal=neg3(cl.normal);
      const t=target.area+cl.area;
      target.normal=norm3(add3(scale3(target.normal,target.area/t),scale3(cl.normal,cl.area/t)));
      target.area=t; target.faceCount+=cl.faceCount;
      target.offsets.push(...cl.offsets);
      target.areaPct+=cl.areaPct;
    } else {
      merged.push({
        normal:[...cl.normal],anchor:[...cl.normal],
        area:cl.area,faceCount:cl.faceCount,offsets:[...cl.offsets],
        sigmaTheta:cl.sigmaTheta,areaPct:cl.areaPct,
      });
    }
  }

  const bbCenter=scale3(add3(bb.min,bb.max),0.5);
  for (const av of [[1,0,0],[0,1,0],[0,0,1]]) {
    if (!merged.some(m=>Math.abs(dot3(m.normal,av))>COS10)) {
      merged.push({normal:[...av],anchor:[...av],area:0,faceCount:0,offsets:[dot3(bbCenter,av)],sigmaTheta:0,areaPct:0});
    }
  }
  merged.sort((a,b)=>b.area-a.area);

  return merged.map(cl => {
    const n=[...cl.normal];
    if(n[0]+n[1]+n[2]<0){n[0]=-n[0];n[1]=-n[1];n[2]=-n[2];}
    const sorted=[...cl.offsets].sort((a,b)=>a-b);
    const ax=Math.abs(n[0]),ay=Math.abs(n[1]),az=Math.abs(n[2]);
    const isAxis=ax>0.985||ay>0.985||az>0.985;
    let label;
    if(ax>0.985)label=n[0]>0?'+X':'-X';
    else if(ay>0.985)label=n[1]>0?'+Y':'-Y';
    else if(az>0.985)label=n[2]>0?'+Z':'-Z';
    else{
      const pitch=Math.asin(Math.max(-1,Math.min(1,n[1])))*180/Math.PI;
      const yaw=Math.atan2(n[0],n[2])*180/Math.PI;
      label=`∠${Math.round(pitch)}°/${Math.round(yaw)}°`;
    }
    return{normal:n,area:cl.area,areaPct:cl.areaPct,faceCount:cl.faceCount,
      offsetRange:[sorted[0],sorted[sorted.length-1]],label,isAxis};
  });
}

// ═══════════════════════════════════════════════════════════════
// Plane generation from directions
// ═══════════════════════════════════════════════════════════════

function generateSlicePlanes(directions, diag) {
  const maxSlices=10, minAreaPct=0.1, minSpacing=diag*0.01;
  const planes=[];
  for(const dir of directions){
    if(!dir.isAxis&&dir.areaPct<minAreaPct)continue;
    const [lo,hi]=dir.offsetRange;
    const range=hi-lo;
    if(range<minSpacing){planes.push({normal:dir.normal,offset:(lo+hi)/2,label:dir.label});continue;}
    const n=Math.min(maxSlices,Math.max(2,Math.ceil(range/minSpacing)));
    const margin=range*0.02;
    for(let i=0;i<n;i++){
      const t=n===1?0.5:i/(n-1);
      planes.push({normal:dir.normal,offset:(lo+margin)+((hi-margin)-(lo+margin))*t,label:`${dir.label} d${i+1}/${n}`});
    }
  }
  return planes;
}

// ═══════════════════════════════════════════════════════════════
// Mesh-Plane Intersection (arbitrary normal — NOT just axis-aligned)
// ═══════════════════════════════════════════════════════════════
//
// For arbitrary plane with normal N and offset d:
//   signed_dist(vertex) = dot(vertex, N) - d
// 2D coords: project onto plane's U,V basis

function planeBasis(n) {
  const up = Math.abs(n[1]) < 0.9 ? [0,1,0] : [1,0,0];
  const u = norm3(cross3(up, n));
  const v = norm3(cross3(n, u));
  return {u, v};
}

function sliceMeshArbitrary(geo, planeNormal, planeOffset) {
  const posAttr = geo.getAttribute('position');
  const idxAttr = geo.getIndex();
  if (!posAttr) return { contours: [] };

  const numTri = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
  const N = planeNormal;
  const {u, v} = planeBasis(N);

  const segments = [];

  for (let t = 0; t < numTri; t++) {
    const i0 = idxAttr ? idxAttr.getX(t*3) : t*3;
    const i1 = idxAttr ? idxAttr.getX(t*3+1) : t*3+1;
    const i2 = idxAttr ? idxAttr.getX(t*3+2) : t*3+2;

    const verts = [];
    for (const idx of [i0, i1, i2]) {
      const px = posAttr.getX(idx), py = posAttr.getY(idx), pz = posAttr.getZ(idx);
      const p3 = [px, py, pz];
      const sd = dot3(p3, N) - planeOffset; // signed distance to plane
      // 2D projection
      const pu = dot3(p3, u);
      const pv = dot3(p3, v);
      verts.push({ sd, u: pu, v: pv });
    }

    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = verts[e], b = verts[(e+1)%3];
      if ((a.sd > 0) !== (b.sd > 0)) {
        const tt = a.sd / (a.sd - b.sd);
        pts.push({ x: a.u + tt*(b.u - a.u), y: a.v + tt*(b.v - a.v) });
      } else if (Math.abs(a.sd) < 1e-12) {
        pts.push({ x: a.u, y: a.v });
      }
    }
    if (pts.length >= 2) segments.push([pts[0], pts[1]]);
  }

  if (segments.length === 0) return { contours: [] };
  return chainSegments(segments);
}

function shoelaceArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i+1)%pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function chainSegments(segments) {
  const used = new Set();
  const contours = [];
  function key(p) { return `${(p.x*1e4)|0},${(p.y*1e4)|0}`; }
  const adj = new Map();
  for (let i = 0; i < segments.length; i++) {
    const [a,b] = segments[i];
    const ka=key(a), kb=key(b);
    if(!adj.has(ka))adj.set(ka,[]);if(!adj.has(kb))adj.set(kb,[]);
    adj.get(ka).push({idx:i,other:b,key:kb});
    adj.get(kb).push({idx:i,other:a,key:ka});
  }
  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    used.add(start);
    const chain = [segments[start][0], segments[start][1]];
    let curKey = key(segments[start][1]);
    const startKey = key(segments[start][0]);
    let safety = segments.length + 10;
    while (curKey !== startKey && safety-- > 0) {
      const nbs = adj.get(curKey) || [];
      let found = false;
      for (const nb of nbs) {
        if (!used.has(nb.idx)) {
          used.add(nb.idx);
          chain.push(nb.other);
          curKey = nb.key;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (chain.length >= 6) {
      contours.push({ points: chain, area: Math.abs(shoelaceArea(chain)) });
    }
  }
  return { contours };
}

// ═══════════════════════════════════════════════════════════════
// Sketch Fitting: fitCircle, fitContour (Kasa + Gauss-Newton)
// Exact port from src/lib/sketch-fitting.ts
// ═══════════════════════════════════════════════════════════════

function dist2d(a,b){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)}
function lerp2d(a,b,t){return{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}}
function cross2d(a,b){return a.x*b.y-a.y*b.x}
function angleBetween(a,b){let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d}
function pointToSegDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-20)return dist2d(p,a);let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;t=Math.max(0,Math.min(1,t));return dist2d(p,{x:a.x+t*dx,y:a.y+t*dy})}
function lineDistToPoint(s,e,p){const dx=e.x-s.x,dy=e.y-s.y,l=Math.sqrt(dx*dx+dy*dy);if(l<1e-12)return dist2d(p,s);return Math.abs(dy*p.x-dx*p.y+e.x*s.y-e.y*s.x)/l}
function lineAngle(s,e){return Math.atan2(e.y-s.y,e.x-s.x)}
function lineLen(s,e){return dist2d(s,e)}

function fitCircle(points) {
  if (points.length < 3) return null;
  let sX=0,sY=0,sX2=0,sY2=0,sXY=0,sX3=0,sY3=0,sX2Y=0,sXY2=0;
  const n = points.length;
  for (const p of points) {
    sX+=p.x;sY+=p.y;sX2+=p.x*p.x;sY2+=p.y*p.y;sXY+=p.x*p.y;
    sX3+=p.x**3;sY3+=p.y**3;sX2Y+=p.x*p.x*p.y;sXY2+=p.x*p.y*p.y;
  }
  const A=n*sX2-sX*sX,B=n*sXY-sX*sY,C=n*sY2-sY*sY;
  const D=0.5*(n*sX3+n*sXY2-sX*sX2-sX*sY2);
  const E=0.5*(n*sX2Y+n*sY3-sY*sX2-sY*sY2);
  const det=A*C-B*B;
  if(Math.abs(det)<1e-12)return null;
  const cx=(D*C-B*E)/det,cy=(A*E-B*D)/det;
  let rSum=0;for(const p of points)rSum+=dist2d(p,{x:cx,y:cy});
  const radius=rSum/n;
  let maxErr=0,sumErr=0;
  for(const p of points){const err=Math.abs(dist2d(p,{x:cx,y:cy})-radius);maxErr=Math.max(maxErr,err);sumErr+=err}
  return{center:{x:cx,y:cy},radius,maxError:maxErr,avgError:sumErr/n};
}

function solve3x3(A,b){
  const a=A.map(r=>[...r]);const x=[...b];
  for(let c=0;c<3;c++){let mv=Math.abs(a[c][c]),mr=c;for(let r=c+1;r<3;r++){if(Math.abs(a[r][c])>mv){mv=Math.abs(a[r][c]);mr=r;}}
    if(mv<1e-15)return null;if(mr!==c){[a[c],a[mr]]=[a[mr],a[c]];[x[c],x[mr]]=[x[mr],x[c]];}
    for(let r=c+1;r<3;r++){const f=a[r][c]/a[c][c];for(let j=c;j<3;j++)a[r][j]-=f*a[c][j];x[r]-=f*x[c];}}
  const res=[0,0,0];for(let i=2;i>=0;i--){let s=x[i];for(let j=i+1;j<3;j++)s-=a[i][j]*res[j];if(Math.abs(a[i][i])<1e-15)return null;res[i]=s/a[i][i];}
  return res;
}

function refineCircle(points, init, maxIter=25) {
  let cx=init.center.x,cy=init.center.y,r=init.radius;const n=points.length;
  for(let iter=0;iter<maxIter;iter++){
    let J00=0,J01=0,J02=0,J11=0,J12=0,J22=0,r0=0,r1=0,r2=0;
    for(const p of points){const dx=p.x-cx,dy=p.y-cy,d=Math.sqrt(dx*dx+dy*dy);if(d<1e-15)continue;
      const res=d-r;const j0=-dx/d,j1=-dy/d,j2=-1;
      J00+=j0*j0;J01+=j0*j1;J02+=j0*j2;J11+=j1*j1;J12+=j1*j2;J22+=j2*j2;
      r0+=j0*res;r1+=j1*res;r2+=j2*res;}
    const delta=solve3x3([[J00,J01,J02],[J01,J11,J12],[J02,J12,J22]],[-r0,-r1,-r2]);
    if(!delta)break;cx+=delta[0];cy+=delta[1];r+=delta[2];
    if(Math.sqrt(delta[0]**2+delta[1]**2+delta[2]**2)<1e-14)break;}
  r=Math.abs(r);let maxErr=0,sumErr=0;
  for(const p of points){const err=Math.abs(dist2d(p,{x:cx,y:cy})-r);maxErr=Math.max(maxErr,err);sumErr+=err}
  return{center:{x:cx,y:cy},radius:r,maxError:maxErr,avgError:sumErr/n};
}

function circleFrom3(p1,p2,p3){
  const d=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));
  if(Math.abs(d)<1e-10)return null;
  const ux=((p1.x**2+p1.y**2)*(p2.y-p3.y)+(p2.x**2+p2.y**2)*(p3.y-p1.y)+(p3.x**2+p3.y**2)*(p1.y-p2.y))/d;
  const uy=((p1.x**2+p1.y**2)*(p3.x-p2.x)+(p2.x**2+p2.y**2)*(p1.x-p3.x)+(p3.x**2+p3.y**2)*(p2.x-p1.x))/d;
  return{center:{x:ux,y:uy},radius:dist2d({x:ux,y:uy},p1)};
}

function localCurvature(pts,i){const n=pts.length;const prev=pts[(i-1+n)%n],curr=pts[i],next=pts[(i+1)%n];
  const c=circleFrom3(prev,curr,next);if(!c||c.radius>1e6)return 0;
  const v1={x:curr.x-prev.x,y:curr.y-prev.y},v2={x:next.x-curr.x,y:next.y-curr.y};
  return(cross2d(v1,v2)>=0?1:-1)/c.radius;}

function projectOntoCircle(pt,center,r){
  const dx=pt.x-center.x,dy=pt.y-center.y,d=Math.sqrt(dx*dx+dy*dy);
  if(d<1e-15)return{x:center.x+r,y:center.y};
  return{x:center.x+(dx/d)*r,y:center.y+(dy/d)*r};}

function computeSweep(sa,ea,ma){
  let s=ea-sa;while(s<=0)s+=2*Math.PI;
  let m=ma-sa;while(m<=0)m+=2*Math.PI;
  return m<=s?s:-(2*Math.PI-s);
}

function makeArc(c,r,sa,ea,sp,ep){const sw=ea-sa;return{type:'arc',center:c,radius:r,startAngle:sa,endAngle:ea,start:sp,end:ep,isFullCircle:Math.abs(sw)>Math.PI*1.95};}
function makeLine(s,e){return{type:'line',start:{...s},end:{...e}};}
function sweepAng(a){let s=a.endAngle-a.startAngle;while(s>2*Math.PI)s-=2*Math.PI;while(s<-2*Math.PI)s+=2*Math.PI;return s;}

function fitContour(pts, tolerance) {
  if (pts.length < 3) return { entities: [], constraints: [] };
  const cleaned = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (dist2d(pts[i], cleaned[cleaned.length-1]) > 1e-6) cleaned.push(pts[i]);
  if (cleaned.length > 2 && dist2d(cleaned[0], cleaned[cleaned.length-1]) < 1e-6) cleaned.pop();
  if (cleaned.length < 3) return { entities: [], constraints: [] };

  const n = cleaned.length;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of cleaned){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}
  const diag = Math.sqrt((maxX-minX)**2+(maxY-minY)**2);
  const tol = tolerance ?? Math.max(0.001, diag*0.0001);

  // Full circle test — adaptive tolerance for tessellated circles
  // Chord error ≈ R·(1 − cos(π/N)) where N = polygon vertex count
  // Capped at 2% of contour diagonal
  const kasaFit0 = fitCircle(cleaned);
  if (kasaFit0 && kasaFit0.radius < diag*2) {
    const cFit = refineCircle(cleaned, kasaFit0);
    const chordErr = cFit.radius * (1 - Math.cos(Math.PI / Math.max(6, n)));
    const circleTol = Math.min(Math.max(tol, chordErr * 2.5), diag * 0.02);
    const relErr = cFit.maxError / Math.max(cFit.radius, 1e-12);
    if (cFit.maxError < circleTol || (relErr < 0.03 && cFit.maxError < diag * 0.01)) {
      const arc = makeArc(cFit.center,cFit.radius,0,2*Math.PI,cleaned[0],cleaned[0]);
      return { entities: [arc], constraints: [] };
    }
  }

  // Phase 1: Open point
  const kappa=new Float64Array(n);for(let i=0;i<n;i++)kappa[i]=localCurvature(cleaned,i);
  let maxJump=-1,openIdx=0;
  for(let i=0;i<n;i++){const j=Math.abs(kappa[i]-kappa[(i+1)%n]);if(j>maxJump){maxJump=j;openIdx=(i+1)%n;}}
  const openPts=[];for(let i=0;i<n;i++)openPts.push(cleaned[(openIdx+i)%n]);

  // Phase 2: Recursive
  const entities = recursiveFit(openPts, 0, openPts.length-1, tol, 0, diag);
  // Phase 3: Merge + arc→circle upgrade
  let merged = mergeEntities(entities, tol);
  // Upgrade arcs with sweep ≥ 350° → full circle
  for(const e of merged){if(e.type==='arc'&&!e.isFullCircle&&Math.abs(sweepAng(e))>Math.PI*1.94){e.isFullCircle=true;e.endAngle=e.startAngle+2*Math.PI;e.end={...e.start};}}
  // Wrap-around merge: first+last arcs with same center → circle
  if(merged.length>=2){const first=merged[0],last=merged[merged.length-1];if(first.type==='arc'&&last.type==='arc'){const cd=dist2d(first.center,last.center),rd=Math.abs(first.radius-last.radius);if(cd<tol*2&&rd<tol*2){const ac=lerp2d(first.center,last.center,0.5),ar=(first.radius+last.radius)/2,cs=sweepAng(last)+sweepAng(first);if(Math.abs(cs)>Math.PI*1.94){merged=[makeArc(ac,ar,0,2*Math.PI,last.start,last.start),...merged.slice(1,-1)];}else if(Math.abs(cs)>0.1){merged=[makeArc(ac,ar,last.startAngle,last.startAngle+cs,last.start,first.end),...merged.slice(1,-1)];}}}}
  // Phase 4: Snap
  for(let i=0;i<merged.length;i++){
    const curr=merged[i],next=merged[(i+1)%merged.length];
    if(!curr||!next)continue;
    const gap=dist2d(getEnd(curr),getStart(next));if(gap>tol*20)continue;
    let mid=lerp2d(getEnd(curr),getStart(next),0.5);
    if(curr.type==='arc'&&!curr.isFullCircle)mid=projectOntoCircle(mid,curr.center,curr.radius);
    else if(next.type==='arc'&&!next.isFullCircle)mid=projectOntoCircle(mid,next.center,next.radius);
    setEnd(curr,mid);setStart(next,mid);
  }
  // Phase 5: Constraints
  const constraints = detectConstraints(merged, tol);
  return { entities: merged, constraints };
}

function recursiveFit(pts,start,end,tol,depth,contourDiag){
  contourDiag=contourDiag||Infinity;
  const count=end-start+1;if(count<=1)return[];
  if(count===2){if(dist2d(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
  const sub=[];for(let i=start;i<=end;i++)sub.push(pts[i]);
  const kf=fitCircle(sub);
  if(kf){const cf=refineCircle(sub,kf);
    if(cf.maxError<tol){const chordLen=dist2d(pts[start],pts[end]);
      // Adaptive tolerance ONLY for closed-loop circle detection
      const arcChordErr=cf.radius*(1-Math.cos(Math.PI/Math.max(6,count)));
      const closeLoopTol=Math.min(Math.max(tol,arcChordErr*2.5),contourDiag*0.02);
      const isClosed=chordLen<closeLoopTol*2;
      if(isClosed&&count>=6)return[makeArc(cf.center,cf.radius,0,2*Math.PI,pts[start],pts[start])];
      const sa=Math.atan2(pts[start].y-cf.center.y,pts[start].x-cf.center.x);
      const ea=Math.atan2(pts[end].y-cf.center.y,pts[end].x-cf.center.x);
      const mi=Math.floor((start+end)/2);
      const ma=Math.atan2(pts[mi].y-cf.center.y,pts[mi].x-cf.center.x);
      const sw=computeSweep(sa,ea,ma);const swDeg=Math.abs(sw)*180/Math.PI;
      if(swDeg>5&&cf.radius<chordLen*10&&cf.radius<contourDiag*2){
        const sp=projectOntoCircle(pts[start],cf.center,cf.radius);
        const ep=projectOntoCircle(pts[end],cf.center,cf.radius);
        return[makeArc(cf.center,cf.radius,sa,sa+sw,sp,ep)];}}}
  let maxDev=0,maxDevIdx=start;
  for(let i=start+1;i<end;i++){const d=pointToSegDist(pts[i],pts[start],pts[end]);if(d>maxDev){maxDev=d;maxDevIdx=i;}}
  if(maxDev<tol){if(dist2d(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
  if(depth>50)return[makeLine(pts[start],pts[end])];
  return[...recursiveFit(pts,start,maxDevIdx,tol,depth+1,contourDiag),...recursiveFit(pts,maxDevIdx,end,tol,depth+1,contourDiag)];
}

function mergeEntities(ents,tol){
  if(ents.length<2)return[...ents];let changed=true,result=[...ents];
  while(changed){changed=false;const next=[result[0]];
    for(let i=1;i<result.length;i++){const prev=next[next.length-1],curr=result[i];
      if(prev.type==='line'&&curr.type==='line'){const m=makeLine(prev.start,curr.end);
        const md=lineDistToPoint(prev.start,curr.end,prev.end);
        if(md<tol*0.3&&lineLen(prev.start,curr.end)>0.001){next[next.length-1]=m;changed=true;continue;}}
      if(prev.type==='arc'&&curr.type==='arc'){const cd=dist2d(prev.center,curr.center),rd=Math.abs(prev.radius-curr.radius);
        if(cd<tol*0.3&&rd<tol*0.3){const ac=lerp2d(prev.center,curr.center,0.5),ar=(prev.radius+curr.radius)/2;
          const cs=sweepAng(prev)+sweepAng(curr);
          next[next.length-1]=makeArc(ac,ar,prev.startAngle,prev.startAngle+cs,prev.start,curr.end);changed=true;continue;}}
      next.push(curr);}result=next;}return result;}

function getStart(e){return e.start;}function getEnd(e){return e.end;}
function setStart(e,pt){e.start={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.startAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.startAngle)<bd){best=c;bd=Math.abs(c-e.startAngle);}e.startAngle=best;}}
function setEnd(e,pt){e.end={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.endAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.endAngle)<bd){best=c;bd=Math.abs(c-e.endAngle);}e.endAngle=best;}}

function detectConstraints(ents,tol){
  const cs=[];const at=2*Math.PI/180;
  for(let i=0;i<ents.length;i++){const c=ents[i],nx=ents[(i+1)%ents.length];
    if(c.type==='line'){const a=lineAngle(c.start,c.end);if(Math.abs(Math.sin(a))<Math.sin(at))cs.push({type:'horizontal',entities:[i]});if(Math.abs(Math.cos(a))<Math.sin(at))cs.push({type:'vertical',entities:[i]});}
    if(c.type==='arc')for(let j=i+1;j<ents.length;j++){const ej=ents[j];if(ej.type==='arc'&&Math.abs(c.radius-ej.radius)/Math.max(c.radius,ej.radius)<0.02)cs.push({type:'equal_radius',entities:[i,j]});}}
  return cs;
}

function pointToArcDist(p,arc){
  const dx=p.x-arc.center.x,dy=p.y-arc.center.y,d=Math.sqrt(dx*dx+dy*dy);
  const cd=Math.abs(d-arc.radius);if(arc.isFullCircle)return cd;
  const angle=Math.atan2(dy,dx);const sa=arc.startAngle;const sw=sweepAng(arc);
  let ra=angle-sa;if(sw>=0){while(ra<0)ra+=2*Math.PI;while(ra>2*Math.PI)ra-=2*Math.PI;if(ra<=sw+1e-9)return cd;}
  else{while(ra>0)ra-=2*Math.PI;while(ra<-2*Math.PI)ra+=2*Math.PI;if(ra>=sw-1e-9)return cd;}
  return Math.min(dist2d(p,arc.start),dist2d(p,arc.end));
}

function reconstructionError(origPts, entities) {
  if(entities.length===0)return{maxError:Infinity,avgError:Infinity,coverage:0};
  let sumErr=0,maxErr=0,covered=0;
  for(const orig of origPts){let minD=Infinity;
    for(const e of entities){const d=e.type==='line'?pointToSegDist(orig,e.start,e.end):pointToArcDist(orig,e);if(d<minD)minD=d;}
    sumErr+=minD;maxErr=Math.max(maxErr,minD);if(minD<1)covered++;}
  return{maxError:maxErr,avgError:sumErr/origPts.length,coverage:covered/origPts.length};
}

// ═══════════════════════════════════════════════════════════════
// Entity → Points (for roundtrip)
// ═══════════════════════════════════════════════════════════════

function entitiesToPoints(entities, numPtsPerEntity = 50) {
  const pts = [];
  for (const e of entities) {
    if (e.type === 'line') {
      for (let i = 0; i <= numPtsPerEntity; i++) {
        const t = i / numPtsPerEntity;
        pts.push({ x: e.start.x + t*(e.end.x-e.start.x), y: e.start.y + t*(e.end.y-e.start.y) });
      }
    } else if (e.type === 'arc') {
      const sa = e.startAngle, sw = sweepAng(e);
      for (let i = 0; i <= numPtsPerEntity; i++) {
        const t = i / numPtsPerEntity;
        const a = sa + sw * t;
        pts.push({ x: e.center.x + e.radius*Math.cos(a), y: e.center.y + e.radius*Math.sin(a) });
      }
    }
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════
// STEP Loader
// ═══════════════════════════════════════════════════════════════

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
    else for (let i = 0; i < pos.length/3; i++) allIdx.push(i + offset);
    offset += pos.length / 3;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  geo.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  geo.computeBoundingBox();

  // Also collect face data for direction detection
  const faces = [];
  const fPos = new Float32Array(allPos);
  const fIdx = new Uint32Array(allIdx);
  for (let t = 0; t < fIdx.length/3; t++) {
    const i0=fIdx[t*3],i1=fIdx[t*3+1],i2=fIdx[t*3+2];
    const va=[fPos[i0*3],fPos[i0*3+1],fPos[i0*3+2]];
    const vb=[fPos[i1*3],fPos[i1*3+1],fPos[i1*3+2]];
    const vc=[fPos[i2*3],fPos[i2*3+1],fPos[i2*3+2]];
    const ab=sub3(vb,va),ac=sub3(vc,va);const n=cross3(ab,ac);const a2=len3(n);
    if(a2<1e-12)continue;
    faces.push({normal:norm3(n),center:scale3(add3(add3(va,vb),vc),1/3),area:a2*0.5});
  }

  return { geo, faces };
}

function collectStepFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...collectStepFiles(full));
    else if (/\.(stp|step)$/i.test(e.name)) files.push(full);
  }
  return files;
}

// ═══════════════════════════════════════════════════════════════
// TERMINAL COLORS
// ═══════════════════════════════════════════════════════════════
const B='\x1b[1m',D='\x1b[2m',RS='\x1b[0m';
const GR='\x1b[32m',RD='\x1b[31m',CY='\x1b[36m',YE='\x1b[33m',MG='\x1b[35m';

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  let occtFactory;
  try { occtFactory = require('occt-import-js'); }
  catch { console.error('occt-import-js not found'); process.exit(1); }

  const occt = await occtFactory();
  const modelsDir = path.join(__dirname, '..', 'models', 'step');
  const files = collectStepFiles(modelsDir).sort();

  console.log(`${GR}${'═'.repeat(80)}${RS}`);
  console.log(`${GR}${B}⚒️  FULL PIPELINE: STEP → Directions → Slice → Fit (Lines+Arcs+Circles) → Roundtrip ×3${RS}`);
  console.log(`${GR}${'═'.repeat(80)}${RS}`);
  console.log(`${D}  Files: ${files.length} | Algorithm: v3(σ_θ) + Kasa + Gauss-Newton | Iters: 3${RS}\n`);

  const ITERS = 3;
  let totalTests = 0, totalPassed = 0;
  const globalStats = {
    files: 0, dirs: 0, planes: 0, contours: 0,
    lines: 0, arcs: 0, circles: 0, constraints: 0,
    worstErr: 0, sumAvg: 0, nAvg: 0,
  };

  for (const filePath of files) {
    const relName = path.relative(modelsDir, filePath);
    let loaded;
    try { loaded = await loadStep(filePath, occt); }
    catch (e) { console.log(`  ${RD}✗${RS} ${relName} — WASM error: ${e.message || e}`); continue; }
    if (!loaded) { console.log(`  ${RD}✗${RS} ${relName} — failed to load`); continue; }

    const { geo, faces } = loaded;
    const bb = computeBB3(faces);
    const diag = len3(sub3(bb.max, bb.min));
    const bbObj = geo.boundingBox;

    // ── Step 1: Detect planar directions ──
    const dirs = detectPlanarDirectionsV3(faces, bb);
    const planes = generateSlicePlanes(dirs, diag);

    // ── Step 2: Slice mesh at each plane and fit entities ──
    let totalContours = 0, totalLines = 0, totalArcs = 0, totalCircles = 0;
    let totalConstraints = 0, worstErr = 0, sumAvgErr = 0, nContoursFitted = 0;
    const allFittedContours = []; // for roundtrip

    for (const plane of planes) {
      const sr = sliceMeshArbitrary(geo, plane.normal, plane.offset);
      for (const contour of sr.contours) {
        if (contour.points.length < 6) continue;
        totalContours++;

        const { entities, constraints } = fitContour(contour.points);
        if (entities.length === 0) continue;

        const err = reconstructionError(contour.points, entities);
        const nLines = entities.filter(e => e.type === 'line').length;
        const nArcs = entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
        const nCircles = entities.filter(e => e.type === 'arc' && e.isFullCircle).length;

        totalLines += nLines; totalArcs += nArcs; totalCircles += nCircles;
        totalConstraints += constraints.length;
        if (isFinite(err.maxError)) {
          worstErr = Math.max(worstErr, err.maxError);
          sumAvgErr += err.avgError;
          nContoursFitted++;
        }

        allFittedContours.push({ entities, originalPoints: contour.points, err });
      }
    }

    const avgErr = nContoursFitted > 0 ? sumAvgErr / nContoursFitted : 0;
    const errIcon = worstErr < 0.01 ? `${GR}✅${RS}` : worstErr < 0.1 ? `${YE}🟡${RS}` : `${RD}🔴${RS}`;

    console.log(`${B}${CY}═══ ${relName} ═══${RS}`);
    console.log(`  ${D}${faces.length} tris | diag=${diag.toFixed(1)}mm${RS}`);
    console.log(`  ${YE}Dirs: ${dirs.length} | Planes: ${planes.length} | Contours: ${totalContours}${RS}`);
    console.log(`  ${MG}Entities: ${totalLines}L + ${totalArcs}A + ${totalCircles}⊙ = ${totalLines+totalArcs+totalCircles} | Constraints: ${totalConstraints}${RS}`);
    console.log(`  ${errIcon} maxErr=${worstErr.toFixed(4)}mm avgErr=${avgErr.toFixed(4)}mm`);

    // Show top directions
    for (let i = 0; i < Math.min(4, dirs.length); i++) {
      const d = dirs[i];
      console.log(`    ${D}${d.label.padEnd(14)} ${d.areaPct.toFixed(1).padStart(5)}% area  ${d.faceCount} faces${RS}`);
    }
    if (dirs.length > 4) console.log(`    ${D}... +${dirs.length-4} more${RS}`);

    // ── Step 3: Entity roundtrip ──
    let iterStable = true;
    if (allFittedContours.length > 0) {
      // Take a sample of contours for roundtrip (up to 20)
      const sample = allFittedContours.slice(0, Math.min(20, allFittedContours.length));
      for (const fc of sample) {
        const origEntities = fc.entities;
        let prevEnts = origEntities;
        for (let iter = 1; iter <= ITERS; iter++) {
          // Reconstruct points from entities, re-fit
          const pts = entitiesToPoints(prevEnts, 50);
          if (pts.length < 6) break;
          const { entities: newEnts } = fitContour(pts);

          // Compare entity counts and types
          const prevL = prevEnts.filter(e=>e.type==='line').length;
          const prevA = prevEnts.filter(e=>e.type==='arc').length;
          const newL = newEnts.filter(e=>e.type==='line').length;
          const newA = newEnts.filter(e=>e.type==='arc').length;

          if (prevL !== newL || prevA !== newA) {
            iterStable = false;
          }
          prevEnts = newEnts;
        }
      }
    }

    totalTests++;
    if (iterStable) {
      totalPassed++;
      console.log(`  ${GR}${B}Roundtrip: STABLE across ${ITERS} iterations${RS}`);
    } else {
      console.log(`  ${RD}${B}Roundtrip: ENTITY DRIFT detected${RS}`);
    }
    console.log();

    globalStats.files++;
    globalStats.dirs += dirs.length;
    globalStats.planes += planes.length;
    globalStats.contours += totalContours;
    globalStats.lines += totalLines;
    globalStats.arcs += totalArcs;
    globalStats.circles += totalCircles;
    globalStats.constraints += totalConstraints;
    globalStats.worstErr = Math.max(globalStats.worstErr, worstErr);
    globalStats.sumAvg += sumAvgErr;
    globalStats.nAvg += nContoursFitted;
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  const gAvg = globalStats.nAvg > 0 ? globalStats.sumAvg / globalStats.nAvg : 0;
  console.log(`${GR}${'═'.repeat(80)}${RS}`);
  console.log(`${B}  GLOBAL SUMMARY${RS}`);
  console.log(`  Files:       ${globalStats.files}`);
  console.log(`  Directions:  ${globalStats.dirs} total (avg ${(globalStats.dirs/Math.max(1,globalStats.files)).toFixed(1)}/file)`);
  console.log(`  Planes:      ${globalStats.planes} total`);
  console.log(`  Contours:    ${globalStats.contours} total`);
  console.log(`  ${MG}Lines:       ${globalStats.lines}${RS}`);
  console.log(`  ${MG}Arcs:        ${globalStats.arcs}${RS}`);
  console.log(`  ${MG}Circles:     ${globalStats.circles}${RS}`);
  console.log(`  ${MG}Constraints: ${globalStats.constraints}${RS}`);
  console.log(`  Worst err:   ${globalStats.worstErr.toFixed(4)}mm`);
  console.log(`  Avg err:     ${gAvg.toFixed(4)}mm`);
  console.log();
  console.log(`${B}  Roundtrip:   ${totalPassed}/${totalTests} stable${RS}`);
  if (totalPassed === totalTests) {
    console.log(`${GR}${B}  ✅ ALL FILES PASS${RS}`);
  } else {
    console.log(`${RD}${B}  ❌ ${totalTests - totalPassed} FILES WITH ENTITY DRIFT${RS}`);
  }
  console.log(`${GR}${'═'.repeat(80)}${RS}\n`);

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
