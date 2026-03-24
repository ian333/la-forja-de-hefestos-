/**
 * Count actual unique normal directions (=planes) in each NIST model
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

function detectPlanes(geo) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  if (!pos) return [];
  const numTri = idx ? idx.count/3 : pos.count/3;
  const faces = [];
  for (let t=0;t<numTri;t++){
    const i0 = idx?idx.array[t*3]:t*3, i1=idx?idx.array[t*3+1]:t*3+1, i2=idx?idx.array[t*3+2]:t*3+2;
    const p0=[pos.getX(i0),pos.getY(i0),pos.getZ(i0)];
    const p1=[pos.getX(i1),pos.getY(i1),pos.getZ(i1)];
    const p2=[pos.getX(i2),pos.getY(i2),pos.getZ(i2)];
    const n=v3norm(v3cross(v3sub(p1,p0),v3sub(p2,p0)));
    if(v3len(n)<0.5) continue;
    const cx=(p0[0]+p1[0]+p2[0])/3, cy=(p0[1]+p1[1]+p2[1])/3, cz=(p0[2]+p1[2]+p2[2])/3;
    const offset = n[0]*cx+n[1]*cy+n[2]*cz;
    const area = 0.5*v3len(v3cross(v3sub(p1,p0),v3sub(p2,p0)));
    faces.push({normal:n, offset, area});
  }
  
  // Cluster by normal direction (tight: 5° tolerance)
  const clusters = [];
  const COS_TOL = Math.cos(5 * Math.PI / 180); // ~0.996
  for (const f of faces) {
    let found = false;
    for (const cl of clusters) {
      const sim = Math.abs(v3dot(f.normal, cl.normal));
      if (sim > COS_TOL) {
        // Area-weighted normal average
        const w = cl.area / (cl.area + f.area);
        cl.normal = v3norm([
          cl.normal[0]*w + f.normal[0]*(1-w),
          cl.normal[1]*w + f.normal[1]*(1-w),
          cl.normal[2]*w + f.normal[2]*(1-w),
        ]);
        cl.area += f.area;
        cl.faceCount++;
        cl.offsets.push(f.offset);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ normal: [...f.normal], area: f.area, faceCount: 1, offsets: [f.offset] });
    }
  }
  clusters.sort((a,b) => b.area - a.area);
  return clusters;
}

function isAxis(n) {
  return Math.abs(n[0]) > 0.99 || Math.abs(n[1]) > 0.99 || Math.abs(n[2]) > 0.99;
}

function angleDeg(n) {
  // Angle from nearest axis
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  const maxC = Math.max(ax, ay, az);
  return Math.acos(Math.min(1, maxC)) * 180 / Math.PI;
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
    const idx = m.index ? new Uint32Array(m.index.array) : null;
    for (let i=0;i<p.length;i++) allPos.push(p[i]);
    if(idx) for(let i=0;i<idx.length;i++) allIdx.push(idx[i]+offset);
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
  const triCount = allIdx.length / 3;
  
  const clusters = detectPlanes(geo);
  const name = path.basename(filePath, '.stp');
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${name}  (${triCount} tris, ${sX.toFixed(1)}×${sY.toFixed(1)}×${sZ.toFixed(1)}mm)`);
  console.log(`${'═'.repeat(70)}`);
  
  let nAxis = 0, nAngled = 0;
  let totalUniqueDepths = 0;
  
  for (let i=0; i<clusters.length; i++) {
    const cl = clusters[i];
    const n = cl.normal;
    const tag = isAxis(n) ? 'AXIS' : `ANG ${angleDeg(n).toFixed(0)}°`;
    if (isAxis(n)) nAxis++; else nAngled++;
    
    // Count unique depth offsets (features at different depths along this direction)
    const sortedOff = [...cl.offsets].sort((a,b)=>a-b);
    const uniqueOffsets = [sortedOff[0]];
    for (let j=1;j<sortedOff.length;j++) {
      if (Math.abs(sortedOff[j]-uniqueOffsets[uniqueOffsets.length-1]) > diag*0.01) {
        uniqueOffsets.push(sortedOff[j]);
      }
    }
    totalUniqueDepths += uniqueOffsets.length;
    
    if (i < 15) {
      console.log(`  ${String(i+1).padStart(2)}. [${n.map(v=>v.toFixed(3)).join(',')}] ${tag.padEnd(8)} ${String(cl.faceCount).padStart(5)} faces  area=${cl.area.toFixed(0).padStart(6)}  depths=${uniqueOffsets.length}`);
    }
  }
  if (clusters.length > 15) console.log(`  ... +${clusters.length-15} more small clusters`);
  
  console.log(`  ─────────────────────────────────────────────────`);
  console.log(`  DIRECTIONS: ${nAxis} axis + ${nAngled} angled = ${clusters.length} total`);
  console.log(`  UNIQUE DEPTH PLANES: ${totalUniqueDepths}`);
  console.log(`  (vs brute-force sweep: 450)`);
  
  return { name, clusters: clusters.length, nAxis, nAngled, totalUniqueDepths, triCount };
}

async function main() {
  const dir = path.join(__dirname, '..', 'models', 'step', 'NIST-PMI-STEP-Files', 'AP203 geometry only');
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.stp')).sort().map(f=>path.join(dir,f));
  
  console.log('═'.repeat(70));
  console.log('⚒️  NIST MODEL ANALYSIS — Real Plane Count');
  console.log('   Question: How many planes does each NIST part ACTUALLY need?');
  console.log('═'.repeat(70));
  
  const results = [];
  for (const f of files) {
    const r = await analyze(f);
    if (r) results.push(r);
  }
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));
  console.log();
  
  const sumDir = results.reduce((s,r)=>s+r.clusters, 0);
  const sumDepth = results.reduce((s,r)=>s+r.totalUniqueDepths, 0);
  const sumAxis = results.reduce((s,r)=>s+r.nAxis, 0);
  const sumAngled = results.reduce((s,r)=>s+r.nAngled, 0);
  
  console.log(`  Files:             ${results.length}`);
  console.log(`  Avg directions:    ${(sumDir/results.length).toFixed(1)} per part`);
  console.log(`  Avg depth planes:  ${(sumDepth/results.length).toFixed(1)} per part`);
  console.log(`  Avg axis:          ${(sumAxis/results.length).toFixed(1)} per part`);
  console.log(`  Avg angled:        ${(sumAngled/results.length).toFixed(1)} per part`);
  console.log();
  console.log(`  Per-file:`);
  for (const r of results) {
    console.log(`    ${r.name.padEnd(30)} ${String(r.clusters).padStart(3)} dirs  ${String(r.totalUniqueDepths).padStart(4)} depth-planes  (${r.nAxis}ax + ${r.nAngled}ang)`);
  }
  console.log();
  console.log(`  CONCLUSION: Actual planes needed ≈ ${(sumDepth/results.length).toFixed(0)} per part`);
  console.log(`              NOT 462 (brute-force sweep @ 2°×5d)`);
}

main().catch(console.error);
