/**
 * ⚒️ La Forja — Invariants on REAL viz-data
 * ============================================
 * Loads pre-extracted contour data from viz-data/ and runs
 * the fitting algorithm + invariant checks on every contour.
 *
 * This finds the ACTUAL bugs: wrong arc sweeps, broken closure,
 * phantom full circles, etc.
 *
 * Usage: node scripts/sketch-fit-invariants-real.cjs [slug]
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// Fitting algorithm — EXACT COPY from feature-decomp-test.cjs
// (the latest tested version with radius guards etc.)
// ═══════════════════════════════════════════════════════════════

function dist(a,b){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)}
function lerp2d(a,b,t){return{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}}
function cross2d(a,b){return a.x*b.y-a.y*b.x}
function angleBetween(a,b){let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d}
function pointToSegDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-20)return dist(p,a);let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;t=Math.max(0,Math.min(1,t));return dist(p,{x:a.x+t*dx,y:a.y+t*dy})}
function lineDistToPoint(s,e,p){const dx=e.x-s.x,dy=e.y-s.y,l=Math.sqrt(dx*dx+dy*dy);if(l<1e-12)return dist(p,s);return Math.abs(dy*p.x-dx*p.y+e.x*s.y-e.y*s.x)/l}
function lineAngle(s,e){return Math.atan2(e.y-s.y,e.x-s.x)}
function lineLen(s,e){return dist(s,e)}

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
  let rSum=0;for(const p of points)rSum+=dist(p,{x:cx,y:cy});
  const radius=rSum/n;
  let maxErr=0,sumErr=0;
  for(const p of points){const err=Math.abs(dist(p,{x:cx,y:cy})-radius);maxErr=Math.max(maxErr,err);sumErr+=err}
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
  for(const p of points){const err=Math.abs(dist(p,{x:cx,y:cy})-r);maxErr=Math.max(maxErr,err);sumErr+=err}
  return{center:{x:cx,y:cy},radius:r,maxError:maxErr,avgError:sumErr/n};
}

function circleFrom3(p1,p2,p3){
  const d=2*(p1.x*(p2.y-p3.y)+p2.x*(p3.y-p1.y)+p3.x*(p1.y-p2.y));
  if(Math.abs(d)<1e-10)return null;
  const ux=((p1.x**2+p1.y**2)*(p2.y-p3.y)+(p2.x**2+p2.y**2)*(p3.y-p1.y)+(p3.x**2+p3.y**2)*(p1.y-p2.y))/d;
  const uy=((p1.x**2+p1.y**2)*(p3.x-p2.x)+(p2.x**2+p2.y**2)*(p1.x-p3.x)+(p3.x**2+p3.y**2)*(p2.x-p1.x))/d;
  return{center:{x:ux,y:uy},radius:dist({x:ux,y:uy},p1)};
}

function localCurvature(pts,i){const n=pts.length;const prev=pts[(i-1+n)%n],curr=pts[i],next=pts[(i+1)%n];
  const c=circleFrom3(prev,curr,next);if(!c||c.radius>1e6)return 0;
  const v1={x:curr.x-prev.x,y:curr.y-prev.y},v2={x:next.x-curr.x,y:next.y-curr.y};
  return(cross2d(v1,v2)>=0?1:-1)/c.radius;}

function projectOntoCircle(pt,center,r){
  const dx=pt.x-center.x,dy=pt.y-center.y,d=Math.sqrt(dx*dx+dy*dy);
  if(d<1e-15)return{x:center.x+r,y:center.y};
  return{x:center.x+(dx/d)*r,y:center.y+(dy/d)*r};}

// ═══ Exact Geometric Intersections (zero-error C0) ═══
function lineLineIntersection(p1,d1,p2,d2){const det=d1.x*d2.y-d1.y*d2.x;if(Math.abs(det)<1e-12)return null;const dx=p2.x-p1.x,dy=p2.y-p1.y;const t=(dx*d2.y-dy*d2.x)/det;return{x:p1.x+t*d1.x,y:p1.y+t*d1.y};}
function lineCircleIntersection(p,d,center,r){const ox=p.x-center.x,oy=p.y-center.y;const a=d.x*d.x+d.y*d.y;if(a<1e-20)return[];const b=2*(ox*d.x+oy*d.y);const c=ox*ox+oy*oy-r*r;const disc=b*b-4*a*c;if(disc<-1e-9)return[];const sq=Math.sqrt(Math.max(0,disc));const t1=(-b-sq)/(2*a),t2=(-b+sq)/(2*a);return[{x:p.x+t1*d.x,y:p.y+t1*d.y},{x:p.x+t2*d.x,y:p.y+t2*d.y}];}
function circleCircleIntersection(c1,r1,c2,r2){const dx=c2.x-c1.x,dy=c2.y-c1.y;const d=Math.sqrt(dx*dx+dy*dy);if(d>r1+r2+1e-9||d<Math.abs(r1-r2)-1e-9||d<1e-12)return[];const a=(r1*r1-r2*r2+d*d)/(2*d);const h2=r1*r1-a*a;const h=h2>0?Math.sqrt(h2):0;const mx=c1.x+a*dx/d,my=c1.y+a*dy/d;return[{x:mx+h*dy/d,y:my-h*dx/d},{x:mx-h*dy/d,y:my+h*dx/d}];}
function computeSharedPoint(prev,next){
  const pEnd=prev.end,nStart=next.start,mid=lerp2d(pEnd,nStart,0.5);
  if(prev.type==='line'&&next.type==='line'){const d1={x:prev.end.x-prev.start.x,y:prev.end.y-prev.start.y};const d2={x:next.end.x-next.start.x,y:next.end.y-next.start.y};const pt=lineLineIntersection(prev.start,d1,next.start,d2);if(pt&&dist(pt,mid)<dist(pEnd,nStart)*10)return pt;return mid;}
  if(prev.type==='line'&&next.type==='arc'&&!next.isFullCircle){const d={x:prev.end.x-prev.start.x,y:prev.end.y-prev.start.y};const pts=lineCircleIntersection(prev.start,d,next.center,next.radius);if(pts.length>0)return pts.reduce((best,p)=>dist(p,mid)<dist(best,mid)?p:best);return projectOntoCircle(mid,next.center,next.radius);}
  if(prev.type==='arc'&&!prev.isFullCircle&&next.type==='line'){const d={x:next.end.x-next.start.x,y:next.end.y-next.start.y};const pts=lineCircleIntersection(next.start,d,prev.center,prev.radius);if(pts.length>0)return pts.reduce((best,p)=>dist(p,mid)<dist(best,mid)?p:best);return projectOntoCircle(mid,prev.center,prev.radius);}
  if(prev.type==='arc'&&!prev.isFullCircle&&next.type==='arc'&&!next.isFullCircle){if(dist(prev.center,next.center)<1e-6&&Math.abs(prev.radius-next.radius)<1e-6)return projectOntoCircle(mid,prev.center,prev.radius);const pts=circleCircleIntersection(prev.center,prev.radius,next.center,next.radius);if(pts.length>0)return pts.reduce((best,p)=>dist(p,mid)<dist(best,mid)?p:best);const target=prev.radius>=next.radius?prev:next;return projectOntoCircle(mid,target.center,target.radius);}
  if(prev.type==='arc'&&!prev.isFullCircle)return projectOntoCircle(mid,prev.center,prev.radius);
  if(next.type==='arc'&&!next.isFullCircle)return projectOntoCircle(mid,next.center,next.radius);
  return mid;}

function computeSweep(sa,ea,ma){
  let s=ea-sa;while(s<=0)s+=2*Math.PI;
  let m=ma-sa;while(m<=0)m+=2*Math.PI;
  return m<=s?s:-(2*Math.PI-s);
}

function makeArc(c,r,sa,ea,sp,ep){return{type:'arc',center:c,radius:r,startAngle:sa,endAngle:ea,start:sp,end:ep,isFullCircle:false};}
function makeLine(s,e){return{type:'line',start:{...s},end:{...e}};}
function sweepAng(a){let s=a.endAngle-a.startAngle;while(s>2*Math.PI)s-=2*Math.PI;while(s<-2*Math.PI)s+=2*Math.PI;return s;}

// fitContour — EXACT copy from feature-decomp-test.cjs (latest with radius guards)
function fitContour(pts, tolerance) {
  if (pts.length < 3) return { entities: [], constraints: [] };
  const cleaned = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (dist(pts[i], cleaned[cleaned.length-1]) > 1e-6) cleaned.push(pts[i]);
  if (cleaned.length > 2 && dist(cleaned[0], cleaned[cleaned.length-1]) < 1e-6) cleaned.pop();
  if (cleaned.length < 3) return { entities: [], constraints: [] };

  const n = cleaned.length;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of cleaned){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}
  const diag = Math.sqrt((maxX-minX)**2+(maxY-minY)**2);
  const tol = tolerance ?? Math.max(0.001, diag*0.0001);

  // Phase 0: Full circle test — with radius < 1.5x diag guard
  const kasaFit0 = fitCircle(cleaned);
  if (kasaFit0 && kasaFit0.radius < diag * 1.5 && kasaFit0.radius > 0.001) {
    const cFit = refineCircle(cleaned, kasaFit0);
    if (cFit.radius < diag * 1.5) {
      const chordErr = cFit.radius * (1 - Math.cos(Math.PI / Math.max(6, n)));
      const circleTol = Math.min(Math.max(tol, chordErr * 2.5), diag * 0.02);
      const relErr = cFit.maxError / Math.max(cFit.radius, 1e-12);
      if (cFit.maxError < circleTol || (relErr < 0.03 && cFit.maxError < diag * 0.01)) {
        const startPtC = projectOntoCircle(cleaned[0],cFit.center,cFit.radius);
        const arc = makeArc(cFit.center,cFit.radius,0,2*Math.PI,startPtC,startPtC);
        arc.isFullCircle = true;
        return { entities: [arc], constraints: [], tol };
      }
    }
  }

  const kappa=new Float64Array(n);for(let i=0;i<n;i++)kappa[i]=localCurvature(cleaned,i);
  let maxJump=-1,openIdx=0;
  for(let i=0;i<n;i++){const j=Math.abs(kappa[i]-kappa[(i+1)%n]);if(j>maxJump){maxJump=j;openIdx=(i+1)%n;}}
  const openPts=[];for(let i=0;i<n;i++)openPts.push(cleaned[(openIdx+i)%n]);

  const entities = recursiveFit(openPts, 0, openPts.length-1, tol, 0, diag);
  let merged = mergeEntities(entities, tol);
  // No 350° promotion — only Phase 0 decides full circles
  if(merged.length>=2){const first=merged[0],last=merged[merged.length-1];if(first.type==='arc'&&last.type==='arc'){const cd=dist(first.center,last.center),rd=Math.abs(first.radius-last.radius);if(cd<tol*2&&rd<tol*2){const ac=lerp2d(first.center,last.center,0.5),ar=(first.radius+last.radius)/2,cs=sweepAng(last)+sweepAng(first);if(Math.abs(cs)>Math.PI*1.94&&merged.length===2){const circle=makeArc(ac,ar,0,2*Math.PI,last.start,last.start);circle.isFullCircle=true;merged=[circle];}else if(Math.abs(cs)>0.1){merged=[makeArc(ac,ar,last.startAngle,last.startAngle+cs,last.start,first.end),...merged.slice(1,-1)];}}}}
  // Phase 4: Exact shared endpoints via geometric intersection
  for(let i=0;i<merged.length;i++){
    const curr=merged[i],next=merged[(i+1)%merged.length];
    if(!curr||!next)continue;
    if(curr.type==='arc'&&curr.isFullCircle)continue;
    if(next.type==='arc'&&next.isFullCircle)continue;
    const gap=dist(curr.end,next.start);
    const isWrap=(i===merged.length-1);
    if(!isWrap&&gap>Math.max(tol*100,diag*0.05))continue;
    if(gap<1e-12)continue;
    const shared=computeSharedPoint(curr,next);
    setEnd(curr,shared);setStart(next,shared);
  }
  // Phase 4b: Guarantee closure
  if(merged.length>=2){
    const first=merged[0],last=merged[merged.length-1];
    const canClose=!(first.type==='arc'&&first.isFullCircle)&&!(last.type==='arc'&&last.isFullCircle);
    if(canClose){const cg=dist(last.end,first.start);if(cg>1e-12){const shared=computeSharedPoint(last,first);setEnd(last,shared);setStart(first,shared);}}
  }
  return { entities: merged, constraints: [], tol };
}

function recursiveFit(pts,start,end,tol,depth,contourDiag){
  contourDiag=contourDiag||Infinity;
  const count=end-start+1;if(count<=1)return[];
  if(count===2){if(dist(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
  const sub=[];for(let i=start;i<=end;i++)sub.push(pts[i]);
  const kf=fitCircle(sub);
  if(kf){const cf=refineCircle(sub,kf);
    if(cf.maxError<tol){const chordLen=dist(pts[start],pts[end]);
      const arcChordErr=cf.radius*(1-Math.cos(Math.PI/Math.max(6,count)));
      const closeLoopTol=Math.min(Math.max(tol,arcChordErr*2.5),contourDiag*0.02);
      const isClosed=chordLen<closeLoopTol*2;
      if(isClosed&&count>=6&&cf.radius<contourDiag*2){
        const sa0=Math.atan2(pts[start].y-cf.center.y,pts[start].x-cf.center.x);
        let swL=0,paL=sa0;
        for(let i=start+1;i<=end;i++){const a=Math.atan2(pts[i].y-cf.center.y,pts[i].x-cf.center.x);let da=a-paL;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;swL+=da;paL=a;}
        if(Math.abs(swL)>2*Math.PI)swL=Math.sign(swL)*2*Math.PI;
        const spL=projectOntoCircle(pts[start],cf.center,cf.radius),epL=projectOntoCircle(pts[end],cf.center,cf.radius);
        return[makeArc(cf.center,cf.radius,sa0,sa0+swL,spL,epL)];}
      const sa=Math.atan2(pts[start].y-cf.center.y,pts[start].x-cf.center.x);
      // Monotone angular walk — robust sweep direction
      let swAcc=0,prevA=sa;
      for(let i=start+1;i<=end;i++){const a=Math.atan2(pts[i].y-cf.center.y,pts[i].x-cf.center.x);let da=a-prevA;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;swAcc+=da;prevA=a;}
      if(swAcc>2*Math.PI)swAcc=2*Math.PI;if(swAcc<-2*Math.PI)swAcc=-2*Math.PI;
      const sw=swAcc;const swDeg=Math.abs(sw)*180/Math.PI;
      if(swDeg>5&&cf.radius<chordLen*10&&cf.radius<contourDiag*2){
        const sp=projectOntoCircle(pts[start],cf.center,cf.radius);
        const ep=projectOntoCircle(pts[end],cf.center,cf.radius);
        return[makeArc(cf.center,cf.radius,sa,sa+sw,sp,ep)];}}}
  let maxDev=0,maxDevIdx=start;
  for(let i=start+1;i<end;i++){const d=pointToSegDist(pts[i],pts[start],pts[end]);if(d>maxDev){maxDev=d;maxDevIdx=i;}}
  if(maxDev<tol){if(dist(pts[start],pts[end])<tol*0.01)return[];return[makeLine(pts[start],pts[end])];}
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
      if(prev.type==='arc'&&curr.type==='arc'){const cd=dist(prev.center,curr.center),rd=Math.abs(prev.radius-curr.radius);
        if(cd<tol*0.3&&rd<tol*0.3){const ac=lerp2d(prev.center,curr.center,0.5),ar=(prev.radius+curr.radius)/2;
          const cs=sweepAng(prev)+sweepAng(curr);
          next[next.length-1]=makeArc(ac,ar,prev.startAngle,prev.startAngle+cs,prev.start,curr.end);changed=true;continue;}}
      next.push(curr);}result=next;}return result;}

function setStart(e,pt){e.start={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.startAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.startAngle)<bd){best=c;bd=Math.abs(c-e.startAngle);}e.startAngle=best;}}
function setEnd(e,pt){e.end={...pt};if(e.type==='arc'&&!e.isFullCircle){const raw=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);let best=raw,bd=Math.abs(raw-e.endAngle);for(const c of[raw+2*Math.PI,raw-2*Math.PI])if(Math.abs(c-e.endAngle)<bd){best=c;bd=Math.abs(c-e.endAngle);}e.endAngle=best;}}

// ═══════════════════════════════════════════════════════════════
// Invariant checks
// ═══════════════════════════════════════════════════════════════

function entityLength(e) { if (e.type === 'line') return dist(e.start, e.end); if (e.isFullCircle) return 2 * Math.PI * e.radius; return e.radius * Math.abs(sweepAng(e)); }
function departureAngle(e) { if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x); const ra = Math.atan2(e.start.y - e.center.y, e.start.x - e.center.x); return sweepAng(e) >= 0 ? ra + Math.PI / 2 : ra - Math.PI / 2; }
function arrivalAngle(e) { if (e.type === 'line') return Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x); const ra = Math.atan2(e.end.y - e.center.y, e.end.x - e.center.x); return sweepAng(e) >= 0 ? ra + Math.PI / 2 : ra - Math.PI / 2; }
function pointToEntityDist(p, e) {
  if (e.type === 'line') return pointToSegDist(p, e.start, e.end);
  const dx = p.x - e.center.x, dy = p.y - e.center.y, d = Math.sqrt(dx * dx + dy * dy);
  const cd = Math.abs(d - e.radius); if (e.isFullCircle) return cd;
  const angle = Math.atan2(dy, dx), sa = e.startAngle, sw = sweepAng(e);
  let rel = angle - sa;
  if (sw >= 0) { while (rel < 0) rel += 2 * Math.PI; while (rel > 2 * Math.PI) rel -= 2 * Math.PI; if (rel <= sw + 1e-9) return cd; }
  else { while (rel > 0) rel -= 2 * Math.PI; while (rel < -2 * Math.PI) rel += 2 * Math.PI; if (rel >= sw - 1e-9) return cd; }
  return Math.min(dist(p, e.start), dist(p, e.end));
}
function shoelaceArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return a / 2; }

function checkContour(pts, entities, tol) {
  const issues = [];
  const N = entities.length;
  if (N === 0) return { issues: ['EMPTY'], pass: false };
  const single = N === 1 && entities[0].type === 'arc' && entities[0].isFullCircle;

  // ── Degenerate contour detection ──
  // Compute bounding box of original points
  let bbxmin=Infinity,bbxmax=-Infinity,bbymin=Infinity,bbymax=-Infinity;
  for(const p of pts){if(p.x<bbxmin)bbxmin=p.x;if(p.x>bbxmax)bbxmax=p.x;if(p.y<bbymin)bbymin=p.y;if(p.y>bbymax)bbymax=p.y;}
  const bbw=bbxmax-bbxmin, bbh=bbymax-bbymin;
  const bbMinDim=Math.min(bbw,bbh), bbMaxDim=Math.max(bbw,bbh);
  const bbAspect=bbMaxDim/(bbMinDim+1e-12);
  // Skip collinear contours (all points on a line)
  if(bbMinDim<tol*2) return {issues:[],pass:true,maxError:0,avgError:0,coverage:100,perimRatio:1,areaRatio:1,entityCount:N};

  // ── Use adaptive tolerance: fitting uses chord-error based tol, so we should too ──
  // For full circles the fitting tolerance is much looser than base tol
  const adaptiveTol = single ? entities[0].radius * (1 - Math.cos(Math.PI / Math.max(6, pts.length))) * 3 : tol;

  // CLOSURE (skip for single full circle)
  if (!single) { const g = dist(entities[N - 1].end, entities[0].start); if (g > adaptiveTol * 5) issues.push(`CLOSURE gap=${g.toFixed(4)}`); }
  // C0 (skip for single full circle)
  if (!single) { for (let i = 0; i < N; i++) { const g = dist(entities[i].end, entities[(i + 1) % N].start); if (g > adaptiveTol * 3) issues.push(`C0[${i}→${(i+1)%N}] gap=${g.toFixed(4)}`); } }
  // TURNING (skip for single entity)
  if (!single && N >= 2) {
    let tt = 0;
    for (let i = 0; i < N; i++) {
      if (entities[i].type === 'arc' && !entities[i].isFullCircle) tt += sweepAng(entities[i]);
      tt += angleBetween(arrivalAngle(entities[i]), departureAngle(entities[(i + 1) % N]));
    }
    const off = Math.abs(Math.abs(tt) - 2 * Math.PI);
    if (off > 0.15) issues.push(`TURNING off=${(off * 180 / Math.PI).toFixed(1)}° (total=${(tt * 180 / Math.PI).toFixed(1)}°)`);
  }
  // COVERAGE — use adaptive tolerance for threshold
  let maxErr = 0, sumErr = 0, uncov = 0;
  const covThresh = Math.max(adaptiveTol * 10, tol * 10);
  for (const p of pts) { let md = Infinity; for (const e of entities) { const d = pointToEntityDist(p, e); if (d < md) md = d; } maxErr = Math.max(maxErr, md); sumErr += md; if (md > covThresh) uncov++; }
  const cov = 100 * (1 - uncov / pts.length);
  if (cov < 85 && pts.length >= 12 && !(bbAspect > 50 && pts.length < 20)) issues.push(`COVERAGE=${cov.toFixed(0)}%`);
  // ARC VALIDITY — for full circles, use adaptive tolerance; start==end is expected
  for (let i = 0; i < N; i++) { const e = entities[i]; if (e.type !== 'arc') continue;
    if (e.isFullCircle) {
      // For full circle: check that the original points actually lie on the circle
      const ds = Math.abs(dist(e.start, e.center) - e.radius);
      if (ds > adaptiveTol * 3) issues.push(`ARC[${i}] fc_start off=${ds.toFixed(4)}`);
    } else {
      const bbDiag = Math.sqrt(bbw*bbw+bbh*bbh);
      const arcTol = Math.max(tol * 5, bbDiag * 0.001);
      const ds = Math.abs(dist(e.start, e.center) - e.radius); if (ds > arcTol) issues.push(`ARC[${i}] start off=${ds.toFixed(4)}`);
      const de = Math.abs(dist(e.end, e.center) - e.radius); if (de > arcTol) issues.push(`ARC[${i}] end off=${de.toFixed(4)}`);
    }
  }
  // FULL CIRCLE + OTHER ENTITIES — this is a REAL structural bug
  for (let i = 0; i < N; i++) { if (entities[i].type === 'arc' && entities[i].isFullCircle && N > 1) issues.push(`FULL_CIRCLE[${i}]+${N-1} others`); }
  // LARGE ARC in chain
  for (let i = 0; i < N; i++) { const e = entities[i]; if (e.type === 'arc' && !e.isFullCircle && Math.abs(sweepAng(e)) > Math.PI * 1.9 && N > 1) issues.push(`LARGE_ARC[${i}] sweep=${(sweepAng(e)*180/Math.PI).toFixed(0)}°`); }
  // PERIMETER (skip for full circles — polygon perimeter ≠ circle circumference for low-N)
  let origP = 0; for (let i = 0; i < pts.length; i++) origP += dist(pts[i], pts[(i + 1) % pts.length]);
  let entP = 0; for (const e of entities) entP += entityLength(e);
  const pr = entP / Math.max(origP, 1e-12);
  if (!single && pts.length >= 12 && (pr < 0.7 || pr > 1.3)) issues.push(`PERIM ratio=${pr.toFixed(2)}`);
  // AREA — handle full circles correctly: area = π·r²
  // Skip for degenerate contours (|area| < 1) or very few points (<10)
  const origA = shoelaceArea(pts);
  let ar = 1.0;
  if (Math.abs(origA) > 1 && pts.length >= 10 && !(bbAspect > 50 && pts.length < 20)) {
    let entA;
    if (single) {
      entA = Math.sign(origA || 1) * Math.PI * entities[0].radius ** 2;
    } else {
      let entPts = [];
      for (const e of entities) { entPts.push(e.start); if (e.type === 'arc' && !e.isFullCircle) { const sw = sweepAng(e); for (let k = 1; k < 16; k++) { const a = e.startAngle + sw * (k / 16); entPts.push({ x: e.center.x + e.radius * Math.cos(a), y: e.center.y + e.radius * Math.sin(a) }); } } }
      entA = shoelaceArea(entPts);
    }
    const ar = Math.abs(entA) / Math.max(Math.abs(origA), 1e-12);
    if (ar < 0.7 || ar > 1.3) issues.push(`AREA ratio=${ar.toFixed(2)}`);
  }

  return {
    issues,
    pass: issues.length === 0,
    maxError: maxErr,
    avgError: sumErr / pts.length,
    coverage: cov,
    perimRatio: pr,
    areaRatio: ar,
    entityCount: N,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const vizDir = path.join(__dirname, '..', 'public', 'viz-data');
const slugArg = process.argv[2];

let indexData;
try { indexData = JSON.parse(fs.readFileSync(path.join(vizDir, 'index.json'), 'utf8')); }
catch { console.error('No index.json found'); process.exit(1); }

const slugs = slugArg ? [slugArg] : indexData.map(m => m.slug);

console.log('══════════════════════════════════════════════════════════════════════');
console.log('⚒️  La Forja — REAL DATA Invariants Verifier');
console.log(`   ${slugs.length} models to check`);
console.log('══════════════════════════════════════════════════════════════════════\n');

let totalContours = 0, totalIssues = 0, totalPass = 0;
let skippedOpen = 0;
const allFailures = [];

for (const slug of slugs) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(vizDir, `${slug}.json`), 'utf8')); }
  catch { continue; }

  let modelIssues = 0, modelContours = 0;

  for (let si = 0; si < (data.slices || []).length; si++) {
    const slice = data.slices[si];
    for (let ci = 0; ci < (slice.contours || []).length; ci++) {
      const raw = slice.contours[ci];
      if (!raw.points || raw.points.length < 6) continue;
      const pts = raw.points.map(p => ({ x: p[0], y: p[1] }));

      // Check if source contour is open (first-last gap > 1% of diagonal)
      let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
      for(const p of pts){if(p.x<mnX)mnX=p.x;if(p.x>mxX)mxX=p.x;if(p.y<mnY)mnY=p.y;if(p.y>mxY)mxY=p.y;}
      const srcDiag=Math.sqrt((mxX-mnX)**2+(mxY-mnY)**2);
      const srcGap=dist(pts[0],pts[pts.length-1]);
      if(srcGap>srcDiag*0.01){skippedOpen++;continue;}

      const { entities, tol } = fitContour(pts);
      const result = checkContour(pts, entities, tol || 0.01);
      totalContours++;
      modelContours++;
      if (result.pass) { totalPass++; }
      else {
        modelIssues++;
        totalIssues++;
        allFailures.push({
          slug,
          slice: slice.label,
          contour: ci,
          pts: pts.length,
          ...result,
        });
      }
    }
  }

  const status = modelIssues === 0 ? '✅' : `🔴 ${modelIssues}`;
  console.log(`  ${status} ${slug} — ${modelContours} contours`);
}

console.log('\n══════════════════════════════════════════════════════════════════════');
console.log(`📊 RESULTS: ${totalPass}/${totalContours} closed contours pass invariants`);
console.log(`   ${totalIssues} contours with issues`);
console.log(`   ${skippedOpen} open contours skipped (not closed in source data)`);

if (allFailures.length > 0) {
  // Group by issue type
  const issueCounts = {};
  for (const f of allFailures) {
    for (const iss of f.issues) {
      const type = iss.split(/[\[( ]/)[0];
      issueCounts[type] = (issueCounts[type] || 0) + 1;
    }
  }
  console.log('\n📋 ISSUE BREAKDOWN:');
  for (const [type, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }

  // Show first 20 failures in detail
  console.log('\n🔴 FIRST 20 FAILURES:');
  for (const f of allFailures.slice(0, 20)) {
    console.log(`   ${f.slug} | ${f.slice} | contour#${f.contour} (${f.pts}pts → ${f.entityCount}e) | maxErr=${f.maxError.toFixed(4)}`);
    for (const iss of f.issues) {
      console.log(`     ⚠ ${iss}`);
    }
  }
}



console.log('══════════════════════════════════════════════════════════════════════');
