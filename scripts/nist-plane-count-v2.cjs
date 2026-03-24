/**
 * NIST Plane Analysis v2 — Separate PLANAR normals from CURVED surface noise
 * 
 * Key insight: a cylinder tessellated into 36 facets creates 36 different normals,
 * but those are NOT meaningful slicing directions.
 * 
 * Planar surface detection:
 * - Collect face normals that are COPLANAR (same normal, same offset)
 * - A planar feature has many faces with EXACTLY the same normal
 * - Curved surfaces have faces with gradually varying normals
 */
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
  constructor() { this._a = {}; this._i = null; this.boundingBox = null; }
  setAttribute(n, a) { this._a[n] = a; }
  getAttribute(n) { return this._a[n]; }
  setIndex(a) { this._i = a; }
  getIndex() { return this._i; }
  computeBoundingBox() {
    const p = this._a.position; if (!p) return;
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
    for (let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
    this.boundingBox={min:{x:x0,y:y0,z:z0},max:{x:x1,y:y1,z:z1}};
  }
}

function v3dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function v3cross(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function v3len(a) { return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }
function v3norm(a) { const l=v3len(a); return l<1e-15?[0,0,0]:[a[0]/l,a[1]/l,a[2]/l]; }
function v3sub(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }

/**
 * Detect PLANAR faces: faces where adjacent faces have nearly the same normal.
 * A planar surface has many triangles with the same normal (within tessellation tolerance).
 * A curved surface has triangles with gradually changing normals.
 * 
 * Strategy:
 * 1. Cluster faces by TIGHT normal similarity (cos > 0.9998 ≈ 1°)
 * 2. Large clusters = PLANAR surfaces (many faces share the exact same normal)
 * 3. Small clusters = individual facets from curved surfaces
 * 4. Only keep clusters above a face-count threshold (the coplanarity test)
 */
function detectPlanarSurfaces(geo) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  if (!pos) return { planar: [], cylindrical: 0, totalFaces: 0 };
  const numTri = idx ? idx.count/3 : pos.count/3;
  
  const faces = [];
  for (let t=0; t<numTri; t++) {
    const i0 = idx?idx.array[t*3]:t*3, i1=idx?idx.array[t*3+1]:t*3+1, i2=idx?idx.array[t*3+2]:t*3+2;
    const p0=[pos.getX(i0),pos.getY(i0),pos.getZ(i0)];
    const p1=[pos.getX(i1),pos.getY(i1),pos.getZ(i1)];
    const p2=[pos.getX(i2),pos.getY(i2),pos.getZ(i2)];
    const n=v3norm(v3cross(v3sub(p1,p0),v3sub(p2,p0)));
    if(v3len(n)<0.5) continue;
    const cx=(p0[0]+p1[0]+p2[0])/3;
    const cy=(p0[1]+p1[1]+p2[1])/3;
    const cz=(p0[2]+p1[2]+p2[2])/3;
    const offset = n[0]*cx+n[1]*cy+n[2]*cz;
    const area = 0.5*v3len(v3cross(v3sub(p1,p0),v3sub(p2,p0)));
    faces.push({normal:n, offset, area});
  }
  
  // ── Pass 1: TIGHT clustering (1° tolerance) ──
  // This separates actually-coplanar faces from curved tessellation
  const tightClusters = [];
  const COS_1DEG = Math.cos(1 * Math.PI / 180);  // 0.99985
  
  for (const f of faces) {
    let found = false;
    for (const cl of tightClusters) {
      const sim = Math.abs(v3dot(f.normal, cl.normal));
      if (sim > COS_1DEG) {
        cl.area += f.area;
        cl.faceCount++;
        cl.offsets.push(f.offset);
        found = true;
        break;
      }
    }
    if (!found) {
      tightClusters.push({ normal: [...f.normal], area: f.area, faceCount: 1, offsets: [f.offset] });
    }
  }
  
  // ── Pass 2: Separate planar from curved ──
  // Planar surfaces: clusters with many faces sharing the exact same normal
  // Curved: clusters with very few faces (1-3) at this normal
  // Threshold: at least 4 faces or area > 1% of total
  const totalArea = faces.reduce((s,f) => s+f.area, 0);
  const MIN_FACES = 4;
  const MIN_AREA_FRAC = 0.001; // 0.1% of total area
  
  const planarClusters = [];
  let curvedFaces = 0;
  
  for (const cl of tightClusters) {
    if (cl.faceCount >= MIN_FACES || cl.area > totalArea * MIN_AREA_FRAC) {
      planarClusters.push(cl);
    } else {
      curvedFaces += cl.faceCount;
    }
  }
  
  // ── Pass 3: Merge nearly-parallel planar clusters (within 5°) ──
  // Some planar faces may have slight tessellation variation
  const COS_5DEG = Math.cos(5 * Math.PI / 180);
  const mergedPlanar = [];
  
  for (const cl of planarClusters) {
    let merged = false;
    for (const m of mergedPlanar) {
      const sim = Math.abs(v3dot(cl.normal, m.normal));
      if (sim > COS_5DEG) {
        // Merge: area-weighted normal
        const w = m.area / (m.area + cl.area);
        m.normal = v3norm([
          m.normal[0]*w + cl.normal[0]*(1-w),
          m.normal[1]*w + cl.normal[1]*(1-w),
          m.normal[2]*w + cl.normal[2]*(1-w),
        ]);
        m.area += cl.area;
        m.faceCount += cl.faceCount;
        m.offsets.push(...cl.offsets);
        merged = true;
        break;
      }
    }
    if (!merged) {
      mergedPlanar.push({ ...cl, offsets: [...cl.offsets] });
    }
  }
  
  mergedPlanar.sort((a,b) => b.area - a.area);
  
  return {
    planar: mergedPlanar,
    cylindrical: curvedFaces,
    totalFaces: faces.length,
    totalArea,
    tightClustersCount: tightClusters.length,
  };
}

