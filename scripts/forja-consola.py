#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FORJA — Consola de la impresora de metal (RP2350).
Lee el serial /tmp/ttyV0, parsea la telemetria y sirve un dashboard web HERMOSO
con lecturas en vivo (Vcap, I, R, P, f, duty, modo, boost), grafica y botones de
control. El operador la ve en el navegador; el agente lee /api/data y manda
comandos por /api/cmd. UN solo lector del pty (mata el `cat` antes).

Uso:   python3 scripts/forja-consola.py        (sirve en :8000)
Estado para el agente:  /tmp/forja_state.json   y  GET /api/data
Comando:                POST /api/cmd?c=g        (o curl)
"""
import os, re, json, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PTY = '/tmp/ttyV0'
PORT = 8000
STATE_FILE = '/tmp/forja_state.json'

state = {'mode':'?', 'vcap':0.0, 'ion':0.0, 'r':0.0, 'p':0.0, 'dv':0.0,
         'f':0, 'duty':0.0, 'boost':0, 'f2':0, 'dual':False, 'ts':0.0, 'alt':''}
hist = []          # {t, vcap, p, r}
raw  = []          # ultimas lineas crudas
lock = threading.Lock()
fd = None
t0 = time.time()

RX = {
 'mode'  : re.compile(r'\[(\w+)\]'),
 'vcap'  : re.compile(r'Vcap=([0-9.]+)V'),
 'vcb'   : re.compile(r'Vc ([0-9.]+)->'),               # ráfaga: Vc antes->despues
 'ion'   : re.compile(r'Ion=([0-9.]+)A'),
 'i'     : re.compile(r'\bI=([0-9.]+)A'),
 'r'     : re.compile(r'R=([0-9.]+)ohm'),
 'p'     : re.compile(r'P=(-?[0-9.]+)W'),
 'dv'    : re.compile(r'dV=(-?[0-9.]+)'),
 'f1'    : re.compile(r'f1=([0-9]+)Hz'),
 'fb'    : re.compile(r'\bf= *([0-9]+)Hz'),
 'duty'  : re.compile(r'duty=([0-9.]+)'),
 'boost' : re.compile(r'boost=\w+\s*\(([0-9]+)%\)'),
 'f2'    : re.compile(r'f2=([0-9]+)Hz'),
 'dual'  : re.compile(r'f2=[0-9]+Hz\[(on|ON)\]|2 ONDAS'),
 'alt'   : re.compile(r'ALTURA:.*\|\s*(.+)$'),
 # --- boost3 (v2 bring-up) ---
 'vbus'  : re.compile(r'Vbus=\s*([0-9.]+)\s*V'),
 'dutyp' : re.compile(r'duty=\s*([0-9.]+)%'),
 'ipk'   : re.compile(r'Ipk~\s*([0-9.]+)\s*A'),
 'icarga': re.compile(r'Icarga=\s*([0-9.]+)\s*A'),
 'fases' : re.compile(r'fases=\[?([123-]{1,3})'),
 'tgt'   : re.compile(r'tgt\s*([0-9.]+)'),
 # --- descarga (gota) ---
 'gband' : re.compile(r'(?:gota|banda)\s*([0-9]+)-([0-9]+)\s*A'),
 'gdur'  : re.compile(r'dur gota\s*(\d+)\s*ms|GOTA:\s*(\d+)\s*ms'),
 'gconm' : re.compile(r'GOTA:.*?(\d+)\s*conmutaciones'),
}

def handle(line):
    with lock:
        s = state
        m = RX['mode'].search(line)
        if m: s['mode'] = m.group(1)
        if 'CONTINUO' in line: s['mode'] = 'CONT'
        elif line.lstrip().startswith('f=') and 'Vc ' in line: s['mode'] = 'FREQ'
        elif 'ALTURA' in line: s['mode'] = 'PROBE'
        elif line.startswith('PULSO'): s['mode'] = 'PULSO'
        def g(k, cast=float):
            m = RX[k].search(line)
            return cast(m.group(1)) if m else None
        v = g('vcap');           v = v if v is not None else g('vcb')
        v = v if v is not None else g('vbus')          # boost3: Vbus
        if v is not None: s['vcap'] = v
        ion = g('ion');          ion = ion if ion is not None else g('i')
        ion = ion if ion is not None else g('ipk')     # boost3: Ipk del shunt
        if ion is not None: s['ion'] = ion
        for k in ('r','p','dv','duty'):
            val = g(k);  s[k] = val if val is not None else s[k]
        # boost3: duty viene en % -> alimenta 'boost' (%) y 'duty' (fracción)
        dp = g('dutyp')
        if dp is not None: s['boost'] = int(round(dp)); s['duty'] = round(dp/100.0, 3)
        ic = g('icarga')
        if ic is not None: s['p'] = round(s['vcap']*ic, 1)   # P de carga = Vbus*Icarga
        mf = RX['fases'].search(line)
        if mf: s['alt'] = 'fases '+mf.group(1)
        mt = RX['tgt'].search(line)
        if mt: s['tgt'] = float(mt.group(1))
        mgb = RX['gband'].search(line)
        if mgb: s['glo'] = int(mgb.group(1)); s['ghi'] = int(mgb.group(2))
        mgd = RX['gdur'].search(line)
        if mgd: s['gdur'] = int(mgd.group(1) or mgd.group(2))
        mgc = RX['gconm'].search(line)
        if mgc: s['gconm'] = int(mgc.group(1)); s['glast'] = round(time.time()-t0, 1)
        if line.startswith('['): s['auto'] = ('+AUTO' in line)
        f = g('f1', int); f = f if f is not None else g('fb', int)
        if f is not None: s['f'] = f
        b = g('boost', int);  s['boost'] = b if b is not None else s['boost']
        f2 = g('f2', int);    s['f2'] = f2 if f2 is not None else s['f2']
        s['dual'] = bool(RX['dual'].search(line))
        ma = RX['alt'].search(line)
        if ma: s['alt'] = ma.group(1).strip()
        s['ts'] = round(time.time()-t0, 2)
        # historia (solo lineas con dato util)
        if ('Vcap=' in line) or ('Vc ' in line) or ('P=' in line) or ('Vbus=' in line):
            hist.append({'t': s['ts'], 'vcap': s['vcap'], 'p': s['p'], 'r': s['r']})
            if len(hist) > 600: del hist[:len(hist)-600]
        raw.append(line)
        if len(raw) > 60: del raw[:len(raw)-60]

def reader():
    global fd
    os.system(f'stty -F {PTY} 115200 raw -echo 2>/dev/null')
    while fd is None:
        try: fd = os.open(PTY, os.O_RDWR | os.O_NOCTTY)
        except Exception: time.sleep(0.5)
    buf = b''
    while True:
        try:
            data = os.read(fd, 4096)
            if not data: time.sleep(0.03); continue
            buf += data
            while b'\n' in buf:
                ln, buf = buf.split(b'\n', 1)
                t = ln.decode('utf-8','replace').strip()
                if t: handle(t)
        except Exception:
            time.sleep(0.1)

def state_writer():
    while True:
        try:
            with lock:
                json.dump({'state':state, 'hist':hist[-1:]}, open(STATE_FILE,'w'))
        except Exception: pass
        time.sleep(0.3)

def send(c):
    # abre un fd FRESCO para escribir (como printf > pty); el os.write sobre el
    # fd compartido de lectura no transmitia al pty.
    try:
        w = os.open(PTY, os.O_WRONLY | os.O_NOCTTY)
        os.write(w, c.encode()); os.close(w)
        return True
    except Exception:
        return False

PAGE = r"""<!DOCTYPE html><html lang=es><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>🔥 FORJA — Consola</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(ellipse at 50% 0%,#10182a 0%,#070a12 70%);color:#cbd5e1;
 font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;min-height:100vh;padding:18px}
