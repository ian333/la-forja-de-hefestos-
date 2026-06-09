/**
 * NovaLab — el laboratorio interactivo de la placa NOVA OMNI.
 *
 * La tesis del proyecto: el cuello de botella es la EDUCACIÓN, no el hardware.
 * Quien no puede pagar componentes no aprende, no construye, no compra → el
 * mercado se queda en pura reparación. Aquí cualquiera APRENDE la placa entera
 * —blink, mover un motor, medir corriente, escanear el bus— GRATIS y en el
 * navegador, antes de gastar un peso. Cuando ya sabe, compra la placa real.
 *
 * Cada práctica resalta el bloque relevante del PCB, corre una simulación de
 * verdad y muestra el código REAL que se flashea (pines reales del firmware
 * NOVA: I2C0 = GP4/GP5, etc.).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// ── Bloques funcionales del PCB (geometría sobre un board de 520×340) ────

interface Block {
  id: string;
  x: number; y: number; w: number; h: number;
  label: string;
  sub?: string;
}

const BLOCKS: Block[] = [
  { id: 'rp-a', x: 150, y: 120, w: 90, h: 70, label: 'RP2350·A', sub: 'telemetría · IA' },
  { id: 'rp-b', x: 280, y: 120, w: 90, h: 70, label: 'RP2350·B', sub: 'movimiento RT' },
  { id: 'drv', x: 150, y: 30, w: 220, h: 50, label: '4× DRV8424', sub: 'drivers paso a paso · 1/256' },
  { id: 'bldc', x: 388, y: 30, w: 100, h: 50, label: 'MCF8329A', sub: 'BLDC sensorless' },
  { id: 'ina', x: 388, y: 120, w: 100, h: 70, label: '7× INA226', sub: 'sensado de corriente' },
  { id: 'imu', x: 388, y: 215, w: 100, h: 45, label: '5× LSM6DS3', sub: 'IMU 6-DOF' },
  { id: 'esp', x: 30, y: 30, w: 100, h: 70, label: 'ESP32', sub: 'WiFi · BT' },
  { id: 'buck', x: 30, y: 215, w: 160, h: 45, label: '3× TPS5430', sub: '24V → 12/5/3.3' },
  { id: 'bms', x: 30, y: 120, w: 100, h: 70, label: 'BMS + carga', sub: 'BQ7693 · BQ24610' },
  { id: 'usb', x: 210, y: 215, w: 160, h: 45, label: '4× USB-C', sub: '2 prog · 2 periférico' },
];

// ── Prácticas ────────────────────────────────────────────────────────────

interface Practice {
  id: string;
  name: string;
  icon: string;
  blocks: string[];        // ids de bloques que se resaltan
  objetivo: string;
  idea: string;
  code: string;
  lang: string;
  Interactive: () => ReactNode;
}

const PRACTICES: Practice[] = [
  {
    id: 'blink',
    name: 'Hola mundo (blink)',
    icon: '💡',
    blocks: ['rp-a'],
    objetivo: 'Encender y apagar un LED por software. El "hola mundo" del hardware: confirma que el chip vive y que tu código corre.',
    idea: 'El RP2350 pone un pin en alto (3.3 V) o bajo (0 V). Un retardo entre cada cambio marca el ritmo. Si parpadea, todo el toolchain funciona.',
    lang: 'C · pico-sdk',
    code: `#include "pico/stdlib.h"

int main() {
    const uint LED = 25;          // LED de a bordo
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    while (true) {
        gpio_put(LED, 1);         // 3.3 V
        sleep_ms(250);
        gpio_put(LED, 0);         // 0 V
        sleep_ms(250);
    }
}`,
    Interactive: BlinkSim,
  },
  {
    id: 'stepper',
    name: 'Mover un motor a pasos',
    icon: '⚙️',
    blocks: ['drv', 'rp-b'],
    objetivo: 'Girar un motor NEMA con un DRV8424. Controlas velocidad (frecuencia de pulsos) y suavidad (microstepping).',
    idea: 'Cada pulso en STEP avanza un paso. Con microstepping el driver parte el paso en 2, 8… hasta 256 → el giro es sedoso y silencioso, a costa de torque por micro-paso.',
    lang: 'C · pico-sdk',
    code: `// DRV8424: STEP=GP18, DIR=GP19, M0/M1 = microstepping
gpio_put(DIR, 1);                 // sentido
for (int i = 0; i < steps; i++) {
    gpio_put(STEP, 1);
    sleep_us(pulse_us);           // ← velocidad
    gpio_put(STEP, 0);
    sleep_us(pulse_us);
}
// M1:M0 = 11 → 1/256 microstep (giro sedoso)`,
    Interactive: StepperSim,
  },
  {
    id: 'ina',
    name: 'Medir corriente real',
    icon: '📈',
    blocks: ['ina', 'rp-b'],
    objetivo: 'Leer cuánta corriente jala el motor con un INA226 por I2C. Medición Kelvin (4 hilos) sobre un shunt: precisa de verdad.',
    idea: 'El INA226 mide la caída en una resistencia shunt diminuta (2 mΩ) con sensado a 4 hilos, que ignora la resistencia de los cables. V_shunt = I·R_shunt → corriente real, 16 bits.',
    lang: 'Python · i2c_tool',
    code: `# INA226 @ 0x40 — leer corriente (registro 0x04)
WR 40 04 2          # write reg 0x04, read 2 bytes
# raw · 2.5 µV / R_shunt = corriente
# ej: 0x0C80 = 3200 · 2.5µV / 2mΩ = 4.0 A`,
    Interactive: Ina226Sim,
  },
  {
    id: 'i2c',
    name: 'Escanear el bus (I2C)',
    icon: '🔎',
    blocks: ['ina', 'imu', 'bms'],
    objetivo: 'Descubrir qué chips están vivos en el bus I2C. Un escaneo recorre las 128 direcciones y toca la puerta de cada una.',
    idea: 'I2C es un bus de 2 cables (SDA/SCL). Cada chip tiene una dirección. Mandas la dirección y, si alguien contesta (ACK), está ahí. Así sabes que tu hardware responde.',
    lang: 'Python · nova_lab_i2c',
    code: `# nova_lab_i2c — bridge I2C por USB (GP4=SDA, GP5=SCL, 100 kHz)
SCAN                # recorre 0x08..0x77
# encontrados:
#   0x40  INA226  (corriente)
#   0x6A  LSM6DS3 (IMU)
#   0x08  BQ7693  (BMS)`,
    Interactive: I2cScanSim,
  },
  {
    id: 'power',
    name: 'Energía: del 24 V al 3.3 V',
    icon: '🔋',
    blocks: ['buck', 'bms'],
    objetivo: 'Entender la cadena de poder: una batería 6S alimenta todo y tres bucks TPS5430 bajan el voltaje a lo que cada parte necesita.',
    idea: 'Un buck (reductor conmutado) baja voltaje SIN quemar la diferencia en calor — prende y apaga muy rápido y filtra. Por eso rinde ~90%, no como un regulador lineal que la disipa.',
    lang: 'concepto',
    code: `Batería 6S LiPo  →  ~24 V  (BMS BQ7693 protege cada celda)
        │
        ├─ TPS5430 → 12 V   (motores / lógica de potencia)
        ├─ TPS5430 →  5 V   (USB, periféricos)
        └─ TPS5430 →  3.3 V (RP2350, sensores)`,
    Interactive: PowerSim,
  },
];

// ════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════

export default function NovaLab() {
  const [activeId, setActiveId] = useState(PRACTICES[0].id);
  const active = useMemo(() => PRACTICES.find((p) => p.id === activeId)!, [activeId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 h-full p-3 overflow-hidden">
      {/* Izquierda: PCB + práctica interactiva */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <div className="rounded-lg border border-[#2c2818] bg-[#0a0d08] p-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e]">NOVA OMNI · doble RP2350</div>
            <div className="text-[10px] text-[#6a5e4e] font-mono">la placa que crece con tu carrera</div>
          </div>
          <BoardSVG highlight={active.blocks} />
        </div>
        <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3 flex-1 min-h-0">
          <active.Interactive />
        </div>
      </div>

      {/* Derecha: selector + objetivo + código */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <div className="grid grid-cols-1 gap-1.5">
          {PRACTICES.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-left border transition-colors ${
                p.id === activeId
                  ? 'bg-[#1e2538] border-[#d4b050]'
                  : 'bg-[#14160f] border-[#2c2818] hover:border-[#3e3624]'
              }`}
            >
              <span className="text-[18px]">{p.icon}</span>
              <span className={`text-[13px] font-medium ${p.id === activeId ? 'text-[#ead080]' : 'text-[#a0947e]'}`}>
                {p.name}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-1">Objetivo</div>
          <p className="text-[13px] text-[#c9bfa8] leading-relaxed">{active.objetivo}</p>
          <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pt-3 pb-1">Cómo funciona</div>
          <p className="text-[12px] text-[#a0947e] leading-relaxed">{active.idea}</p>
        </div>

        <div className="rounded-lg border border-[#2c2818] bg-[#080a06] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2c2818]">
            <span className="text-[11px] uppercase tracking-wider text-[#6a5e4e]">Código que se flashea</span>
            <span className="text-[10px] font-mono text-[#7c9a6a]">{active.lang}</span>
          </div>
          <pre className="text-[11px] leading-relaxed text-[#b9d0a8] font-mono p-3 overflow-auto whitespace-pre">
            {active.code}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── PCB ──────────────────────────────────────────────────────────────────

function BoardSVG({ highlight }: { highlight: string[] }) {
  const hot = new Set(highlight);
  return (
    <svg viewBox="0 0 520 290" className="w-full" style={{ maxHeight: 320 }}>
      {/* board */}
      <rect x={8} y={8} width={504} height={274} rx={12} fill="#0f1a12" stroke="#1d3a26" strokeWidth={2} />
      {/* tornillos */}
      {[[22, 22], [498, 22], [22, 268], [498, 268]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={5} fill="#0a0d08" stroke="#2a4a32" strokeWidth={1.5} />
      ))}
      {/* trazas decorativas */}
      <g stroke="#1a3322" strokeWidth={1} opacity={0.7} fill="none">
        <path d="M195,120 L195,90 L388,90 L388,120" />
        <path d="M325,120 L325,80" />
        <path d="M130,155 L150,155" />
        <path d="M370,155 L388,155" />
      </g>
      {/* bloques */}
      {BLOCKS.map((b) => {
        const on = hot.has(b.id);
        return (
          <g key={b.id}>
            <rect
              x={b.x} y={b.y} width={b.w} height={b.h} rx={6}
              fill={on ? '#2a2410' : '#15110a'}
              stroke={on ? '#d4b050' : '#3a3018'}
              strokeWidth={on ? 2.5 : 1.5}
            />
            {on && (
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="none" stroke="#d4b050" strokeWidth={1} opacity={0.35}>
                <animate attributeName="opacity" values="0.35;0.05;0.35" dur="1.6s" repeatCount="indefinite" />
              </rect>
            )}
            <text x={b.x + b.w / 2} y={b.y + (b.sub ? b.h / 2 - 2 : b.h / 2 + 4)} textAnchor="middle"
              fontSize={b.w > 110 ? 13 : 11} fontWeight={600}
              fill={on ? '#ead080' : '#9a8a64'} fontFamily="JetBrains Mono, monospace">
              {b.label}
            </text>
            {b.sub && (
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 12} textAnchor="middle" fontSize={9}
                fill={on ? '#c9bfa8' : '#6a5e4e'} fontFamily="Inter, sans-serif">
                {b.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Simulaciones interactivas por práctica
// ════════════════════════════════════════════════════════════════════════

function useAnimFrame(cb: (t: number) => void, deps: unknown[]) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const loop = (now: number) => {
      if (!t0) t0 = now;
      cbRef.current((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function BlinkSim() {
  const [hz, setHz] = useState(2);
  const [on, setOn] = useState(false);
  useAnimFrame((t) => {
    setOn(Math.floor(t * hz * 2) % 2 === 0);
  }, [hz]);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 120 120" width={140} height={140}>
          <circle cx={60} cy={60} r={42} fill={on ? '#ffd24a' : '#3a3018'} stroke={on ? '#ffe9a0' : '#2c2818'} strokeWidth={3}
            style={{ filter: on ? 'drop-shadow(0 0 18px #ffd24a)' : 'none', transition: 'all 60ms' }} />
          <text x={60} y={66} textAnchor="middle" fontSize={14} fill={on ? '#181d2e' : '#6a5e4e'} fontFamily="JetBrains Mono">GP25</text>
        </svg>
        <div className="font-mono text-[15px]" style={{ color: on ? '#ead080' : '#6a5e4e' }}>
          {on ? 'HIGH · 3.3 V' : 'LOW · 0 V'}
        </div>
      </div>
      <label className="w-3/4">
        <div className="flex justify-between text-[12px] mb-1">
          <span className="text-[#c9bfa8]">Frecuencia</span>
          <span className="font-mono text-[#ead080]">{hz.toFixed(1)} Hz</span>
        </div>
        <input type="range" min={0.5} max={12} step={0.5} value={hz} onChange={(e) => setHz(parseFloat(e.target.value))}
          className="w-full accent-[#d4b050]" />
      </label>
    </div>
  );
}

function StepperSim() {
  const [micro, setMicro] = useState(8);
  const [rpm, setRpm] = useState(60);
  const angleRef = useRef(0);
  const [angle, setAngle] = useState(0);
  const lastRef = useRef(0);
  useAnimFrame((t) => {
    const dt = t - lastRef.current;
    lastRef.current = t;
    angleRef.current += rpm * 6 * dt; // °/s = rpm*360/60
    setAngle(angleRef.current % 360);
  }, [rpm]);
  // marcas de micro-paso visibles
  const fullSteps = 200; // NEMA típico 1.8°
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <svg viewBox="0 0 160 160" width={170} height={170}>
        <circle cx={80} cy={80} r={62} fill="#12100a" stroke="#3a3018" strokeWidth={3} />
        {/* dientes (full steps) */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <line key={i} x1={80 + 56 * Math.cos(a)} y1={80 + 56 * Math.sin(a)} x2={80 + 62 * Math.cos(a)} y2={80 + 62 * Math.sin(a)} stroke="#2c2818" strokeWidth={2} />;
        })}
        {/* rotor */}
        <g transform={`rotate(${angle} 80 80)`}>
          <line x1={80} y1={80} x2={80} y2={24} stroke="#d4b050" strokeWidth={4} strokeLinecap="round" />
          <circle cx={80} cy={28} r={6} fill="#ead080" />
        </g>
        <circle cx={80} cy={80} r={9} fill="#3a3018" stroke="#d4b050" strokeWidth={2} />
      </svg>
      <div className="font-mono text-[12px] text-[#a0947e]">
        {fullSteps}×{micro} = <span className="text-[#ead080]">{fullSteps * micro}</span> micro-pasos / vuelta
      </div>
      <div className="grid grid-cols-2 gap-4 w-3/4">
        <label>
          <div className="flex justify-between text-[12px] mb-1"><span className="text-[#c9bfa8]">Velocidad</span><span className="font-mono text-[#ead080]">{rpm} rpm</span></div>
          <input type="range" min={6} max={300} step={6} value={rpm} onChange={(e) => setRpm(parseFloat(e.target.value))} className="w-full accent-[#d4b050]" />
        </label>
        <label>
          <div className="flex justify-between text-[12px] mb-1"><span className="text-[#c9bfa8]">Microstep</span><span className="font-mono text-[#ead080]">1/{micro}</span></div>
          <input type="range" min={0} max={4} step={1} value={[1, 2, 8, 32, 256].indexOf(micro)} onChange={(e) => setMicro([1, 2, 8, 32, 256][parseInt(e.target.value)])} className="w-full accent-[#d4b050]" />
        </label>
      </div>
    </div>
  );
}

function Ina226Sim() {
  const R_SHUNT = 0.002;
  const [load, setLoad] = useState(3); // amperes objetivo
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>([]);
  const [iNow, setINow] = useState(0);
  useAnimFrame((t) => {
    // corriente real con un poco de rizo/ruido (motor)
    const i = Math.max(0, load + 0.25 * Math.sin(t * 18) + 0.08 * Math.sin(t * 130));
    setINow(i);
    const h = hist.current;
    h.push(i);
    if (h.length > 240) h.shift();
    const cv = canvasRef.current;
    if (cv) {
      const ctx = cv.getContext('2d')!;
      const W = cv.width, H = cv.height;
      ctx.fillStyle = '#080a10'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#1a1f2e';
      for (let g = 0; g <= 4; g++) { const y = (g / 4) * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = '#d4b050'; ctx.lineWidth = 1.8; ctx.beginPath();
      const ymax = 8;
      h.forEach((v, k) => { const x = (k / 240) * W; const y = H - (v / ymax) * H; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
  }, [load]);
  const vShunt = iNow * R_SHUNT;
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Readout label="Corriente" value={`${iNow.toFixed(2)} A`} color="#d4b050" />
        <Readout label="V shunt (2 mΩ)" value={`${(vShunt * 1000).toFixed(2)} mV`} color="#60a5fa" />
        <Readout label="Potencia" value={`${(iNow * 24).toFixed(1)} W`} color="#4ade80" />
      </div>
      <canvas ref={canvasRef} width={680} height={150} className="w-full rounded border border-[#2c2818]" />
      <label className="px-1">
        <div className="flex justify-between text-[12px] mb-1"><span className="text-[#c9bfa8]">Carga del motor</span><span className="font-mono text-[#ead080]">{load.toFixed(1)} A</span></div>
        <input type="range" min={0} max={6} step={0.1} value={load} onChange={(e) => setLoad(parseFloat(e.target.value))} className="w-full accent-[#d4b050]" />
      </label>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md bg-[#1e2538] px-3 py-2">
      <div className="text-[10px] text-[#a0947e]">{label}</div>
      <div className="text-[18px] font-mono" style={{ color }}>{value}</div>
    </div>
  );
}

const I2C_DEVICES: Record<number, string> = {
  0x08: 'BQ7693 · BMS',
  0x40: 'INA226 · corriente',
  0x41: 'INA226 · corriente',
  0x6a: 'LSM6DS3 · IMU',
};

function I2cScanSim() {
  const [scanAddr, setScanAddr] = useState(0x08);
  const [found, setFound] = useState<number[]>([]);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    setFound([]);
    setScanAddr(0x08);
    const id = setInterval(() => {
      setScanAddr((a) => {
        if (a >= 0x77) { setRunning(false); return a; }
        if (I2C_DEVICES[a + 1]) setFound((f) => [...f, a + 1]);
        return a + 1;
      });
    }, 28);
    return () => clearInterval(id);
  }, [running]);
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#a0947e]">Escaneando</span>
        <span className="font-mono text-[15px] text-[#ead080]">0x{scanAddr.toString(16).padStart(2, '0')}</span>
        <button onClick={() => setRunning(true)} className="ml-auto text-[11px] px-2.5 py-1 rounded bg-[#1e2538] border border-[#2c2818] text-[#a0947e] hover:border-[#d4b050]">↻ re-escanear</button>
      </div>
      {/* matriz de direcciones */}
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
        {Array.from({ length: 0x78 - 0x08 }).map((_, i) => {
          const addr = 0x08 + i;
          const isFound = found.includes(addr);
          const isScanning = addr === scanAddr && running;
          return (
            <div key={addr} title={`0x${addr.toString(16)}`}
              className="aspect-square rounded-[3px]"
              style={{
                background: isFound ? '#d4b050' : isScanning ? '#4ade80' : '#15110a',
                border: '1px solid #2c2818',
              }} />
          );
        })}
      </div>
      <div className="rounded-md bg-[#080a06] border border-[#2c2818] p-2 flex-1 font-mono text-[12px]">
        {found.length === 0 ? (
          <span className="text-[#6a5e4e]">buscando dispositivos…</span>
        ) : (
          found.map((a) => (
            <div key={a} className="text-[#b9d0a8]">
              <span className="text-[#ead080]">0x{a.toString(16).padStart(2, '0')}</span> — {I2C_DEVICES[a]} <span className="text-[#7c9a6a]">[ACK]</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PowerSim() {
  const [vin, setVin] = useState(24);
  const rails = [
    { v: 12, name: 'motores', color: '#f87171' },
    { v: 5, name: 'USB / periféricos', color: '#fbbf24' },
    { v: 3.3, name: 'RP2350 / sensores', color: '#4ade80' },
  ];
  const eff = 0.9;
  return (
    <div className="flex flex-col h-full gap-4 justify-center">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-[#1e2538] border border-[#2c2818] px-4 py-3 text-center">
          <div className="text-[10px] text-[#a0947e]">Batería 6S</div>
          <div className="text-[22px] font-mono text-[#ead080]">{vin.toFixed(1)} V</div>
        </div>
        <div className="text-[#6a5e4e] text-[22px]">→</div>
        <div className="flex flex-col gap-2 flex-1">
          {rails.map((r) => (
            <div key={r.v} className="flex items-center gap-2">
              <div className="rounded-md px-3 py-1.5 font-mono text-[14px]" style={{ background: '#15110a', border: `1px solid ${r.color}55`, color: r.color }}>
                {r.v} V
              </div>
              <div className="h-[3px] flex-1 rounded" style={{ background: `linear-gradient(90deg, ${r.color}, transparent)` }} />
              <span className="text-[11px] text-[#a0947e]">{r.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[12px] text-[#a0947e] font-mono">
        Buck conmutado ≈ {(eff * 100).toFixed(0)}% eficiencia — un regulador lineal quemaría{' '}
        <span className="text-[#f87171]">{(((vin - 5) / vin) * 100).toFixed(0)}%</span> de la energía en calor a 5 V.
      </div>
      <label className="px-1">
        <div className="flex justify-between text-[12px] mb-1"><span className="text-[#c9bfa8]">Voltaje de batería (carga ↔ descarga)</span><span className="font-mono text-[#ead080]">{vin.toFixed(1)} V</span></div>
        <input type="range" min={18} max={25.2} step={0.1} value={vin} onChange={(e) => setVin(parseFloat(e.target.value))} className="w-full accent-[#d4b050]" />
      </label>
    </div>
  );
}
