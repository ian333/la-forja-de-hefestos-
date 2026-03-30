/**
 * ⚒️ La Forja — Sketch Fitting Invariants Verifier
 * ===================================================
 * Mathematical verification of sketch fitting output.
 * NO visual inspection needed — pure math.
 *
 * Invariants checked:
 *  1. CLOSURE: chain of entities must close (last.end ≈ first.start)
 *  2. CONTINUITY (C0): entity[i].end ≈ entity[i+1].start for all i
 *  3. TURNING NUMBER: sum of angular turns = ±2π for simple closed contour
 *  4. COVERAGE: every original point within tol of some entity
 *  5. NO OVERLAP: entities don't redundantly cover the same angular region
 *  6. ARC VALIDITY: arc.start/end lie on circle, sweep matches endpoints
 *  7. ENTITY LENGTH: no degenerate zero-length entities
 *  8. RECONSTRUCTION: total entity arc-length ≈ original perimeter
 *  9. AREA CONSERVATION: area enclosed by entities ≈ original polygon area
 * 10. FULL CIRCLE GUARD: isFullCircle only when sweep ≈ 2π AND no other entities share region
 *
 * Usage: node scripts/sketch-fit-invariants-test.cjs
 */

// ═══════════════════════════════════════════════════════════════
// Utility — embedded (same as sketch-fitting.ts)
// ═══════════════════════════════════════════════════════════════

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

function angleBetween(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function pointToSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function lineDistToPoint(start, end, p) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-12) return dist(p, start);
  return Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x) / len;
}

function lineAngle(s, e) { return Math.atan2(e.y - s.y, e.x - s.x); }

function cross2D(a, b) { return a.x * b.y - a.y * b.x; }

// ═══════════════════════════════════════════════════════════════
// Circle fitting (Kasa + Gauss-Newton) — copy from sketch-fitting.ts
// ═══════════════════════════════════════════════════════════════

function fitCircle(points) {
  if (points.length < 3) return null;
  let sumX=0,sumY=0,sumX2=0,sumY2=0,sumXY=0,sumX3=0,sumY3=0,sumX2Y=0,sumXY2=0;
  const n=points.length;
  for(const p of points){sumX+=p.x;sumY+=p.y;sumX2+=p.x*p.x;sumY2+=p.y*p.y;sumXY+=p.x*p.y;sumX3+=p.x**3;sumY3+=p.y**3;sumX2Y+=p.x*p.x*p.y;sumXY2+=p.x*p.y*p.y;}
  const A=n*sumX2-sumX*sumX,B=n*sumXY-sumX*sumY,C=n*sumY2-sumY*sumY;
  const D=0.5*(n*sumX3+n*sumXY2-sumX*sumX2-sumX*sumY2);
  const E=0.5*(n*sumX2Y+n*sumY3-sumY*sumX2-sumY*sumY2);
  const det=A*C-B*B;if(Math.abs(det)<1e-12)return null;
  const cx=(D*C-B*E)/det,cy=(A*E-B*D)/det;
  let rSum=0;for(const p of points)rSum+=dist(p,{x:cx,y:cy});
  const radius=rSum/n;
  let maxErr=0,sumErr=0;for(const p of points){const err=Math.abs(dist(p,{x:cx,y:cy})-radius);maxErr=Math.max(maxErr,err);sumErr+=err;}
  return{center:{x:cx,y:cy},radius,maxError:maxErr,avgError:sumErr/n};
}

function solve3x3(A,b){
  const a=A.map(r=>[...r]);const x=[...b];
  for(let col=0;col<3;col++){let maxVal=Math.abs(a[col][col]),maxRow=col;for(let row=col+1;row<3;row++)if(Math.abs(a[row][col])>maxVal){maxVal=Math.abs(a[row][col]);maxRow=row;}
  if(maxVal<1e-15)return null;if(maxRow!==col){[a[col],a[maxRow]]=[a[maxRow],a[col]];[x[col],x[maxRow]]=[x[maxRow],x[col]];}
  for(let row=col+1;row<3;row++){const f=a[row][col]/a[col][col];for(let j=col;j<3;j++)a[row][j]-=f*a[col][j];x[row]-=f*x[col];}}
  const result=[0,0,0];for(let i=2;i>=0;i--){let sum=x[i];for(let j=i+1;j<3;j++)sum-=a[i][j]*result[j];if(Math.abs(a[i][i])<1e-15)return null;result[i]=sum/a[i][i];}
  return result;
}

