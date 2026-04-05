#!/usr/bin/env python3
import json, math

d = json.load(open('public/viz-data/827-9999-905.json'))

print('=== CIRCLE FIT FROM RAW POINTS (pure Python Kasa) ===')
print(f'{"sl":>3} {"off":>8} {"c":>1} {"R":>8} {"cx":>9} {"cy":>9} {"eMax":>8} {"eRMS":>8} {"n":>3}')
print('-'*66)

def kasa_fit(pts):
    n = len(pts)
    sx=sy=sxx=syy=sxy=sxxx=syyy=sxxy=sxyy=0
    for p in pts:
        x,y = p[0],p[1]
        xx,yy,xy = x*x, y*y, x*y
        sx+=x; sy+=y; sxx+=xx; syy+=yy; sxy+=xy
        sxxx+=xx*x; syyy+=yy*y; sxxy+=xx*y; sxyy+=x*yy
    A11=sxx-sx*sx/n; A12=sxy-sx*sy/n; A22=syy-sy*sy/n
    b1=0.5*(sxxx+sxyy-sx*(sxx+syy)/n)
    b2=0.5*(syyy+sxxy-sy*(sxx+syy)/n)
    det=A11*A22-A12*A12
    if abs(det)<1e-15: return 0,0,0,999,999
    cx=(A22*b1-A12*b2)/det
    cy=(A11*b2-A12*b1)/det
    R2 = (sxx+syy)/n - 2*cx*sx/n - 2*cy*sy/n + cx*cx + cy*cy
    R = math.sqrt(max(R2,0))
    emax=erms2=0
    for p in pts:
        dd=abs(math.sqrt((p[0]-cx)**2+(p[1]-cy)**2)-R)
        if dd>emax: emax=dd
        erms2+=dd*dd
    return cx,cy,R,emax,math.sqrt(erms2/n)

for i,s in enumerate(d['slices']):
    if abs(s['normal'][2]-1.0)>0.01: continue
    for j,c in enumerate(s['contours']):
        pts = c['points']
        cx,cy,R,emax,erms = kasa_fit(pts)
        Rarea = math.sqrt(c['area']/math.pi)
        mark = ''
        if i in [0,11,21,23,24]: mark = f'  << R_area={Rarea:.4f} dR={abs(R-Rarea):.5f}'
        print(f'{i:3d} {s["offset"]:8.3f} {j:1d} {R:8.4f} {cx:9.5f} {cy:9.5f} {emax:8.5f} {erms:8.5f} {len(pts):3d}{mark}')

# Summary: R(z) profile
print('\n=== R(z) PROFILE (revolution axis = Z) ===')
print(f'{"Z":>8}  {"R_outer":>8}  {"R_inner":>8}  {"wall":>6}')
print('-'*36)
for i,s in enumerate(d['slices']):
    if abs(s['normal'][2]-1.0)>0.01: continue
    rs = []
    for c in s['contours']:
        cx,cy,R,_,_ = kasa_fit(c['points'])
        rs.append(R)
    rs.sort(reverse=True)
    Ro = rs[0] if len(rs)>0 else 0
    Ri = rs[1] if len(rs)>1 else 0
    wall = Ro - Ri
    print(f'{s["offset"]:8.3f}  {Ro:8.4f}  {Ri:8.4f}  {wall:6.4f}')
