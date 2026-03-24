#!/usr/bin/env node
/**
 * ⚒️ La Forja — Feature Decomposition Test
 * ==========================================
 *
 * STEP → v3 directions → slice → fit entities → FEATURE RECOGNITION
 *
 * Converts raw entities (32K lines + 9K arcs + 3K circles) into
 * high-level CAD operations (~15/part) like Fusion 360's feature tree.
 *
 * Pipeline:
 *   1. Load STEP → tessellated mesh
 *   2. Detect planar directions (v3 σ_θ)
 *   3. Generate + slice on geometry-driven planes
 *   4. Fit entities (Kasa + Gauss-Newton lines/arcs/circles)
 *   5. ★ Group into profiles (closed loops)
 *   6. ★ Classify profiles (circle→hole, 2arcs+2lines→slot, etc.)
 *   7. ★ Cluster identical profiles across slices → features
 *   8. ★ Detect patterns (linear arrays, bolt circles)
 *   9. Report: feature tree per model
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
    // High-area fallback requires offset consistency to reject curved surface bands
    // (tessellated cones/cylinders create normal-bands with high area but spread offsets)
    const highAreaPlanar = cl.areaPct>3.0 && cl.sigmaOffsetRel<0.005;
    return (isCop && hasMass) || highAreaPlanar;
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
// Plane generation
// ═══════════════════════════════════════════════════════════════

function generateSlicePlanes(directions, diag) {
  const maxSlices=10, minAreaPct=0.1, minSpacing=diag*0.01;
  const planes=[];
  for(const dir of directions){
    if(!dir.isAxis&&dir.areaPct<minAreaPct)continue;
    const [lo,hi]=dir.offsetRange;
    const range=hi-lo;
    // For thin parts: ensure at least 3 planes even when range < minSpacing
    const minPlanes = 3;
    if(range<1e-6){planes.push({normal:dir.normal,offset:(lo+hi)/2,label:dir.label});continue;}
    const n=Math.min(maxSlices,Math.max(minPlanes,Math.ceil(range/minSpacing)));
    const margin=range*0.05;
    for(let i=0;i<n;i++){
      const t=n===1?0.5:i/(n-1);
      planes.push({normal:dir.normal,offset:(lo+margin)+((hi-margin)-(lo+margin))*t,label:`${dir.label} d${i+1}/${n}`});
    }
  }
  return planes;
}

// ═══════════════════════════════════════════════════════════════
// Mesh-Plane Intersection (arbitrary normal)
// ═══════════════════════════════════════════════════════════════

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
      const sd = dot3(p3, N) - planeOffset;
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
// Sketch Fitting (exact port from full-pipeline-test.cjs)
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

  const kappa=new Float64Array(n);for(let i=0;i<n;i++)kappa[i]=localCurvature(cleaned,i);
  let maxJump=-1,openIdx=0;
  for(let i=0;i<n;i++){const j=Math.abs(kappa[i]-kappa[(i+1)%n]);if(j>maxJump){maxJump=j;openIdx=(i+1)%n;}}
  const openPts=[];for(let i=0;i<n;i++)openPts.push(cleaned[(openIdx+i)%n]);

  const entities = recursiveFit(openPts, 0, openPts.length-1, tol, 0, diag);
  let merged = mergeEntities(entities, tol);
  for(const e of merged){if(e.type==='arc'&&!e.isFullCircle&&Math.abs(sweepAng(e))>Math.PI*1.94){e.isFullCircle=true;e.endAngle=e.startAngle+2*Math.PI;e.end={...e.start};}}
  if(merged.length>=2){const first=merged[0],last=merged[merged.length-1];if(first.type==='arc'&&last.type==='arc'){const cd=dist2d(first.center,last.center),rd=Math.abs(first.radius-last.radius);if(cd<tol*2&&rd<tol*2){const ac=lerp2d(first.center,last.center,0.5),ar=(first.radius+last.radius)/2,cs=sweepAng(last)+sweepAng(first);if(Math.abs(cs)>Math.PI*1.94){merged=[makeArc(ac,ar,0,2*Math.PI,last.start,last.start),...merged.slice(1,-1)];}else if(Math.abs(cs)>0.1){merged=[makeArc(ac,ar,last.startAngle,last.startAngle+cs,last.start,first.end),...merged.slice(1,-1)];}}}}
  for(let i=0;i<merged.length;i++){
    const curr=merged[i],next=merged[(i+1)%merged.length];
    if(!curr||!next)continue;
    const gap=dist2d(getEnd(curr),getStart(next));if(gap>tol*20)continue;
    let mid=lerp2d(getEnd(curr),getStart(next),0.5);
    if(curr.type==='arc'&&!curr.isFullCircle)mid=projectOntoCircle(mid,curr.center,curr.radius);
    else if(next.type==='arc'&&!next.isFullCircle)mid=projectOntoCircle(mid,next.center,next.radius);
    setEnd(curr,mid);setStart(next,mid);
  }
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

// ═══════════════════════════════════════════════════════════════
// ★ FEATURE RECOGNITION (port from src/lib/feature-recognition.ts)
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a single contour's entities into a profile type.
 */