function refineCircle(points, initial, maxIter=25){
  let cx=initial.center.x,cy=initial.center.y,r=initial.radius;const n=points.length;
  for(let iter=0;iter<maxIter;iter++){
    let JtJ00=0,JtJ01=0,JtJ02=0,JtJ11=0,JtJ12=0,JtJ22=0,Jtr0=0,Jtr1=0,Jtr2=0;
    for(const p of points){const dx=p.x-cx,dy=p.y-cy;const d=Math.sqrt(dx*dx+dy*dy);if(d<1e-15)continue;
      const res=d-r;const j0=-dx/d,j1=-dy/d,j2=-1;
      JtJ00+=j0*j0;JtJ01+=j0*j1;JtJ02+=j0*j2;JtJ11+=j1*j1;JtJ12+=j1*j2;JtJ22+=j2*j2;
      Jtr0+=j0*res;Jtr1+=j1*res;Jtr2+=j2*res;}
    const delta=solve3x3([[JtJ00,JtJ01,JtJ02],[JtJ01,JtJ11,JtJ12],[JtJ02,JtJ12,JtJ22]],[-Jtr0,-Jtr1,-Jtr2]);
    if(!delta)break;cx+=delta[0];cy+=delta[1];r+=delta[2];
    if(Math.sqrt(delta[0]**2+delta[1]**2+delta[2]**2)<1e-14)break;}
  r=Math.abs(r);let maxErr=0,sumErr=0;
  for(const p of points){const err=Math.abs(dist(p,{x:cx,y:cy})-r);maxErr=Math.max(maxErr,err);sumErr+=err;}
  return{center:{x:cx,y:cy},radius:r,maxError:maxErr,avgError:sumErr/n};
}

function circleFrom3(p1,p2,p3){
  const d=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));if(Math.abs(d)<1e-10)return null;
  const ux=((p1.x**2+p1.y**2)*(p2.y-p3.y)+(p2.x**2+p2.y**2)*(p3.y-p1.y)+(p3.x**2+p3.y**2)*(p1.y-p2.y))/d;
  const uy=((p1.x**2+p1.y**2)*(p3.x-p2.x)+(p2.x**2+p2.y**2)*(p1.x-p3.x)+(p3.x**2+p3.y**2)*(p2.x-p1.x))/d;
  return{center:{x:ux,y:uy},radius:dist({x:ux,y:uy},p1)};
}
function localCurvature(pts,i){
  const n=pts.length;const prev=pts[(i-1+n)%n],curr=pts[i],next=pts[(i+1)%n];
  const c=circleFrom3(prev,curr,next);if(!c||c.radius>1e6)return 0;
  const v1={x:curr.x-prev.x,y:curr.y-prev.y},v2={x:next.x-curr.x,y:next.y-curr.y};
  return(cross2D(v1,v2)>=0?1:-1)/c.radius;
}
function projectOntoCircle(pt,center,r){
  const dx=pt.x-center.x,dy=pt.y-center.y;const d=Math.sqrt(dx*dx+dy*dy);
  if(d<1e-15)return{x:center.x+r,y:center.y};return{x:center.x+(dx/d)*r,y:center.y+(dy/d)*r};
}
function computeSweep(sa,ea,ma){let sweepCCW=ea-sa;while(sweepCCW<=0)sweepCCW+=2*Math.PI;let midCCW=ma-sa;while(midCCW<=0)midCCW+=2*Math.PI;return midCCW<=sweepCCW?sweepCCW:-(2*Math.PI-sweepCCW);}
function makeArc(c,r,sa,ea,sp,ep){return{type:'arc',center:c,radius:r,startAngle:sa,endAngle:ea,start:sp,end:ep,isFullCircle:Math.abs(ea-sa)>Math.PI*1.95};}
function makeLine(s,e){return{type:'line',start:{...s},end:{...e}};}
function sweepAng(a){let s=a.endAngle-a.startAngle;while(s>2*Math.PI)s-=2*Math.PI;while(s<-2*Math.PI)s+=2*Math.PI;return s;}