h1{font-size:15px;letter-spacing:.18em;color:#fb923c;text-transform:uppercase;
 text-shadow:0 0 18px rgba(251,146,60,.5);font-weight:700}
.sub{font-size:11px;color:#64748b;margin-top:2px}
.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.badge{font-size:13px;font-weight:700;padding:6px 16px;border-radius:999px;border:1px solid #1e293b;
 background:#0e1726;letter-spacing:.1em}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.card{background:linear-gradient(160deg,#131c2e,#0c1320);border:1px solid #1e293b;border-radius:14px;
 padding:14px 16px;position:relative;overflow:hidden}
.card .lab{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.12em}
.card .val{font-size:34px;font-weight:700;margin-top:4px;line-height:1}
.card .u{font-size:14px;color:#64748b;margin-left:4px}
.card.glow::after{content:'';position:absolute;inset:0;border-radius:14px;pointer-events:none}
.v .val{color:#fbbf24;text-shadow:0 0 16px rgba(251,191,36,.45)}
.i .val{color:#38bdf8;text-shadow:0 0 16px rgba(56,189,248,.4)}
.r .val{color:#a78bfa;text-shadow:0 0 16px rgba(167,139,250,.4)}
.p .val{color:#4ade80;text-shadow:0 0 18px rgba(74,222,128,.5)}
.panel{background:#0c1320;border:1px solid #1e293b;border-radius:14px;padding:14px;margin-bottom:14px}
.panel h2{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px}
canvas{width:100%;height:180px;display:block}
.ctl{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:center}
.ctl .gl{font-size:10px;color:#64748b;width:74px;text-transform:uppercase;letter-spacing:.1em}
button{font-family:inherit;font-size:12px;font-weight:600;color:#e2e8f0;background:#16223a;
 border:1px solid #29384f;border-radius:9px;padding:9px 13px;cursor:pointer;transition:.12s}
button:hover{background:#1e2d49;border-color:#3b82f6;transform:translateY(-1px)}
button:active{transform:translateY(0)}
button.go{background:#15321f;border-color:#22c55e44;color:#86efac}
button.go:hover{background:#1b4429;border-color:#22c55e}
button.warn{background:#3a1f12;border-color:#fb923c44;color:#fdba74}
button.warn:hover{background:#4a2716;border-color:#fb923c}
button.stop{background:#3a1414;border-color:#f8717144;color:#fca5a5}
button.stop:hover{background:#4a1a1a;border-color:#f87171}
.big{padding:11px 16px;font-size:13px}
.logbox{background:#070b12;border:1px solid #1e293b;border-radius:12px;padding:10px;height:200px;
 overflow-y:auto;font-size:11px;line-height:1.5;color:#7d8aa0}
.logbox div{white-space:pre-wrap;word-break:break-all}
.flash{animation:fl .25s}@keyframes fl{0%{background:#fb923c33}100%{}}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
</style></head><body>
<div class=bar><div><h1>🔥 La Forja — Consola de Metal</h1>
<div class=sub>RP2350 · control por frecuencia · <span id=ts>—</span>s</div></div>
<div class=badge id=mode>—</div></div>

<div class=grid>
 <div class="card v glow"><div class=lab>V capacitor</div><div class=val><span id=vcap>0</span><span class=u>V</span></div></div>
 <div class="card i glow"><div class=lab>Corriente</div><div class=val><span id=ion>0</span><span class=u>A</span></div></div>
 <div class="card r glow"><div class=lab>R junta</div><div class=val><span id=r>0</span><span class=u>Ω</span></div></div>
 <div class="card p glow"><div class=lab>Potencia</div><div class=val><span id=p>0</span><span class=u>W</span></div></div>
</div>

<div class=grid style="grid-template-columns:repeat(4,1fr)">
 <div class=card><div class=lab>Target</div><div class=val style="font-size:24px"><span id=tgt>—</span><span class=u>V</span></div></div>
 <div class=card><div class=lab>Duty</div><div class=val style="font-size:24px"><span id=duty>0</span></div></div>
 <div class=card><div class=lab>Boost</div><div class=val style="font-size:24px"><span id=boost>0</span><span class=u>%</span></div></div>
 <div class=card><div class=lab>Fases activas</div><div class=val style="font-size:24px"><span id=fasesdisp>—</span></div></div>
</div>

<div class=panel><h2>Potencia (verde) · Vcap (ámbar) — últimos ~40s</h2><canvas id=chart></canvas></div>

<div class=panel><h2>Control — Boost v2 (anti-overshoot)</h2>
 <div class=ctl><span class=gl>Energía</span>
  <button class="go big" onclick="cmd('g')">⚡ Cargar (g)</button>
  <button class="warn" onclick="cmd('o')">Boost OFF (o)</button>
  <button class="stop big" onclick="cmd('s')">■ STOP (s)</button></div>
 <div class=ctl><span class=gl>Voltaje obj.</span>
  <button class=big onclick="cmd('t')">− 10 V</button>
  <span id=tgtbig style="font-size:22px;font-weight:700;color:#fbbf24;min-width:84px;text-align:center;text-shadow:0 0 14px rgba(251,191,36,.4)">— V</span>
  <button class="warn big" onclick="cmd('T')">+ 10 V</button></div>
 <div class=ctl><span class=gl>Fases</span>
  <button id=fb1 class=big onclick="cmd('1')">Fase 1</button>
  <button id=fb2 class=big onclick="cmd('2')">Fase 2</button>
  <button id=fb3 class=big onclick="cmd('3')">Fase 3</button>
  <span style="font-size:10px;color:#64748b;margin-left:6px">verde = activa</span></div>
 <div class=ctl><span class=gl>Duty máx</span>
  <button onclick="cmd('d')">−− duty</button><button onclick="cmd('D')">duty ++</button>
  <button onclick="cmd('r')">📊 Reporte (r)</button></div>
</div>

<div class=panel style="border-color:#7c2d12"><h2 style="color:#fb923c">Control — DESCARGA (la gota) 🔥</h2>
 <div class=ctl><span class=gl>Disparar</span>
  <button class="go big" onclick="cmd('p')">💧 GOTA (p)</button>
  <button id=autob class="warn big" onclick="cmd('P')">Auto-gotas (P)</button>
  <span id=gotainfo style="font-size:12px;color:#86efac;margin-left:8px">—</span></div>
 <div class=ctl><span class=gl>Banda corr.</span>
  <button class=big onclick="cmd('b')">− 2A</button>
  <span id=gband style="font-size:20px;font-weight:700;color:#38bdf8;min-width:96px;text-align:center;text-shadow:0 0 12px rgba(56,189,248,.4)">— A</span>
  <button class="big" onclick="cmd('B')">+ 2A</button>
  <span style="font-size:10px;color:#64748b;margin-left:6px">= vibración / corriente del melt</span></div>
 <div class=ctl><span class=gl>Duración</span>
  <button onclick="cmd('u')">− 1ms</button>
  <span id=gdur style="font-size:18px;font-weight:700;color:#a78bfa;min-width:70px;text-align:center">— ms</span>
  <button onclick="cmd('U')">+ 1ms</button>
  <span style="font-size:10px;color:#64748b;margin-left:6px">energía por gota</span></div>
 <div class=ctl><span class=gl>Calibrar</span>
  <button onclick="cmd('v')">Vbus −</button><button onclick="cmd('V')">Vbus +</button>
  <button onclick="cmd('j')">Ishunt −</button><button onclick="cmd('J')">Ishunt +</button>
  <span style="font-size:10px;color:#64748b;margin-left:6px">ajusta hasta = tu multímetro</span></div>
</div>

<div class=panel id=gotapanel style="transition:box-shadow .15s"><h2 style="color:#fb923c">Última gota 🔥</h2>
 <div style="font-size:26px;font-weight:700;color:#fb923c;text-align:center" id=gotabig>— sin gota aún —</div></div>

<div class=panel><h2>Serial (en vivo)</h2><div class=logbox id=log></div></div>

<script>
const MODES={STOP:['#64748b','EN REPOSO'],CHRG:['#fbbf24','CARGANDO'],FREQ:['#4ade80','FRECUENCIA'],
 CONT:['#fb923c','CONTINUO'],SWEEP:['#38bdf8','BARRIDO'],PROBE:['#a78bfa','PALPADOR'],PULSO:['#f87171','PULSO']};
let H=[];
function cmd(c){fetch('/api/cmd?c='+encodeURIComponent(c),{method:'POST'});
 document.body.classList.remove('flash');void document.body.offsetWidth;}
function fmt(x,d=1){return (x==null||isNaN(x))?'—':Number(x).toFixed(d)}
async function tick(){
 try{const r=await fetch('/api/data');const j=await r.json();const s=j.state;
  document.getElementById('vcap').textContent=fmt(s.vcap,1);
  document.getElementById('ion').textContent=fmt(s.ion,1);
  document.getElementById('r').textContent=s.r>=1000?Math.round(s.r):fmt(s.r,1);
  document.getElementById('p').textContent=Math.round(s.p);
  document.getElementById('duty').textContent=fmt(s.duty,2);
  document.getElementById('boost').textContent=s.boost;
  document.getElementById('tgt').textContent=(s.tgt==null?'—':Math.round(s.tgt));
  document.getElementById('tgtbig').textContent=(s.tgt==null?'—':Math.round(s.tgt))+' V';
  document.getElementById('ts').textContent=s.ts;
  const md=MODES[s.mode]||['#64748b',s.mode];const mb=document.getElementById('mode');
  mb.textContent=md[1];mb.style.color=md[0];mb.style.borderColor=md[0]+'55';
  const fa=(s.alt||'').replace('fases','').trim();
  document.getElementById('fasesdisp').textContent=fa?fa.split('').map(c=>c==='-'?'·':c).join(' '):'—';
  ['fb1','fb2','fb3'].forEach((id,ix)=>{const on=fa[ix]&&fa[ix]!=='-';const b=document.getElementById(id);
    if(b){b.style.background=on?'#15321f':'';b.style.borderColor=on?'#22c55e':'';b.style.color=on?'#86efac':'';}});
  // --- descarga (gota) ---
  document.getElementById('gband').textContent=(s.glo==null?'—':s.glo+'-'+s.ghi)+' A';
  document.getElementById('gdur').textContent=(s.gdur==null?'—':s.gdur)+' ms';
  document.getElementById('gotainfo').textContent=(s.gconm==null?'sin gota aún':'última gota: '+s.gconm+' conmutaciones (vibró)');
  const ab=document.getElementById('autob');
  if(ab){const on=!!s.auto; ab.style.background=on?'#15321f':''; ab.style.borderColor=on?'#22c55e':''; ab.style.color=on?'#86efac':''; ab.textContent=on?'Auto-gotas ON ✓':'Auto-gotas (P)';}
  H=j.hist;draw();
  const gb=document.getElementById('gotabig');
  gb.textContent=(s.gconm==null)?'— sin gota aún —':(s.gconm+' conmutaciones · '+(s.gdur||'?')+'ms · '+(s.glo||'?')+'-'+(s.ghi||'?')+'A');
  if(s.glast!=null && s.glast!==window._gl){window._gl=s.glast;const gp=document.getElementById('gotapanel');if(gp){gp.style.boxShadow='0 0 45px #fb923c';setTimeout(()=>gp.style.boxShadow='',300);}}
  const lg=document.getElementById('log');if(lg&&j.raw){lg.innerHTML=j.raw.map(l=>'<div>'+l.replace(/</g,'&lt;')+'</div>').join('');lg.scrollTop=lg.scrollHeight;}
 }catch(e){}
}
function draw(){const c=document.getElementById('chart');const ctx=c.getContext('2d');
 const W=c.width=c.clientWidth*devicePixelRatio,Ht=c.height=180*devicePixelRatio;
 ctx.clearRect(0,0,W,Ht);ctx.lineWidth=2*devicePixelRatio;
 if(H.length<2)return;
 const pad=20*devicePixelRatio;
 const pmax=Math.max(60,...H.map(d=>d.p||0));const vmax=Math.max(70,...H.map(d=>d.vcap||0));
 const xx=i=>pad+(W-2*pad)*i/(H.length-1);
 // grid
 ctx.strokeStyle='#16202e';ctx.lineWidth=1*devicePixelRatio;
 for(let k=0;k<=4;k++){const y=pad+(Ht-2*pad)*k/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();}
 // Vcap ambar
 ctx.strokeStyle='#fbbf24';ctx.lineWidth=2*devicePixelRatio;ctx.beginPath();
 H.forEach((d,i)=>{const y=Ht-pad-(Ht-2*pad)*(d.vcap/vmax);i?ctx.lineTo(xx(i),y):ctx.moveTo(xx(i),y);});ctx.stroke();
 // P verde
 ctx.strokeStyle='#4ade80';ctx.beginPath();
 H.forEach((d,i)=>{const y=Ht-pad-(Ht-2*pad)*((d.p<0?0:d.p)/pmax);i?ctx.lineTo(xx(i),y):ctx.moveTo(xx(i),y);});ctx.stroke();
 // umbral fusion 34W
 const yf=Ht-pad-(Ht-2*pad)*(34/pmax);ctx.strokeStyle='#f8717188';ctx.setLineDash([5,5]);
 ctx.beginPath();ctx.moveTo(pad,yf);ctx.lineTo(W-pad,yf);ctx.stroke();ctx.setLineDash([]);
}
setInterval(tick,50);tick();
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype='application/json'):
        b = body.encode() if isinstance(body,str) else body
        self.send_response(code); self.send_header('Content-Type',ctype)
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        try: self.wfile.write(b)
        except Exception: pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p=='/' or p=='/index.html':
            self._send(200, PAGE, 'text/html; charset=utf-8')
        elif p=='/api/data':
            with lock:
                out = {'state':dict(state), 'hist':hist[-160:], 'raw':raw[-30:]}
            self._send(200, json.dumps(out))
        else:
            self._send(404, '{}')
    def do_POST(self):
        p = urlparse(self.path)
        if p.path=='/api/cmd':
            q = parse_qs(p.query); c = (q.get('c',['']))[0]
            ok = send(c) if c else False
            self._send(200, json.dumps({'ok':ok,'c':c}))
        else:
            self._send(404, '{}')

if __name__=='__main__':
    threading.Thread(target=reader, daemon=True).start()
    threading.Thread(target=state_writer, daemon=True).start()
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), H)
    print(f'== FORJA consola en http://localhost:{PORT}  (lee {PTY}) ==')
    srv.serve_forever()