function classifyProfile(entities, contourArea, maxContourArea) {
  const lines = entities.filter(e => e.type === 'line');
  const arcs = entities.filter(e => e.type === 'arc');
  const fullCircles = arcs.filter(a => a.isFullCircle);
  const partialArcs = arcs.filter(a => !a.isFullCircle);

  const isHole = contourArea < maxContourArea * 0.5;

  // Compute bbox + centroid from entities
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  const allPts = [];
  for (const e of entities) {
    const pts = entityEndpoints(e);
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      allPts.push(p);
    }
    // For arcs, also sample along the arc to get true bbox
    if (e.type === 'arc') {
      const sw = sweepAng(e);
      for (let i = 0; i <= 16; i++) {
        const a = e.startAngle + sw * (i / 16);
        const px = e.center.x + e.radius * Math.cos(a);
        const py = e.center.y + e.radius * Math.sin(a);
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
    }
  }

  const w = maxX - minX, h = maxY - minY;
  const centX = (minX + maxX) / 2, centY = (minY + maxY) / 2;

  const base = {
    entities, centroid: { x: centX, y: centY },
    bbox: { minX, minY, maxX, maxY }, area: contourArea, isHole,
  };

  const maxReasonableRadius = Math.max(w, h) * 0.6; // cap for degenerate circle fits

  // ── Single full circle ──
  if (fullCircles.length === 1 && lines.length === 0 && partialArcs.length === 0) {
    const r = fullCircles[0].radius;
    if (r < maxReasonableRadius) {
      return { ...base, type: 'circle', radius: r };
    }
  }

  // ── SLOT: 2 semicircular arcs + 2-4 lines ──
  if (partialArcs.length === 2 && lines.length >= 2 && lines.length <= 4 && fullCircles.length === 0) {
    const a1 = partialArcs[0], a2 = partialArcs[1];
    const rd = Math.abs(a1.radius - a2.radius) / Math.max(a1.radius, a2.radius, 1e-12);
    const sw1 = Math.abs(sweepAng(a1));
    const sw2 = Math.abs(sweepAng(a2));
    // Both arcs sweep > 120° (relaxed from 140° for tessellation artifacts)
    if (rd < 0.20 && sw1 > 2.0 && sw2 > 2.0) {
      const slotWidth = a1.radius + a2.radius;
      const slotLength = dist2d(a1.center, a2.center) + slotWidth;
      return { ...base, type: 'slot', slotWidth, slotLength };
    }
  }

  // ── SLOT variant: 2 arcs (any sweep) + 2 lines, oblong shape (aspect > 2:1) ──
  if (partialArcs.length >= 2 && lines.length >= 2 && fullCircles.length === 0 && entities.length <= 6) {
    const aspect = Math.max(w/h, h/w);
    if (aspect > 1.8) {
      // Check if the two largest arcs are at opposite ends
      const sorted = [...partialArcs].sort((a,b) => Math.abs(sweepAng(b)) - Math.abs(sweepAng(a)));
      const a1 = sorted[0], a2 = sorted[1];
      const rd = Math.abs(a1.radius - a2.radius) / Math.max(a1.radius, a2.radius, 1e-12);
      if (rd < 0.25 && Math.abs(sweepAng(a1)) > 1.5 && Math.abs(sweepAng(a2)) > 1.5) {
        const slotWidth = a1.radius + a2.radius;
        const slotLength = dist2d(a1.center, a2.center) + slotWidth;
        return { ...base, type: 'slot', slotWidth, slotLength };
      }
    }
  }

  // ── FILLET RECT: lines (near H/V) + small corner arcs ──
  if (lines.length >= 4 && partialArcs.length >= 2 && fullCircles.length === 0) {
    const maxDim = Math.max(w, h);
    const smallArcs = partialArcs.filter(a => a.radius < maxDim * 0.35);
    const hvLines = lines.filter(l => {
      const dx = Math.abs(l.end.x - l.start.x);
      const dy = Math.abs(l.end.y - l.start.y);
      const len = dist2d(l.start, l.end);
      return len > 0.001 && (dx / len < 0.12 || dy / len < 0.12);
    });
    if (hvLines.length >= 3 && smallArcs.length >= 2) {
      const avgCornerR = smallArcs.reduce((s, a) => s + a.radius, 0) / smallArcs.length;
      return { ...base, type: 'fillet_rect', rectWidth: w, rectHeight: h, cornerRadius: avgCornerR };
    }
  }

  // ── GENERAL POCKET WITH FILLETS: mostly lines + a few arcs (≤ 1/2 of lines) ──
  // Catches "8L+1A", "10L+1A" etc — pockets with partial fillet corners
  if (lines.length >= 3 && partialArcs.length >= 1 && partialArcs.length <= lines.length / 2 && fullCircles.length === 0) {
    const maxDim = Math.max(w, h);
    const smallArcs = partialArcs.filter(a => a.radius < maxDim * 0.5);
    if (smallArcs.length === partialArcs.length) {
      const avgCornerR = smallArcs.reduce((s, a) => s + a.radius, 0) / smallArcs.length;
      return { ...base, type: 'fillet_rect', rectWidth: w, rectHeight: h, cornerRadius: avgCornerR };
    }
  }

  // ── RECTANGLE: 4+ lines (near H/V), no arcs ──
  if (lines.length >= 4 && partialArcs.length === 0 && fullCircles.length === 0) {
    const hvLines = lines.filter(l => {
      const dx = Math.abs(l.end.x - l.start.x);
      const dy = Math.abs(l.end.y - l.start.y);
      const len = dist2d(l.start, l.end);
      return len > 0.001 && (dx / len < 0.08 || dy / len < 0.08);
    });
    if (hvLines.length >= 4) {
      return { ...base, type: 'rect', rectWidth: w, rectHeight: h };
    }
  }

  // ── KEYHOLE: 1 full circle + lines + arcs ──
  if (fullCircles.length === 1 && lines.length >= 2) {
    return { ...base, type: 'keyhole', radius: fullCircles[0].radius };
  }

  // ── POLYGON: all lines ──
  if (lines.length >= 3 && partialArcs.length === 0 && fullCircles.length === 0) {
    return { ...base, type: 'polygon' };
  }

  // ── GENERAL POLYGON: lines ≥ 3 with remaining arcs ──
  if (lines.length >= 3 && fullCircles.length === 0) {
    return { ...base, type: 'polygon' };
  }

  // ── FREEFORM ──
  return { ...base, type: 'freeform' };
}