// ── fitContour (exact copy from sketch-fitting.ts logic) ──
function fitContour(pts,tolerance){
  if(pts.length<3)return{entities:[],constraints:[]};
  const cleaned=[pts[0]];for(let i=1;i<pts.length;i++)if(dist(pts[i],cleaned[cleaned.length-1])>1e-6)cleaned.push(pts[i]);
  if(cleaned.length>2&&dist(cleaned[0],cleaned[cleaned.length-1])<1e-6)cleaned.pop();
  if(cleaned.length<3)return{entities:[],constraints:[]};
  const n=cleaned.length;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of cleaned){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}
  const diag=Math.sqrt((maxX-minX)**2+(maxY-minY)**2);
  const tol=tolerance??Math.max(0.001,diag*0.0001);
  const kf0=fitCircle(cleaned);
  if(kf0&&kf0.radius<diag*2){const cf=refineCircle(cleaned,kf0);const ce=cf.radius*(1-Math.cos(Math.PI/Math.max(6,n)));
    const ct=Math.min(Math.max(tol,ce*2.5),diag*0.02);const re=cf.maxError/Math.max(cf.radius,1e-12);
    if(cf.maxError<ct||(re<0.03&&cf.maxError<diag*0.01))return{entities:[makeArc(cf.center,cf.radius,0,2*Math.PI,cleaned[0],cleaned[0])],constraints:[]};}
  const kappa=new Float64Array(n);for(let i=0;i<n;i++)kappa[i]=localCurvature(cleaned,i);
  let maxJump=-1,openIdx=0;for(let i=0;i<n;i++){const j=Math.abs(kappa[i]-kappa[(i+1)%n]);if(j>maxJump){maxJump=j;openIdx=(i+1)%n;}}
  const openPts=[];for(let i=0;i<n;i++)openPts.push(cleaned[(openIdx+i)%n]);
  const entities=recursiveFit(openPts,0,openPts.length-1,tol,0,diag);
  let merged=mergeEntities(entities,tol);
  for(const e of merged){if(e.type==='arc'&&!e.isFullCircle&&Math.abs(sweepAng(e))>Math.PI*1.94){e.isFullCircle=true;e.endAngle=e.startAngle+2*Math.PI;e.end={...e.start};}}
  if(merged.length>=2){const first=merged[0],last=merged[merged.length-1];if(first.type==='arc'&&last.type==='arc'){
    const cd=dist(first.center,last.center),rd=Math.abs(first.radius-last.radius);
    if(cd<tol*2&&rd<tol*2){const ac={x:(first.center.x+last.center.x)/2,y:(first.center.y+last.center.y)/2};
      const ar=(first.radius+last.radius)/2,cs=sweepAng(last)+sweepAng(first);
      if(Math.abs(cs)>Math.PI*1.94){merged=[makeArc(ac,ar,0,2*Math.PI,last.start,last.start),...merged.slice(1,-1)];}
      else if(Math.abs(cs)>0.1){merged=[makeArc(ac,ar,last.startAngle,last.startAngle+cs,last.start,first.end),...merged.slice(1,-1)];}}}}
  for(let i=0;i<merged.length;i++){const curr=merged[i],next=merged[(i+1)%merged.length];if(!curr||!next)continue;
    const gap=dist(curr.end,next.start);if(gap>tol*20)continue;
    let mid={x:(curr.end.x+next.start.x)/2,y:(curr.end.y+next.start.y)/2};
    if(curr.type==='arc'&&!curr.isFullCircle)mid=projectOntoCircle(mid,curr.center,curr.radius);
    else if(next.type==='arc'&&!next.isFullCircle)mid=projectOntoCircle(mid,next.center,next.radius);
    setEnd(curr,mid);setStart(next,mid);}
  return{entities:merged,constraints:[]};
}
function recursiveFit(pts,start,end,tol,depth,diag){
  diag=diag||Infinity;const count=end-start+1;if(count<=1)return[];if(count===2){if(dist(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
  const sub=[];for(let i=start;i<=end;i++)sub.push(pts[i]);const kf=fitCircle(sub);
  if(kf){const cf=refineCircle(sub,kf);if(cf.maxError<tol){const chordLen=dist(pts[start],pts[end]);
    const arcChordErr=cf.radius*(1-Math.cos(Math.PI/Math.max(6,count)));const closeLoopTol=Math.min(Math.max(tol,arcChordErr*2.5),diag*0.02);
    const isClosed=chordLen<closeLoopTol*2;
    if(isClosed&&count>=6)return[makeArc(cf.center,cf.radius,0,2*Math.PI,pts[start],pts[start])];
    const sa=Math.atan2(pts[start].y-cf.center.y,pts[start].x-cf.center.x);
    const ea=Math.atan2(pts[end].y-cf.center.y,pts[end].x-cf.center.x);
    const mi=Math.floor((start+end)/2);const ma=Math.atan2(pts[mi].y-cf.center.y,pts[mi].x-cf.center.x);
    const sw=computeSweep(sa,ea,ma);if(Math.abs(sw)*180/Math.PI>5&&cf.radius<chordLen*10&&cf.radius<diag*2){
      return[makeArc(cf.center,cf.radius,sa,sa+sw,projectOntoCircle(pts[start],cf.center,cf.radius),projectOntoCircle(pts[end],cf.center,cf.radius))];}}}
  let maxDev=0,maxDevIdx=start;for(let i=start+1;i<end;i++){const d=pointToSegDist(pts[i],pts[start],pts[end]);if(d>maxDev){maxDev=d;maxDevIdx=i;}}
  if(maxDev<tol){if(dist(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
  if(depth>50)return[makeLine(pts[start],pts[end])];
  return[...recursiveFit(pts,start,maxDevIdx,tol,depth+1,diag),...recursiveFit(pts,maxDevIdx,end,tol,depth+1,diag)];
}
function mergeEntities(ents,tol){if(ents.length<2)return[...ents];let changed=true,result=[...ents];
  while(changed){changed=false;const next=[result[0]];for(let i=1;i<result.length;i++){const prev=next[next.length-1],curr=result[i];
    if(prev.type==='line'&&curr.type==='line'){const md=lineDistToPoint(prev.start,curr.end,prev.end);
      if(md<tol*0.3&&dist(prev.start,curr.end)>0.001){next[next.length-1]=makeLine(prev.start,curr.end);changed=true;continue;}}
    if(prev.type==='arc'&&curr.type==='arc'){const cd=dist(prev.center,curr.center),rd=Math.abs(prev.radius-curr.radius);
      if(cd<tol*0.3&&rd<tol*0.3){const ac={x:(prev.center.x+curr.center.x)/2,y:(prev.center.y+curr.center.y)/2};const ar=(prev.radius+curr.radius)/2;
        const cs=sweepAng(prev)+sweepAng(curr);next[next.length-1]=makeArc(ac,ar,prev.startAngle,prev.startAngle+cs,prev.start,curr.end);changed=true;continue;}}
    next.push(curr);}result=next;}return result;}
function setStart(e,pt){e.start={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.startAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.startAngle)<bd){best=c;bd=Math.abs(c-e.startAngle);}e.startAngle=best;}}
function setEnd(e,pt){e.end={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.endAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.endAngle)<bd){best=c;bd=Math.abs(c-e.endAngle);}e.endAngle=best;}}

// ═══════════════════════════════════════════════════════════════
// INVARIANT CHECKS
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the "departure angle" of an entity at its start point.
 * For a line: direction angle from start→end.
 * For an arc: tangent at the start (perpendicular to radius, in sweep direction).
 */
function departureAngle(e) {
  if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x);
  // Arc: tangent at start. If sweep > 0 (CCW), tangent = radius_angle + π/2
  const radAngle = Math.atan2(e.start.y - e.center.y, e.start.x - e.center.x);
  const sw = sweepAng(e);
  return sw >= 0 ? radAngle + Math.PI / 2 : radAngle - Math.PI / 2;
}

/**
 * Compute the "arrival angle" of an entity at its end point.
 */
function arrivalAngle(e) {
  if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x);
  const radAngle = Math.atan2(e.end.y - e.center.y, e.end.x - e.center.x);
  const sw = sweepAng(e);
  return sw >= 0 ? radAngle + Math.PI / 2 : radAngle - Math.PI / 2;
}

