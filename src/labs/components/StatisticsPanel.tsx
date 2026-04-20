/**
 * StatisticsPanel — overlay Canvas 2D con estadística física en vivo.
 *
 * Lee posiciones y velocidades del engine GPU (readback cada ~300ms) y
 * calcula:
 *   · Histograma de velocidades → distribución de Maxwell-Boltzmann
 *     f(v) = 4π(m/2πkT)^(3/2)·v²·exp(-mv²/2kT)
 *   · Función de distribución radial g(r) — mide estructura del fluido.
 *     g(r) → 1 en gas, oscila en líquido, picos cristalinos en sólido.
 *   · Evolución temporal de T y KE
 *
 * Costo CPU: ~3-8ms por update (readback + bin + render Canvas 2D).
 * Se actualiza cada ~300ms para no bloquear el loop principal.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GPUMDEngine } from '@/lib/chem/quantum/gpu-md';

interface StatisticsPanelProps {
  engineRef: React.MutableRefObject<GPUMDEngine | null>;
  updateMs?: number;
  /** Solo muestra si hay engine activo */
}

interface StatHistory {
  t: number[];
  T: number[];
  ke: number[];
}

interface Histogram {
  bins: number[];
  edges: number[];
  max: number;
}

interface RDF {
  r: number[];
  g: number[];
}

export default function StatisticsPanel({ engineRef, updateMs = 300 }: StatisticsPanelProps) {
  const [vHist, setVHist] = useState<Histogram | null>(null);
  const [rdf, setRdf] = useState<RDF | null>(null);
  const historyRef = useRef<StatHistory>({ t: [], T: [], ke: [] });
  const [, forceRender] = useState(0);

  // Readback buffers (re-used)
  const readbackBuf = useRef<Float32Array | null>(null);

  useEffect(() => {
    const tick = () => {
      const engine = engineRef.current;
      if (!engine) return;

      const N = engine.N;
      if (!readbackBuf.current || readbackBuf.current.length !== N * 4) {
        readbackBuf.current = new Float32Array(N * 4);
      }

      // Acceder al renderer desde el engine (hack — expuesto a través de los targets)
      // Usamos los métodos públicos de stats
      const stats = engine.stats();

      // Velocity histogram
      const velHistogram = computeVelocityHistogram(engine, readbackBuf.current);
      setVHist(velHistogram);

      // RDF (más caro — solo cuando N es razonable)
      if (N <= 4096) {
        const rdfData = computeRDF(engine, readbackBuf.current);
        setRdf(rdfData);
      } else {
        setRdf(null);
      }

      // Historia temporal
      const hist = historyRef.current;
      hist.t.push(engine.steps);
      hist.T.push(stats.temperature);
      hist.ke.push(stats.kineticEnergy);
      // Cap a 200 puntos
      if (hist.t.length > 200) {
        hist.t.shift();
        hist.T.shift();
        hist.ke.shift();
      }
      forceRender((n) => n + 1);
    };

    const id = setInterval(tick, updateMs);
    return () => clearInterval(id);
  }, [engineRef, updateMs]);

  return (
    <div className="space-y-2">
      <VelHistogramCanvas hist={vHist} engineRef={engineRef} />
      {rdf && <RDFCanvas rdf={rdf} />}
      <HistoryCanvas history={historyRef.current} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Readback de velocidades y cálculos
// ═══════════════════════════════════════════════════════════════

/** Lee textura de velocidades y arma histograma. */
function computeVelocityHistogram(
  engine: GPUMDEngine,
  buf: Float32Array,
): Histogram {
  // Usar método público de stats para no exponer internals
  // Pero necesitamos las velocidades crudas; reusamos stats + leemos después
  // Directo desde la textura via renderer interno.
  // Solución: usar renderer privado via método helper.
  readVelocities(engine, buf);
  const N = engine.N;
  const speeds: number[] = new Array(N);
  let maxSp = 0;
  for (let i = 0; i < N; i++) {
    const vx = buf[i * 4 + 0];
    const vy = buf[i * 4 + 1];
    const vz = buf[i * 4 + 2];
    const s = Math.sqrt(vx * vx + vy * vy + vz * vz);
    speeds[i] = s;
    if (s > maxSp) maxSp = s;
  }
  if (maxSp === 0) maxSp = 1;
  const nBins = 40;
  const bins = new Array(nBins).fill(0);
  const edges = new Array(nBins + 1);
  for (let i = 0; i <= nBins; i++) edges[i] = (maxSp * i) / nBins;
  for (const s of speeds) {
    const idx = Math.min(nBins - 1, Math.floor((s / maxSp) * nBins));
    bins[idx]++;
  }
  const max = Math.max(...bins);
  return { bins, edges, max };
}

/** RDF: g(r) = densidad local / densidad promedio. */
function computeRDF(engine: GPUMDEngine, buf: Float32Array): RDF {
  // Leer posiciones via readback helper
  readPositions(engine, buf);
  const N = engine.N;
  const L = engine.boxSize;
  const halfL = L / 2;
  const rMax = halfL * 0.95;
  const nBins = 60;
  const dr = rMax / nBins;
  const histogram = new Array(nBins).fill(0);

  // Sampleamos pares aleatorios si N es grande (sino O(N²) caro)
  const maxPairs = 5_000_000;
  const totalPairs = (N * (N - 1)) / 2;
  const sampleEvery = Math.max(1, Math.ceil(totalPairs / maxPairs));

  let counted = 0;
  let pairIdx = 0;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (pairIdx++ % sampleEvery !== 0) continue;
      let dx = buf[i * 4 + 0] - buf[j * 4 + 0];
      let dy = buf[i * 4 + 1] - buf[j * 4 + 1];
      let dz = buf[i * 4 + 2] - buf[j * 4 + 2];
      // Min-image PBC
      dx -= L * Math.round(dx / L);
      dy -= L * Math.round(dy / L);
      dz -= L * Math.round(dz / L);
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < rMax && r > 0) {
        const bin = Math.min(nBins - 1, Math.floor(r / dr));
        histogram[bin] += 2;  // contamos el par en ambas direcciones
        counted++;
      }
    }
  }

  // Normalización: g(r) = histograma / (4π r² dr · ρ · N)
  // ρ = N / L³
  const rho = N / (L * L * L);
  const samplingFactor = sampleEvery;
  const g = new Array(nBins);
  const rArr = new Array(nBins);
  for (let i = 0; i < nBins; i++) {
    const r = (i + 0.5) * dr;
    rArr[i] = r;
    const shellVol = 4 * Math.PI * r * r * dr;
    const expected = shellVol * rho * N;
    g[i] = (histogram[i] * samplingFactor) / expected;
  }

  return { r: rArr, g };
}