function entityEndpoints(e) {
  if (e.type === 'line') return [e.start, e.end];
  if (e.isFullCircle) {
    // Sample 4 cardinal points for bbox
    return [
      { x: e.center.x + e.radius, y: e.center.y },
      { x: e.center.x - e.radius, y: e.center.y },
      { x: e.center.x, y: e.center.y + e.radius },
      { x: e.center.x, y: e.center.y - e.radius },
    ];
  }
  return [e.start, e.end];
}

/**
 * Profile dimension signature for clustering.
 * Profiles with similar type + dimensions = "same feature" at different depths.
 */
function profileSignature(profile) {
  if (profile.type === 'circle') return `circle|r=${profile.radius.toFixed(2)}`;
  if (profile.type === 'slot') return `slot|w=${profile.slotWidth.toFixed(2)}|l=${profile.slotLength.toFixed(2)}`;
  if (profile.type === 'rect') return `rect|w=${profile.rectWidth.toFixed(2)}|h=${profile.rectHeight.toFixed(2)}`;
  if (profile.type === 'fillet_rect') return `fillet_rect|w=${profile.rectWidth.toFixed(2)}|h=${profile.rectHeight.toFixed(2)}|r=${profile.cornerRadius.toFixed(2)}`;
  // For freeform/polygon: use entity count + area as fingerprint
  return `${profile.type}|ents=${profile.entities.length}|area=${profile.area.toFixed(1)}`;
}

/**
 * Cluster profiles from all slices into features.
 * Same profile type + dimensions + similar 2D centroid → one feature.
 */