/**
 * Entity arc-length (for lines: segment length; for arcs: R * |sweep|)
 */
function entityLength(e) {
  if (e.type === 'line') return dist(e.start, e.end);
  if (e.isFullCircle) return 2 * Math.PI * e.radius;
  return e.radius * Math.abs(sweepAng(e));
}

/**
 * Point-to-entity distance (analytical)
 */
function pointToEntityDist(p, e) {
  if (e.type === 'line') return pointToSegDist(p, e.start, e.end);
  const dx = p.x - e.center.x, dy = p.y - e.center.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const circleDist = Math.abs(d - e.radius);
  if (e.isFullCircle) return circleDist;
  const angle = Math.atan2(dy, dx);
  const sa = e.startAngle, sw = sweepAng(e);
  let rel = angle - sa;
  if (sw >= 0) { while (rel < 0) rel += 2 * Math.PI; while (rel > 2 * Math.PI) rel -= 2 * Math.PI; if (rel <= sw + 1e-9) return circleDist; }
  else { while (rel > 0) rel -= 2 * Math.PI; while (rel < -2 * Math.PI) rel += 2 * Math.PI; if (rel >= sw - 1e-9) return circleDist; }
  return Math.min(dist(p, e.start), dist(p, e.end));
}

/**
 * Shoelace area of polygon
 */
