# rasgos por 0.25 s de cada video: movimiento, corte, brillo, saturación, detalle; audio: volumen, flujo, silencio
import sys,os,json,subprocess,numpy as np
FPS=4; W=144; H=256
def frames(p):
    cmd=['ffmpeg','-v','error','-i',p,'-vf',f'fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2','-f','rawvideo','-pix_fmt','rgb24','-']
    b=subprocess.run(cmd,capture_output=True).stdout
    return np.frombuffer(b,np.uint8).reshape(-1,H,W,3).astype(np.float32)/255
def audio(p):
    b=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar','16000','-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(b,np.float32)
out={}
for f in sorted(os.listdir(sys.argv[1])):
    if not f.endswith('.mp4'): continue
    vid=f[:-4]; p=os.path.join(sys.argv[1],f)
    F=frames(p); A=audio(p)
    g=F.mean(3); mx=F.max(3); mn=F.min(3); sat=(mx-mn)/(mx+1e-3)
    mov=np.r_[0,np.abs(np.diff(g,axis=0)).mean((1,2))]
    hist=np.array([np.histogram(x,16,(0,1))[0] for x in g])/(W*H)
    corte=np.r_[0,0.5*np.abs(np.diff(hist,axis=0)).sum(1)]
    gy,gx=np.gradient(g,axis=(1,2)); det=np.sqrt(gx**2+gy**2).mean((1,2))
    n=len(g); hop=16000//FPS
    rms=np.array([np.sqrt(np.mean(A[i*hop:(i+1)*hop]**2)+1e-12) for i in range(n)])
    spec=[np.abs(np.fft.rfft(A[i*hop:(i+1)*hop]*np.hanning(hop))) if len(A[i*hop:(i+1)*hop])==hop else np.zeros(hop//2+1) for i in range(n)]
    spec=np.array(spec); flux=np.r_[0,np.maximum(np.diff(spec,axis=0),0).sum(1)]
    cent=(spec*np.arange(spec.shape[1])).sum(1)/(spec.sum(1)+1e-9)*16000/hop
    out[vid]={'fps':FPS,'mov':mov.round(4).tolist(),'corte':corte.round(4).tolist(),'brillo':g.mean((1,2)).round(4).tolist(),
      'sat':sat.mean((1,2)).round(4).tolist(),'detalle':det.round(4).tolist(),'db':(20*np.log10(rms)).round(2).tolist(),
      'flujo':flux.round(3).tolist(),'centroide':cent.round(1).tolist()}
    print(vid,n/FPS,'s',flush=True)
json.dump(out,open(sys.argv[2],'w'))