/** Helper para leer velocidades a CPU. */
function readVelocities(engine: GPUMDEngine, buf: Float32Array): void {
  // Acceso a internals via casting
  const e = engine as unknown as {
    renderer: THREE.WebGLRenderer;
    gpuCompute: { getCurrentRenderTarget: (v: unknown) => { texture: unknown } };
    velocityVariable: unknown;
  };
  const target = e.gpuCompute.getCurrentRenderTarget(e.velocityVariable) as unknown as THREE.WebGLRenderTarget;
  const res = engine.N === 0 ? 1 : Math.round(Math.sqrt(engine.N));
  e.renderer.readRenderTargetPixels(target, 0, 0, res, res, buf);
}

function readPositions(engine: GPUMDEngine, buf: Float32Array): void {
  const e = engine as unknown as {
    renderer: THREE.WebGLRenderer;
    gpuCompute: { getCurrentRenderTarget: (v: unknown) => { texture: unknown } };
    positionVariable: unknown;
  };
  const target = e.gpuCompute.getCurrentRenderTarget(e.positionVariable) as unknown as THREE.WebGLRenderTarget;
  const res = Math.round(Math.sqrt(engine.N));
  e.renderer.readRenderTargetPixels(target, 0, 0, res, res, buf);
}

// ═══════════════════════════════════════════════════════════════
// Canvas 2D — Histograma Maxwell-Boltzmann
// ═══════════════════════════════════════════════════════════════