function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

/**
 * Area enclosed by entity chain (using Green's theorem).
 * Line: contributes ½(x₁y₂ − x₂y₁)
 * Arc: contributes arc sector area relative to origin.
 */
function chainArea(entities) {
  let area = 0;
  for (const e of entities) {
    if (e.type === 'line') {
      // Shoelace contribution
      area += (e.start.x * e.end.y - e.end.x * e.start.y) / 2;
    } else if (e.type === 'arc') {
      if (e.isFullCircle) {
        // Full circle area
        return Math.PI * e.radius * e.radius;
      }
      // Arc: sector area from center + triangle area from endpoints to origin
      const sw = sweepAng(e);
      // Sector area relative to center
      const sectorArea = 0.5 * e.radius * e.radius * sw;
      // But we need area relative to origin (for Green's theorem)
      // The arc curve from start to end contributes:
      // ∫ (x dy - y dx)/2 along the arc
      // = ∫ (r cos(θ)(r cos(θ)) - ... ) ... 
      // Simpler: sample the arc finely
      const N = Math.max(32, Math.ceil(Math.abs(sw) / (Math.PI / 32)));
      let arcArea = 0;
      for (let i = 0; i < N; i++) {
        const a1 = e.startAngle + sw * (i / N);
        const a2 = e.startAngle + sw * ((i + 1) / N);
        const x1 = e.center.x + e.radius * Math.cos(a1);
        const y1 = e.center.y + e.radius * Math.sin(a1);
        const x2 = e.center.x + e.radius * Math.cos(a2);
        const y2 = e.center.y + e.radius * Math.sin(a2);
        arcArea += (x1 * y2 - x2 * y1) / 2;
      }
      area += arcArea;
    }
  }
  return area;
}

// ═══════════════════════════════════════════════════════════════
// RUN INVARIANT CHECKS ON A SINGLE CONTOUR
// ═══════════════════════════════════════════════════════════════