function clusterProfilesToFeatures(profilesWithMeta, diag) {
  const posTol = diag * 0.03; // 3% of diagonal for "same position"
  const dimTol = 0.15; // 15% relative tolerance for dimensions

  // Group by signature
  const sigGroups = new Map();
  for (const pm of profilesWithMeta) {
    const sig = profileSignature(pm.profile);
    if (!sigGroups.has(sig)) sigGroups.set(sig, []);
    sigGroups.get(sig).push(pm);
  }

  const features = [];

  for (const [sig, group] of sigGroups) {
    // Sub-cluster by 2D centroid position (same feature at different offsets)
    const positionalClusters = [];
    for (const pm of group) {
      let found = false;
      for (const cluster of positionalClusters) {
        const ref = cluster[0].profile.centroid;
        const d = dist2d(ref, pm.profile.centroid);
        if (d < posTol) {
          cluster.push(pm);
          found = true;
          break;
        }
      }
      if (!found) {
        positionalClusters.push([pm]);
      }
    }

    // Each positional cluster = one feature
    for (const cluster of positionalClusters) {
      const profile = cluster[0].profile;
      const offsets = cluster.map(c => c.offset).sort((a, b) => a - b);
      const depth = offsets.length > 1 ? offsets[offsets.length - 1] - offsets[0] : 0;
      const sliceCount = cluster.length;
      const normal = cluster[0].normal;
      const centroid = profile.centroid;

      features.push(makeFeature(profile, centroid, normal, depth, sliceCount));
    }
  }

  return features;
}

function makeFeature(profile, centroid2d, normal, depth, sliceCount) {
  const params = {};
  let type, label;
  const confidence = Math.min(1, 0.5 + sliceCount * 0.1);
  const maxDim = Math.max(profile.bbox.maxX - profile.bbox.minX, profile.bbox.maxY - profile.bbox.minY);

  switch (profile.type) {
    case 'circle': {
      const d = (profile.radius || 0) * 2;
      // Reject degenerate fits (radius >> bounding box)
      if (d > maxDim * 1.5) {
        type = profile.isHole ? 'freeform_pocket' : 'freeform_boss';
        params.entities = profile.entities.length; params.depth = depth;
        label = profile.isHole ? `~ Freeform Pocket (${params.entities} ents)` : `~ Freeform Boss`;
        break;
      }
      if (profile.isHole) {
        type = 'hole'; params.diameter = d; params.depth = depth;
        label = `⊙ Hole ø${d.toFixed(2)}`;
      } else {
        type = 'boss'; params.diameter = d; params.height = depth;
        label = `∥ Boss ø${d.toFixed(2)}`;
      }
      break;
    }
    case 'slot': {
      type = 'slot';
      params.width = profile.slotWidth || 0;
      params.length = profile.slotLength || 0;
      params.depth = depth;
      label = `⊂⊃ Slot ${params.width.toFixed(1)}×${params.length.toFixed(1)}`;
      break;
    }
    case 'rect': {
      const w = profile.rectWidth || 0, h = profile.rectHeight || 0;
      if (profile.isHole) {
        type = 'rect_pocket'; params.width = w; params.height = h; params.depth = depth;
        label = `▭ Pocket ${w.toFixed(1)}×${h.toFixed(1)}`;
      } else {
        type = 'boss'; params.width = w; params.height = h;
        label = `▭ Boss ${w.toFixed(1)}×${h.toFixed(1)}`;
      }
      break;
    }
    case 'fillet_rect': {
      const w = profile.rectWidth || 0, h = profile.rectHeight || 0, r = profile.cornerRadius || 0;
      if (profile.isHole) {
        type = 'fillet_pocket'; params.width = w; params.height = h; params.cornerRadius = r; params.depth = depth;
        label = `▭ Fillet Pocket ${w.toFixed(1)}×${h.toFixed(1)} R${r.toFixed(1)}`;
      } else {
        type = 'boss'; params.width = w; params.height = h; params.cornerRadius = r;
        label = `▭ Fillet Boss ${w.toFixed(1)}×${h.toFixed(1)} R${r.toFixed(1)}`;
      }
      break;
    }
    case 'keyhole': {
      type = 'keyhole'; params.radius = profile.radius || 0; params.depth = depth;
      label = `⊙⊂ Keyhole R${(profile.radius||0).toFixed(1)}`;
      break;
    }
    case 'polygon': {
      type = profile.isHole ? 'polygon_pocket' : 'boss';
      params.sides = profile.entities.length; params.depth = depth;
      label = profile.isHole ? `△ Polygon Pocket (${params.sides} sides)` : `△ Polygon Boss`;
      break;
    }
    default: {
      type = profile.isHole ? 'freeform_pocket' : 'freeform_boss';
      params.entities = profile.entities.length; params.depth = depth;
      label = profile.isHole ? `~ Freeform Pocket (${params.entities} ents)` : `~ Freeform Boss`;
      break;
    }
  }

  return { type, label, profile, normal, depth, sliceCount, params, confidence, centroid: centroid2d };
}