function VelHistogramCanvas({
  hist, engineRef,
}: {
  hist: Histogram | null;
  engineRef: React.MutableRefObject<GPUMDEngine | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !hist) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 240, H = 90;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ml = 22, mr = 4, mt = 8, mb = 18;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    // Fondo plot
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(ml, mt, pw, ph);

    // Maxwell-Boltzmann overlay (si engine disponible)
    const engine = engineRef.current;
    if (engine) {
      try {
        const stats = engine.stats();
        const T = stats.temperature;
        const m = 1.0;  // masa reducida promedio
        const vMax = hist.edges[hist.edges.length - 1];
        // f(v) = 4π (m/2πT)^(3/2) · v² · exp(-mv²/2T)
        const A = 4 * Math.PI * Math.pow(m / (2 * Math.PI * T), 1.5);
        let peakF = 0;
        for (let i = 0; i < 100; i++) {
          const v = (vMax * i) / 100;
          const f = A * v * v * Math.exp(-m * v * v / (2 * T));
          if (f > peakF) peakF = f;
        }
        // Escalar a la altura del histograma (empatar pico)
        if (peakF > 0 && hist.max > 0) {
          const N = engine.N;
          const dv = vMax / hist.bins.length;
          const binArea = N * dv;
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
            const v = (vMax * i) / 100;
            const f = A * v * v * Math.exp(-m * v * v / (2 * T)) * binArea;
            const x = ml + (v / vMax) * pw;
            const y = mt + ph - (f / hist.max) * ph;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } catch {}
    }

    // Barras del histograma
    const barW = pw / hist.bins.length;
    ctx.fillStyle = '#4FC3F7';
    for (let i = 0; i < hist.bins.length; i++) {
      const h = (hist.bins[i] / hist.max) * ph;
      ctx.fillRect(ml + i * barW, mt + ph - h, barW * 0.85, h);
    }

    // Ejes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt);
    ctx.lineTo(ml, mt + ph);
    ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('|v|', ml + pw / 2, H - 2);
    ctx.save();
    ctx.translate(7, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('N(v)', 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillText(hist.edges[hist.edges.length - 1].toFixed(1), ml + pw, mt + ph + 11);
    ctx.textAlign = 'left';
    ctx.fillText('0', ml, mt + ph + 11);
  }, [hist, engineRef]);

  return (
    <div className="rounded-lg bg-black/60 backdrop-blur-md border border-white/10 p-2">
      <div className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider mb-1 flex items-center gap-2">
        <span>Maxwell-Boltzmann</span>
        <span className="text-[#FBBF24]">— teórica</span>
        <span className="text-[#4FC3F7]">— medida</span>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Canvas 2D — Función de distribución radial g(r)
// ═══════════════════════════════════════════════════════════════

function RDFCanvas({ rdf }: { rdf: RDF }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 240, H = 90;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ml = 22, mr = 4, mt = 8, mb = 18;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(ml, mt, pw, ph);

    const rMax = rdf.r[rdf.r.length - 1];
    const gMax = Math.max(...rdf.g, 2);

    // Línea g=1 (referencia gas ideal)
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([3, 3]);
    const y1 = mt + ph - (1 / gMax) * ph;
    ctx.beginPath();
    ctx.moveTo(ml, y1);
    ctx.lineTo(ml + pw, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curva g(r)
    ctx.strokeStyle = '#66BB6A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < rdf.r.length; i++) {
      const x = ml + (rdf.r[i] / rMax) * pw;
      const y = mt + ph - Math.min(ph, (rdf.g[i] / gMax) * ph);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Ejes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt);
    ctx.lineTo(ml, mt + ph);
    ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('r / σ', ml + pw / 2, H - 2);
    ctx.save();
    ctx.translate(7, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('g(r)', 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillText(rMax.toFixed(1), ml + pw, mt + ph + 11);
    ctx.textAlign = 'left';
    ctx.fillText('0', ml, mt + ph + 11);
  }, [rdf]);

  return (
    <div className="rounded-lg bg-black/60 backdrop-blur-md border border-white/10 p-2">
      <div className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider mb-1">
        g(r) · distribución radial
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Canvas 2D — Historia temporal de T y KE
// ═══════════════════════════════════════════════════════════════

function HistoryCanvas({ history }: { history: StatHistory }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || history.t.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 240, H = 70;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ml = 22, mr = 4, mt = 6, mb = 14;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(ml, mt, pw, ph);

    const tMin = history.t[0];
    const tMax = history.t[history.t.length - 1];
    const tSpan = tMax - tMin || 1;

    const Tmin = Math.min(...history.T);
    const Tmax = Math.max(...history.T);
    const Tspan = (Tmax - Tmin) || 1;

    ctx.strokeStyle = '#F87171';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.T.length; i++) {
      const x = ml + ((history.t[i] - tMin) / tSpan) * pw;
      const y = mt + ph - ((history.T[i] - Tmin) / Tspan) * ph;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt);
    ctx.lineTo(ml, mt + ph);
    ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(Tmax.toFixed(2), ml - 2, mt + 4);
    ctx.fillText(Tmin.toFixed(2), ml - 2, mt + ph);
    ctx.textAlign = 'center';
    ctx.fillText('step', ml + pw / 2, H - 2);
  }, [history.t.length, history.T]);

  return (
    <div className="rounded-lg bg-black/60 backdrop-blur-md border border-white/10 p-2">
      <div className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider mb-1">
        T(t) · evolución
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