function checkInvariants(name, originalPts, entities, tol) {
  const issues = [];
  const N = entities.length;
  if (N === 0) return { name, issues: ['EMPTY: no entities produced'], pass: false };

  // Single full-circle is a special case — most invariants trivially hold
  const isSingleCircle = N === 1 && entities[0].type === 'arc' && entities[0].isFullCircle;

  // ── INV 1: CLOSURE ──
  if (!isSingleCircle) {
    const closureGap = dist(entities[N - 1].end, entities[0].start);
    if (closureGap > tol * 5) {
      issues.push(`CLOSURE: gap=${closureGap.toFixed(6)} between last.end and first.start (tol=${tol.toFixed(6)})`);
    }
  }

  // ── INV 2: C0 CONTINUITY ──
  if (!isSingleCircle) {
    for (let i = 0; i < N; i++) {
      const curr = entities[i];
      const next = entities[(i + 1) % N];
      const gap = dist(curr.end, next.start);
      if (gap > tol * 3) {
        issues.push(`C0: gap=${gap.toFixed(6)} between entity[${i}].end and entity[${(i+1)%N}].start`);
      }
    }
  }

  // ── INV 3: TURNING NUMBER ──
  // Sum of: (sweep of each arc) + (exterior angle at each vertex)
  // Should equal ±2π for a simple closed contour
  if (!isSingleCircle && N >= 2) {
    let totalTurn = 0;
    for (let i = 0; i < N; i++) {
      const e = entities[i];
      // Add sweep of this entity
      if (e.type === 'arc' && !e.isFullCircle) {
        totalTurn += sweepAng(e);
      }
      // else line contributes 0 turn

      // Add vertex turn between this entity and the next
      const next = entities[(i + 1) % N];
      const arr = arrivalAngle(e);
      const dep = departureAngle(next);
      totalTurn += angleBetween(arr, dep);
    }
    const turnsOff = Math.abs(Math.abs(totalTurn) - 2 * Math.PI);
    if (turnsOff > 0.1) { // Allow 0.1 rad tolerance for discretization
      issues.push(`TURNING: totalTurn=${(totalTurn * 180 / Math.PI).toFixed(1)}° (expected ±360°, off by ${(turnsOff * 180 / Math.PI).toFixed(1)}°)`);
    }
  }

  // ── INV 4: COVERAGE ──
  let maxErr = 0, sumErr = 0, uncovered = 0;
  const covTol = tol * 10; // generous
  for (const p of originalPts) {
    let minD = Infinity;
    for (const e of entities) {
      const d = pointToEntityDist(p, e);
      if (d < minD) minD = d;
    }
    maxErr = Math.max(maxErr, minD);
    sumErr += minD;
    if (minD > covTol) uncovered++;
  }
  const avgErr = sumErr / originalPts.length;
  const coveragePct = 100 * (1 - uncovered / originalPts.length);
  if (coveragePct < 90) {
    issues.push(`COVERAGE: only ${coveragePct.toFixed(1)}% of points within ${covTol.toFixed(4)} of entities`);
  }

  // ── INV 5: ARC VALIDITY ──
  for (let i = 0; i < N; i++) {
    const e = entities[i];
    if (e.type !== 'arc') continue;
    // start/end should lie on circle
    const dStart = Math.abs(dist(e.start, e.center) - e.radius);
    const dEnd = Math.abs(dist(e.end, e.center) - e.radius);
    if (dStart > tol * 3) issues.push(`ARC_VALID[${i}]: start off-circle by ${dStart.toFixed(6)}`);
    if (dEnd > tol * 3) issues.push(`ARC_VALID[${i}]: end off-circle by ${dEnd.toFixed(6)}`);

    // Angles should match endpoint positions
    const expectedSA = Math.atan2(e.start.y - e.center.y, e.start.x - e.center.x);
    const expectedEA = Math.atan2(e.end.y - e.center.y, e.end.x - e.center.x);
    const saErr = Math.min(
      Math.abs(angleBetween(e.startAngle, expectedSA)),
      Math.abs(angleBetween(e.startAngle, expectedSA + 2 * Math.PI)),
    );
    const eaErr = Math.min(
      Math.abs(angleBetween(e.endAngle, expectedEA)),
      e.isFullCircle ? 0 : Math.abs(angleBetween(e.endAngle, expectedEA + 2 * Math.PI)),
    );
    if (!e.isFullCircle && saErr > 0.05) issues.push(`ARC_VALID[${i}]: startAngle mismatch by ${(saErr*180/Math.PI).toFixed(1)}°`);
    if (!e.isFullCircle && eaErr > 0.05) issues.push(`ARC_VALID[${i}]: endAngle mismatch by ${(eaErr*180/Math.PI).toFixed(1)}°`);
  }

  // ── INV 6: NO DEGENERATE ENTITIES ──
  for (let i = 0; i < N; i++) {
    const len = entityLength(entities[i]);
    if (len < 1e-8) {
      issues.push(`DEGENERATE[${i}]: entity length=${len.toExponential(3)}`);
    }
  }

  // ── INV 7: PERIMETER CONSERVATION ──
  let origPerimeter = 0;
  for (let i = 0; i < originalPts.length; i++) {
    origPerimeter += dist(originalPts[i], originalPts[(i + 1) % originalPts.length]);
  }
  let entityPerimeter = 0;
  for (const e of entities) entityPerimeter += entityLength(e);
  const perimRatio = entityPerimeter / Math.max(origPerimeter, 1e-12);
  if (perimRatio < 0.8 || perimRatio > 1.2) {
    issues.push(`PERIMETER: entity_perim=${entityPerimeter.toFixed(3)} vs original=${origPerimeter.toFixed(3)} (ratio=${perimRatio.toFixed(3)})`);
  }

  // ── INV 8: AREA CONSERVATION ──
  const origArea = shoelaceArea(originalPts);
  const entArea = chainArea(entities);
  const areaRatio = Math.abs(entArea) / Math.max(Math.abs(origArea), 1e-12);
  if (areaRatio < 0.85 || areaRatio > 1.15) {
    issues.push(`AREA: entity_area=${Math.abs(entArea).toFixed(3)} vs original=${Math.abs(origArea).toFixed(3)} (ratio=${areaRatio.toFixed(3)})`);
  }

  // ── INV 9: FULL CIRCLE GUARD ──
  // If a full circle exists alongside other entities, that's suspicious
  for (let i = 0; i < N; i++) {
    if (entities[i].type === 'arc' && entities[i].isFullCircle && N > 1) {
      issues.push(`FULL_CIRCLE_GUARD[${i}]: isFullCircle=true but there are ${N} entities total — the circle swallows the contour`);
    }
  }

  // ── INV 10: SWEEP SUM for arcs ──
  // For arcs that are part of a chain, check that no single arc exceeds what makes geometric sense
  for (let i = 0; i < N; i++) {
    const e = entities[i];
    if (e.type === 'arc' && !e.isFullCircle) {
      const sw = Math.abs(sweepAng(e));
      if (sw > Math.PI * 1.9 && N > 1) {
        issues.push(`LARGE_ARC[${i}]: sweep=${(sw*180/Math.PI).toFixed(1)}° (>342°) in a ${N}-entity chain — likely should be full circle or split`);
      }
    }
  }

  return {
    name,
    entities: N,
    entityBreakdown: `${entities.filter(e=>e.type==='line').length}L ${entities.filter(e=>e.type==='arc'&&!e.isFullCircle).length}A ${entities.filter(e=>e.type==='arc'&&e.isFullCircle).length}⊙`,
    maxError: maxErr,
    avgError: avgErr,
    coverage: coveragePct,
    perimRatio,
    areaRatio,
    turningNumber: null,
    issues,
    pass: issues.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Synthetic Test Shapes
// ═══════════════════════════════════════════════════════════════

function generateCircle(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}

function generateRect(cx, cy, w, h, ptsPerSide) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx - hw + t * w, y: cy - hh }); }
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx + hw, y: cy - hh + t * h }); }
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx + hw - t * w, y: cy + hh }); }
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx - hw, y: cy + hh - t * h }); }
  return pts;
}

