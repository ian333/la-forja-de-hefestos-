#!/usr/bin/env python3
"""
hypno-lab.py — LA MÁQUINA HIPNÓTICA. Reacción-difusión de Gray-Scott (patrones de
Turing: matemática real de morfogénesis) → reels 9:16 hermosos, infinita variedad
por 2 parámetros. Pipea frames RGB directo a NVENC (cero PNGs temporales).

  python3 scripts/hypno-lab.py --preset coral --palette oro --frames 560 --out x.mp4

Cada preset (F,k) = un régimen distinto: coral, mitosis, laberinto, ondas, burbujas.
"""
import argparse, subprocess, sys
import numpy as np

# ── regímenes Gray-Scott (F,k) que LLENAN bonito con siembra de campo (escaneados) ──
PRESETS = {
    'laberinto':(0.030, 0.058),   # mazes densos
    'coral':    (0.046, 0.061),   # coral orgánico
    'nervios':  (0.038, 0.061),   # filamentos
    'celulas':  (0.026, 0.061),   # spots / células
    'flujo':    (0.034, 0.058),   # llena, fluido
    'red':      (0.042, 0.061),   # red interconectada
}

# ── paletas: rampas de color (posición 0..1 → RGB) ──
PALETTES = {
    'oro':     [(0,(2,1,4)),(0.35,(40,14,2)),(0.6,(210,120,20)),(0.8,(255,196,70)),(1,(255,246,220))],
    'nebula':  [(0,(2,3,8)),(0.4,(6,30,70)),(0.65,(20,120,190)),(0.85,(90,210,240)),(1,(230,250,255))],
    'magma':   [(0,(2,1,6)),(0.35,(60,10,60)),(0.6,(180,30,60)),(0.8,(250,120,30)),(1,(255,240,190))],
    'violeta': [(0,(3,1,8)),(0.4,(40,10,80)),(0.65,(120,40,200)),(0.82,(200,110,255)),(1,(255,220,255))],
    'esmeralda':[(0,(1,4,4)),(0.4,(4,50,40)),(0.65,(20,160,110)),(0.85,(120,230,180)),(1,(235,255,245))],
}

def make_lut(stops, n=256):
    lut = np.zeros((n,3), np.float32); xs=[s[0] for s in stops]; cs=[s[1] for s in stops]
    for i in range(n):
        x=i/(n-1)
        for j in range(len(xs)-1):
            if xs[j]<=x<=xs[j+1]:
                t=(x-xs[j])/(xs[j+1]-xs[j]); a=np.array(cs[j]); b=np.array(cs[j+1])
                lut[i]=a+(b-a)*t; break
        else: lut[i]=cs[-1]
    return lut.astype(np.uint8)

def laplacian(a):
    # stencil 9-puntos (más suave/isotrópico), fronteras periódicas
    return (
        -a
        + 0.20*(np.roll(a,1,0)+np.roll(a,-1,0)+np.roll(a,1,1)+np.roll(a,-1,1))
        + 0.05*(np.roll(np.roll(a,1,0),1,1)+np.roll(np.roll(a,1,0),-1,1)
                +np.roll(np.roll(a,-1,0),1,1)+np.roll(np.roll(a,-1,0),-1,1))
    )

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--preset',default='coral'); ap.add_argument('--palette',default='oro')
    ap.add_argument('--w',type=int,default=540); ap.add_argument('--h',type=int,default=960)
    ap.add_argument('--frames',type=int,default=560); ap.add_argument('--substeps',type=int,default=14)
    ap.add_argument('--fps',type=int,default=30); ap.add_argument('--seed',type=int,default=7)
    ap.add_argument('--out',required=True)
    a=ap.parse_args()
    F,k=PRESETS[a.preset]; lut=make_lut(PALETTES[a.palette])
    Du,Dv=0.16,0.08
    rng=np.random.default_rng(a.seed)
    H,W=a.h,a.w
    U=np.ones((H,W),np.float32); V=np.zeros((H,W),np.float32)
    # SIEMBRA DE CAMPO: ~5% de celdas al azar → nuclea en todo lado y LLENA el cuadro
    m=rng.random((H,W))<0.05; U[m]=0.5; V[m]=0.25
    V+=0.01*rng.random((H,W)).astype(np.float32)

    OW,OH=a.w*2,a.h*2  # upscale de salida
    ff=subprocess.Popen([
        'ffmpeg','-hide_banner','-loglevel','error','-y',
        '-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(a.fps),'-i','-',
        # glow hipnótico: bloom por screen-blend de una copia difuminada + upscale suave
        # conversión rgb→yuv 8-bit con matriz bt709 EXPLÍCITA (sin tags = tono rosa)
        # format=gbrp ANTES del blend → el screen opera en RGB (en YUV rota el tono a rosa)
        '-vf',(f'scale={OW}:{OH}:flags=lanczos,format=gbrp,'
               f'split[a][b];[b]gblur=sigma=8[c];[a][c]blend=all_mode=screen,'
               f'eq=saturation=1.05:contrast=1.03,format=yuv420p'),
        # libx264: NVENC-HEVC manglea el rgb→yuv (sale rosa); libx264 sale con color correcto
        '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
        '-movflags','+faststart',a.out], stdin=subprocess.PIPE)

    vmax=0.38
    for fr in range(a.frames):
        for _ in range(a.substeps):
            uvv=U*V*V
            U+=(Du*laplacian(U)-uvv+F*(1-U))
            V+=(Dv*laplacian(V)+uvv-(F+k)*V)
            np.clip(U,0,1,out=U); np.clip(V,0,1,out=V)
        idx=np.clip((V/vmax*255),0,255).astype(np.uint8)
        frame=lut[idx]                        # (H,W,3)
        ff.stdin.write(frame.tobytes())
        if fr%80==0: print(f'  {a.preset}/{a.palette} {fr}/{a.frames}',flush=True)
    ff.stdin.close(); ff.wait()
    print(f'✓ {a.out}',flush=True)

if __name__=='__main__': main()