/**
 * Detect revolution bodies: multiple concentric circles along same axis
 * with varying radius → 1 revolution feature instead of N holes.
 */
function detectRevolutions(features, diag) {
  // Group circular features by axis direction
  const dirGroups = new Map();
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (f.profile.type !== 'circle') continue;
    const n = f.normal;
    const nKey = `${n[0].toFixed(1)},${n[1].toFixed(1)},${n[2].toFixed(1)}`;
    if (!dirGroups.has(nKey)) dirGroups.set(nKey, []);
    dirGroups.get(nKey).push(i);
  }

  const used = new Set();
  const revolutions = [];

  for (const [nKey, indices] of dirGroups) {
    if (indices.length < 3) continue;

    // Sub-group by centroid (concentric circles at same position)
    const centroidGroups = [];
    for (const i of indices) {
      const f = features[i];
      let found = false;
      for (const g of centroidGroups) {
        const ref = features[g[0]].centroid;
        if (dist2d(ref, f.centroid) < diag * 0.05) {
          g.push(i);
          found = true;
          break;
        }
      }
      if (!found) centroidGroups.push([i]);
    }

    for (const group of centroidGroups) {
      if (group.length < 3) continue;

      const fts = group.map(i => features[i]);
      const radii = fts.map(f => (f.params.diameter || 0) / 2);
      const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
      const maxR = Math.max(...radii);
      const minR = Math.min(...radii);
      const rDev = avgR > 0 ? (maxR - minR) / avgR : 0;

      for (const i of group) used.add(i);

      const isTapered = rDev > 0.05;
      revolutions.push({
        type: 'revolution',
        label: isTapered
          ? `◎ Revolution taper ø${(minR*2).toFixed(1)}→ø${(maxR*2).toFixed(1)}`
          : `◎ Revolution ø${(avgR*2).toFixed(1)}`,
        profile: fts[0].profile,
        normal: fts[0].normal,
        depth: fts[0].depth,
        sliceCount: group.length,
        params: { minDiameter: minR*2, maxDiameter: maxR*2 },
        confidence: 0.85,
        centroid: fts[0].centroid,
        children: fts,
        count: group.length,
      });
    }
  }

  const result = [...revolutions];
  for (let i = 0; i < features.length; i++) {
    if (!used.has(i)) result.push(features[i]);
  }
  return result;
}

/**
 * Detect linear and circular patterns among same-type features.
 */