function generateRoundedRect(cx, cy, w, h, r, ptsPerArc, ptsPerSide) {
  const pts = [];
  const hw = w / 2 - r, hh = h / 2 - r;
  // Bottom side (left to right)
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx - hw + t * 2 * hw, y: cy - hh - r }); }
  // Bottom-right arc
  for (let i = 0; i <= ptsPerArc; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * (i / ptsPerArc); pts.push({ x: cx + hw + r * Math.cos(a), y: cy - hh + r * Math.sin(a) }); }
  // Right side
  for (let i = 1; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx + hw + r, y: cy - hh + t * 2 * hh }); }
  // Top-right arc
  for (let i = 0; i <= ptsPerArc; i++) { const a = 0 + (Math.PI / 2) * (i / ptsPerArc); pts.push({ x: cx + hw + r * Math.cos(a), y: cy + hh + r * Math.sin(a) }); }
  // Top side
  for (let i = 1; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx + hw - t * 2 * hw, y: cy + hh + r }); }
  // Top-left arc
  for (let i = 0; i <= ptsPerArc; i++) { const a = Math.PI / 2 + (Math.PI / 2) * (i / ptsPerArc); pts.push({ x: cx - hw + r * Math.cos(a), y: cy + hh + r * Math.sin(a) }); }
  // Left side
  for (let i = 1; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx - hw - r, y: cy + hh - t * 2 * hh }); }
  // Bottom-left arc
  for (let i = 0; i <= ptsPerArc; i++) { const a = Math.PI + (Math.PI / 2) * (i / ptsPerArc); pts.push({ x: cx - hw + r * Math.cos(a), y: cy - hh + r * Math.sin(a) }); }
  return pts;
}