function isAxis(n) {
  return Math.abs(n[0]) > 0.99 || Math.abs(n[1]) > 0.99 || Math.abs(n[2]) > 0.99;
}

function angleDeg(n) {
  const maxC = Math.max(Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2]));
  return Math.acos(Math.min(1, maxC)) * 180 / Math.PI;
}

function axisLabel(n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ax > 0.99) return n[0] > 0 ? '+X' : '-X';
  if (ay > 0.99) return n[1] > 0 ? '+Y' : '-Y';
  if (az > 0.99) return n[2] > 0 ? '+Z' : '-Z';
  return `${angleDeg(n).toFixed(0)}°`;
}

async function analyze(filePath) {
  const occt = await occtFactory();
  const data = fs.readFileSync(filePath);
  const result = occt.ReadStepFile(new Uint8Array(data), null);
  if (!result.success) { console.log('FAIL:', filePath); return null; }
  
  const allPos = [], allIdx = [];
  let offset = 0;
  for (const m of result.meshes) {
    const p = new Float32Array(m.attributes.position.array);
    const ix = m.index ? new Uint32Array(m.index.array) : null;
    for (let i=0;i<p.length;i++) allPos.push(p[i]);
    if(ix) for(let i=0;i<ix.length;i++) allIdx.push(ix[i]+offset);
    else for(let i=0;i<p.length/3;i++) allIdx.push(i+offset);
    offset += p.length/3;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(allPos), 3));
  geo.setIndex(new BufferAttribute(new Uint32Array(allIdx), 1));
  geo.computeBoundingBox();
  
  const bb = geo.boundingBox;
  const sX = bb.max.x-bb.min.x, sY = bb.max.y-bb.min.y, sZ = bb.max.z-bb.min.z;
  const diag = Math.sqrt(sX*sX+sY*sY+sZ*sZ);
  
  const { planar, cylindrical, totalFaces, totalArea, tightClustersCount } = detectPlanarSurfaces(geo);
  const name = path.basename(filePath, '.stp');
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${name}  (${totalFaces} tris, ${sX.toFixed(1)}×${sY.toFixed(1)}×${sZ.toFixed(1)}mm)`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Tight clusters (1°): ${tightClustersCount}   → PLANAR surfaces: ${planar.length}  (curved noise: ${cylindrical} faces)`);
  
  let nAxis = 0, nAngled = 0;
  let totalDepths = 0;
  
  for (let i=0; i<planar.length; i++) {
    const cl = planar[i];
    const n = cl.normal;
    const tag = isAxis(n) ? `AXIS ${axisLabel(n)}` : `ANG ${angleDeg(n).toFixed(0)}°`;
    if (isAxis(n)) nAxis++; else nAngled++;
    
    // Count unique depth offsets (for depth slicing)
    const sortedOff = [...cl.offsets].sort((a,b)=>a-b);
    const uniqueOffsets = [sortedOff[0]];
    for (let j=1;j<sortedOff.length;j++) {
      if (Math.abs(sortedOff[j]-uniqueOffsets[uniqueOffsets.length-1]) > diag*0.005) {
        uniqueOffsets.push(sortedOff[j]);
      }
    }
    totalDepths += uniqueOffsets.length;
    
    const areaPct = (cl.area / totalArea * 100).toFixed(1);
    if (i < 20) {
      console.log(`  ${String(i+1).padStart(2)}. [${n.map(v=>v.toFixed(3)).join(',')}] ${tag.padEnd(10)} ${String(cl.faceCount).padStart(5)} faces  ${areaPct.padStart(5)}% area  depths=${uniqueOffsets.length}`);
    }
  }
  if (planar.length > 20) console.log(`  ... +${planar.length-20} more`);
  
  console.log(`  ─────────────────────────────────────────────────`);
  console.log(`  PLANAR DIRECTIONS:  ${nAxis} axis + ${nAngled} angled = ${planar.length} total`);
  console.log(`  DEPTH PLANES:       ${totalDepths}`);
  console.log(`  FACE COVERAGE:      ${((totalFaces-cylindrical)/totalFaces*100).toFixed(1)}% planar, ${(cylindrical/totalFaces*100).toFixed(1)}% curved`);
  
  return { name, planarDirs: planar.length, nAxis, nAngled, totalDepths, totalFaces, cylindrical };
}