function detectPatterns(features, diag) {
  const result = [];
  const used = new Set();
  const dimTol = 0.10; // 10% dimension tolerance for "same feature"

  // Group by type + approximate dimensions
  const groups = new Map();
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    // Round params for grouping
    const paramKeys = Object.entries(f.params)
      .filter(([k]) => k !== 'depth')
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(1) : v}`)
      .join(',');
    const key = `${f.type}|${paramKeys}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }

  for (const [key, indices] of groups) {
    if (indices.length < 3) {
      // Not enough for a pattern — keep as individual features
      continue;
    }

    const fts = indices.map(i => features[i]);
    const positions = fts.map(f => f.centroid);
    const cent = {
      x: positions.reduce((s, p) => s + p.x, 0) / positions.length,
      y: positions.reduce((s, p) => s + p.y, 0) / positions.length,
    };

    // Check for circular pattern (bolt circle)
    const radii = positions.map(p => dist2d(p, cent));
    const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
    const radDev = avgR > 0 ? radii.reduce((s, r) => s + Math.abs(r - avgR), 0) / (radii.length * avgR) : 1;

    if (avgR > diag * 0.01 && radDev < 0.10 && indices.length >= 3) {
      // Circular pattern!
      for (const i of indices) used.add(i);
      result.push({
        type: 'pattern_circular',
        label: `⊙× Circular Pattern ×${indices.length} (${fts[0].label})`,
        children: fts,
        count: indices.length,
        patternRadius: avgR,
        center: cent,
      });
      continue;
    }

    // Check for linear pattern (even spacing along a line)
    // Sort by primary axis
    const sorted = [...fts].sort((a, b) => {
      const dx = a.centroid.x - b.centroid.x;
      return Math.abs(dx) > diag * 0.01 ? dx : a.centroid.y - b.centroid.y;
    });
    const spacings = [];
    for (let j = 1; j < sorted.length; j++) {
      spacings.push(dist2d(sorted[j].centroid, sorted[j-1].centroid));
    }
    if (spacings.length > 0) {
      const avgSpacing = spacings.reduce((s, v) => s + v, 0) / spacings.length;
      const spacingDev = avgSpacing > 0
        ? spacings.reduce((s, v) => s + Math.abs(v - avgSpacing), 0) / (spacings.length * avgSpacing)
        : 1;

      if (avgSpacing > diag * 0.005 && spacingDev < 0.15) {
        // Linear pattern!
        for (const i of indices) used.add(i);
        result.push({
          type: 'pattern_linear',
          label: `→× Linear Pattern ×${indices.length} (${fts[0].label})`,
          children: sorted,
          count: indices.length,
          spacing: avgSpacing,
        });
        continue;
      }
    }
  }

  // Combine: patterns + non-patterned features
  const final = [...result];
  for (let i = 0; i < features.length; i++) {
    if (!used.has(i)) final.push(features[i]);
  }
  return final;
}

/**
 * Identify the largest contour → base body extrusion.
 */