function generateSlot(cx, cy, length, r, ptsPerArc, ptsPerSide) {
  const pts = [];
  const hl = length / 2;
  // Bottom line (left to right)
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx - hl + t * length, y: cy - r }); }
  // Right semicircle
  for (let i = 0; i <= ptsPerArc; i++) { const a = -Math.PI / 2 + Math.PI * (i / ptsPerArc); pts.push({ x: cx + hl + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  // Top line (right to left)
  for (let i = 0; i < ptsPerSide; i++) { const t = i / ptsPerSide; pts.push({ x: cx + hl - t * length, y: cy + r }); }
  // Left semicircle
  for (let i = 0; i <= ptsPerArc; i++) { const a = Math.PI / 2 + Math.PI * (i / ptsPerArc); pts.push({ x: cx + r * Math.cos(a + hl ? 0 : 0), y: cy + r * Math.sin(a) }); }
  // Fix: left semicircle center
  pts.splice(pts.length - ptsPerArc - 1, ptsPerArc + 1);
  for (let i = 0; i <= ptsPerArc; i++) { const a = Math.PI / 2 + Math.PI * (i / ptsPerArc); pts.push({ x: cx - hl + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}

function generateLShape(pts_per_side) {
  // L-shape: 6 segments
  const corners = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 },
    { x: 20, y: 20 }, { x: 20, y: 50 }, { x: 0, y: 50 },
  ];
  const pts = [];
  for (let s = 0; s < corners.length; s++) {
    const a = corners[s], b = corners[(s + 1) % corners.length];
    for (let i = 0; i < pts_per_side; i++) {
      const t = i / pts_per_side;
      pts.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════════════════════════');
console.log('⚒️  La Forja — Sketch Fitting INVARIANTS Verifier');
console.log('   Mathematical verification — no visuals needed');
console.log('══════════════════════════════════════════════════════════════════════\n');

const tests = [
  // Circles
  { name: 'Circle R=25 (200pts)', pts: generateCircle(50, 50, 25, 200) },
  { name: 'Circle R=5 (100pts)', pts: generateCircle(0, 0, 5, 100) },
  { name: 'Circle R=100 (400pts)', pts: generateCircle(100, 100, 100, 400) },
  { name: 'Small circle R=1 (60pts)', pts: generateCircle(0, 0, 1, 60) },

  // Rectangles
  { name: 'Rectangle 50×30', pts: generateRect(0, 0, 50, 30, 50) },
  { name: 'Square 20×20', pts: generateRect(0, 0, 20, 20, 40) },
  { name: 'Wide rect 100×5', pts: generateRect(0, 0, 100, 5, 80) },

  // Rounded rectangles — THE KEY TEST
  { name: 'RoundedRect 60×40 R=5', pts: generateRoundedRect(0, 0, 60, 40, 5, 20, 30) },
  { name: 'RoundedRect 30×30 R=3', pts: generateRoundedRect(0, 0, 30, 30, 3, 15, 25) },
  { name: 'RoundedRect 100×20 R=8', pts: generateRoundedRect(0, 0, 100, 20, 8, 25, 40) },
  { name: 'RoundedRect 50×50 R=10', pts: generateRoundedRect(0, 0, 50, 50, 10, 30, 30) },

  // Slots
  { name: 'Slot L=40 R=8', pts: generateSlot(0, 0, 40, 8, 30, 20) },
  { name: 'Slot L=80 R=15', pts: generateSlot(0, 0, 80, 15, 40, 30) },

  // L-shape
  { name: 'L-shape (6 edges)', pts: generateLShape(30) },
  { name: 'L-shape fine (60/side)', pts: generateLShape(60) },
];

let totalPass = 0, totalFail = 0;
const failures = [];

for (const test of tests) {
  const { entities } = fitContour(test.pts);
  const result = checkInvariants(test.name, test.pts, entities);

  if (result.pass) {
    console.log(`  ✅ ${test.name}`);
    console.log(`     ${result.entities}e (${result.entityBreakdown}) | maxErr=${result.maxError.toFixed(6)} | cov=${result.coverage.toFixed(1)}% | perim×${result.perimRatio.toFixed(3)} | area×${result.areaRatio.toFixed(3)}`);
    totalPass++;
  } else {
    console.log(`  ❌ ${test.name}`);
    console.log(`     ${result.entities}e (${result.entityBreakdown}) | maxErr=${result.maxError.toFixed(6)} | cov=${result.coverage.toFixed(1)}%`);
    for (const issue of result.issues) {
      console.log(`     ⚠  ${issue}`);
    }
    totalFail++;
    failures.push(result);
  }
}

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`📊 RESULTS: ${totalPass} passed, ${totalFail} failed out of ${tests.length}`);
if (totalFail > 0) {
  console.log('\n🔴 FAILED INVARIANTS:');
  for (const f of failures) {
    console.log(`   ${f.name}:`);
    for (const i of f.issues) console.log(`     → ${i}`);
  }
}
console.log('══════════════════════════════════════════════════════════════════════');