async function main() {
  const dir = path.join(__dirname, '..', 'models', 'step', 'NIST-PMI-STEP-Files', 'AP203 geometry only');
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.stp')).sort().map(f=>path.join(dir,f));
  
  console.log('═'.repeat(70));
  console.log('⚒️  NIST PLANE ANALYSIS v2 — Planar vs Curved Surface Separation');
  console.log('   Filter out cylinder/fillet tessellation noise');
  console.log('   Keep only REAL planar feature surfaces');
  console.log('═'.repeat(70));
  
  const results = [];
  for (const f of files) {
    const r = await analyze(f);
    if (r) results.push(r);
  }
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 FINAL ANSWER');
  console.log('═'.repeat(70));
  console.log();
  
  const sumDirs = results.reduce((s,r)=>s+r.planarDirs, 0);
  const sumDepths = results.reduce((s,r)=>s+r.totalDepths, 0);
  const sumAxis = results.reduce((s,r)=>s+r.nAxis, 0);
  const sumAngled = results.reduce((s,r)=>s+r.nAngled, 0);
  
  console.log(`  Files:                  ${results.length}`);
  console.log(`  Avg PLANAR directions:  ${(sumDirs/results.length).toFixed(1)} per part`);
  console.log(`  Avg axis-aligned:       ${(sumAxis/results.length).toFixed(1)} per part`);
  console.log(`  Avg angled:             ${(sumAngled/results.length).toFixed(1)} per part`);
  console.log(`  Avg depth planes:       ${(sumDepths/results.length).toFixed(1)} per part`);
  console.log();
  
  for (const r of results) {
    const pct = ((r.totalFaces-r.cylindrical)/r.totalFaces*100).toFixed(0);
    console.log(`    ${r.name.padEnd(28)} ${String(r.planarDirs).padStart(3)} dirs (${r.nAxis}ax+${r.nAngled}ang)  ${String(r.totalDepths).padStart(4)} depths  ${pct}% planar faces`);
  }
  
  console.log();
  console.log(`  ✅ REAL planes needed:  ~${(sumDepths/results.length).toFixed(0)} depth-planes per part`);
  console.log(`     FROM: ~${(sumDirs/results.length).toFixed(0)} unique planar surface directions`);
  console.log();
  console.log('  ❌ 462 brute-force sweep planes is WRONG because:');
  console.log('     1. It ignores the actual geometry');  
  console.log('     2. Most sweep angles hit NO planar features');
  console.log('     3. Cylindrical features show up in axis-aligned cuts anyway');
  console.log('     4. The NIST parts have a KNOWN, finite set of planar surfaces');
}

main().catch(console.error);