function findBaseBody(profilesWithMeta) {
  let largest = null;
  for (const pm of profilesWithMeta) {
    if (!largest || pm.profile.area > largest.profile.area) largest = pm;
  }
  if (!largest) return null;

  return {
    type: 'base_body',
    label: `█ Base Body (${largest.profile.type})`,
    profile: largest.profile,
    normal: largest.normal,
    area: largest.profile.area,
  };
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
const GR='\x1b[32m',RD='\x1b[31m',CY='\x1b[36m',YE='\x1b[33m',MG='\x1b[35m',BL='\x1b[34m';

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
  console.log(`${GR}${B}⚒️  FEATURE DECOMPOSITION: STEP → Dirs → Slice → Fit → Profile → Feature Tree${RS}`);
  console.log(`${GR}${'═'.repeat(80)}${RS}`);
  console.log(`${D}  Files: ${files.length} | Pipeline: v3(σ_θ) → arbitrary-plane slice → fit → classify → pattern${RS}\n`);

  const globalStats = {
    files: 0, totalRawEntities: 0, totalFeatures: 0,
    holes: 0, slots: 0, pockets: 0, bosses: 0,
    patterns: 0, keyholes: 0, freeform: 0,
    base: 0, freeformDiag: [],
  };

  for (const filePath of files) {
    const relName = path.relative(modelsDir, filePath);
    let loaded;
    try { loaded = await loadStep(filePath, occt); }
    catch (e) { console.log(`  ${RD}✗${RS} ${relName} — WASM error`); continue; }
    if (!loaded) { console.log(`  ${RD}✗${RS} ${relName} — load fail`); continue; }

    const { geo, faces } = loaded;
    const bb = computeBB3(faces);
    const diag = len3(sub3(bb.max, bb.min));

    // ── 1. Detect planar directions ──
    const dirs = detectPlanarDirectionsV3(faces, bb);
    const planes = generateSlicePlanes(dirs, diag);

    // ── 2. Slice + fit entities ──
    let totalLines = 0, totalArcs = 0, totalCircles = 0;
    const profilesWithMeta = []; // { profile, normal, offset, planeLabel }
    let maxContourArea = 0;

    // First pass: find max contour area
    const sliceResults = [];
    for (const plane of planes) {
      const sr = sliceMeshArbitrary(geo, plane.normal, plane.offset);
      sliceResults.push({ plane, sr });
      for (const c of sr.contours) {
        if (c.area > maxContourArea) maxContourArea = c.area;
      }
    }

    // Second pass: fit entities + classify profiles
    for (const { plane, sr } of sliceResults) {
      for (const contour of sr.contours) {
        if (contour.points.length < 6) continue;

        const { entities } = fitContour(contour.points);
        if (entities.length === 0) continue;

        const nL = entities.filter(e => e.type === 'line').length;
        const nA = entities.filter(e => e.type === 'arc' && !e.isFullCircle).length;
        const nC = entities.filter(e => e.type === 'arc' && e.isFullCircle).length;
        totalLines += nL; totalArcs += nA; totalCircles += nC;

        const profile = classifyProfile(entities, contour.area, maxContourArea);
        profilesWithMeta.push({
          profile,
          normal: plane.normal,
          offset: plane.offset,
          planeLabel: plane.label,
        });
      }
    }

    const rawTotal = totalLines + totalArcs + totalCircles;

    // ── 3. Find base body ──
    const base = findBaseBody(profilesWithMeta);

    // ── 4. Group non-base profiles into features ──
    const nonBase = base
      ? profilesWithMeta.filter(pm => pm.profile.area < base.area * 0.8)
      : profilesWithMeta;
    const rawFeatures = clusterProfilesToFeatures(nonBase, diag);

    // ── 5. Detect revolutions (collapse concentric circles → 1 feature) ──
    const withRevolutions = detectRevolutions(rawFeatures, diag);

    // ── 6. Detect patterns ──
    const allFeatures = detectPatterns(withRevolutions, diag);

    // ── Report ──
    console.log(`${B}${CY}═══ ${relName} ═══${RS}`);
    console.log(`  ${D}${faces.length} tris | diag=${diag.toFixed(1)}mm | ${dirs.length} dirs | ${planes.length} planes${RS}`);
    console.log(`  ${MG}Raw: ${totalLines}L + ${totalArcs}A + ${totalCircles}⊙ = ${rawTotal} entities${RS}`);

    // Count feature types
    let nHoles=0, nSlots=0, nPockets=0, nBosses=0, nPatterns=0, nKeyholes=0, nFreeform=0, nRevolutions=0;
    for (const f of allFeatures) {
      if (f.type === 'pattern_circular' || f.type === 'pattern_linear') nPatterns++;
      else if (f.type === 'revolution') nRevolutions++;
      else if (f.type === 'hole') nHoles++;
      else if (f.type === 'slot') nSlots++;
      else if (f.type === 'rect_pocket' || f.type === 'fillet_pocket' || f.type === 'polygon_pocket') nPockets++;
      else if (f.type === 'keyhole') nKeyholes++;
      else if (f.type === 'boss' || f.type === 'base_body') nBosses++;
      else nFreeform++;
    }

    const featureCount = allFeatures.length + (base ? 1 : 0);
    const ratio = rawTotal > 0 ? (rawTotal / featureCount).toFixed(0) : '∞';
    console.log(`  ${GR}${B}Features: ${featureCount} total (${ratio}:1 compression)${RS}`);
    if (base) console.log(`    ${BL}█ ${base.label}${RS}`);
    if (nRevolutions) console.log(`    ${CY}◎ ${nRevolutions} Revolutions${RS}`);
    if (nHoles)    console.log(`    ${YE}⊙ ${nHoles} Holes${RS}`);
    if (nSlots)    console.log(`    ${YE}⊂⊃ ${nSlots} Slots${RS}`);
    if (nPockets)  console.log(`    ${YE}▭ ${nPockets} Pockets${RS}`);
    if (nKeyholes) console.log(`    ${YE}⊙⊂ ${nKeyholes} Keyholes${RS}`);
    if (nBosses)   console.log(`    ${YE}∥ ${nBosses} Bosses${RS}`);
    if (nPatterns) console.log(`    ${MG}×${nPatterns} Patterns:${RS}`);
    for (const f of allFeatures) {
      if (f.type === 'pattern_circular' || f.type === 'pattern_linear') {
        console.log(`      ${MG}${f.label}${RS}`);
      }
      if (f.type === 'revolution') {
        console.log(`      ${CY}${f.label}${RS}`);
      }
    }
    if (nFreeform)  console.log(`    ${D}~ ${nFreeform} Freeform${RS}`);

    // Show individual features (compact)
    const nonPatternFeatures = allFeatures.filter(f => f.type !== 'pattern_circular' && f.type !== 'pattern_linear' && f.type !== 'revolution');
    if (nonPatternFeatures.length <= 20) {
      for (const f of nonPatternFeatures) {
        console.log(`    ${D}  ${f.label}${RS}`);
      }
    } else {
      // Too many to show all — show summary by type
      const byType = new Map();
      for (const f of nonPatternFeatures) {
        if (!byType.has(f.type)) byType.set(f.type, []);
        byType.get(f.type).push(f);
      }
      for (const [type, fts] of byType) {
        if (fts.length <= 3) {
          for (const f of fts) console.log(`    ${D}  ${f.label}${RS}`);
        } else {
          console.log(`    ${D}  ${fts[0].label} (+${fts.length-1} similar)${RS}`);
        }
      }
    }

    console.log();

    globalStats.files++;
    globalStats.totalRawEntities += rawTotal;
    globalStats.totalFeatures += featureCount;
    globalStats.holes += nHoles;
    globalStats.slots += nSlots;
    globalStats.pockets += nPockets;
    globalStats.bosses += nBosses + (base ? 1 : 0);
    globalStats.patterns += nPatterns;
    globalStats.revolutions = (globalStats.revolutions || 0) + nRevolutions;
    globalStats.keyholes += nKeyholes;
    globalStats.freeform += nFreeform;
    // Collect freeform diagnostics
    for (const f of allFeatures) {
      if (f.type === 'freeform_pocket' || f.type === 'freeform_boss') {
        const ents = f.profile.entities;
        const nL = ents.filter(e => e.type === 'line').length;
        const nA = ents.filter(e => e.type === 'arc' && !e.isFullCircle).length;
        const nC = ents.filter(e => e.type === 'arc' && e.isFullCircle).length;
        const bb = f.profile.bbox;
        const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
        const aspect = Math.max(w, h) / Math.max(Math.min(w, h), 1e-12);
        globalStats.freeformDiag.push({ lines: nL, arcs: nA, circles: nC, aspect, isHole: f.profile.isHole, total: ents.length });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  const ratio = globalStats.totalRawEntities > 0
    ? (globalStats.totalRawEntities / Math.max(1, globalStats.totalFeatures)).toFixed(0)
    : '∞';
  console.log(`${GR}${'═'.repeat(80)}${RS}`);
  console.log(`${B}  GLOBAL SUMMARY${RS}`);
  console.log(`  Files processed:    ${globalStats.files}`);
  console.log(`  ${MG}Raw entities:       ${globalStats.totalRawEntities}${RS}`);
  console.log(`  ${GR}${B}Features detected:  ${globalStats.totalFeatures}  (${ratio}:1 compression)${RS}`);
  console.log();
  console.log(`  ${YE}⊙  Holes:     ${globalStats.holes}${RS}`);
  console.log(`  ${CY}◎  Revolutions: ${globalStats.revolutions || 0}${RS}`);
  console.log(`  ${YE}⊂⊃ Slots:     ${globalStats.slots}${RS}`);
  console.log(`  ${YE}▭  Pockets:   ${globalStats.pockets}${RS}`);
  console.log(`  ${YE}⊙⊂ Keyholes:  ${globalStats.keyholes}${RS}`);
  console.log(`  ${YE}∥  Bosses:    ${globalStats.bosses}${RS}`);
  console.log(`  ${MG}×  Patterns:  ${globalStats.patterns}${RS}`);
  console.log(`  ${D}~  Freeform:  ${globalStats.freeform}${RS}`);

  // Freeform diagnosis: show composition histogram
  if (globalStats.freeformDiag && globalStats.freeformDiag.length > 0) {
    console.log(`\n  ${B}Freeform Diagnosis (entity composition):${RS}`);
    const compMap = new Map();
    for (const fd of globalStats.freeformDiag) {
      const key = `${fd.lines}L+${fd.arcs}A+${fd.circles}C`;
      if (!compMap.has(key)) compMap.set(key, { count: 0, aspects: [], lines: fd.lines, arcs: fd.arcs, circles: fd.circles, isHole: fd.isHole });
      compMap.get(key).count++;
      compMap.get(key).aspects.push(fd.aspect);
    }
    const sorted = [...compMap.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [key, info] of sorted.slice(0, 15)) {
      const avgAsp = info.aspects.reduce((s, v) => s + v, 0) / info.aspects.length;
      console.log(`    ${D}${key.padEnd(14)} ×${String(info.count).padStart(4)}  avgAspect=${avgAsp.toFixed(2)}  isHole=${info.isHole}${RS}`);
    }
    if (sorted.length > 15) console.log(`    ${D}... +${sorted.length - 15} more compositions${RS}`);
  }

  console.log(`${GR}${'═'.repeat(80)}${RS}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
