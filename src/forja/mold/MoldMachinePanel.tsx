/**
 * PANEL DE LA MÁQUINA DE MOLDES — el cliente sube su pieza y ve la COTIZACIÓN.
 * ===========================================================================
 * La cara de venta del orquestador `moldMachine`: un formulario con las
 * dimensiones de la pieza y un resultado con veredicto de ingeniería, precio
 * sugerido y desglose Kazmer. Corre 100 % en el browser (moldMachine es puro).
 */
import { useMemo, useState } from 'react';
import { moldMachine, type MachineSpec, type MoldPackage } from './moldmachine';
import * as K from '../brep/occt';
import { packageToAssemblySpec, buildMoldLaminas, laminasToPrintHTML } from './mold-plano-set';

const GOLD = '#c9a227';
const PRESETS: Array<{ label: string } & MachineSpec> = [
  { label: 'Bezel laptop', name: 'Bezel laptop', Lmm: 240, Wmm: 160, Hmm: 10, surfaceMm2: 45700, volumeMm3: 27500, wallMm: 1.5, annualVolume: 1_000_000, plastic: 'ABS', finish: 'SPI B-3' },
  { label: 'Tapa rosca', name: 'Tapa rosca', Lmm: 40, Wmm: 40, Hmm: 15, surfaceMm2: 6500, volumeMm3: 2800, wallMm: 1.2, annualVolume: 8_000_000, plastic: 'PP', finish: 'SPI A-3' },
  { label: 'Carcasa auto', name: 'Carcasa conector auto', Lmm: 60, Wmm: 40, Hmm: 25, surfaceMm2: 14000, volumeMm3: 9000, wallMm: 2, annualVolume: 3_000_000, plastic: 'PA66', finish: 'SPI B-3', abrasive: true },
  { label: 'Lente óptico', name: 'Lente óptico', Lmm: 50, Wmm: 50, Hmm: 8, surfaceMm2: 9000, volumeMm3: 12000, wallMm: 3, annualVolume: 200_000, plastic: 'PC', finish: 'SPI A-1', mirror: true },
];

const PLASTICS = ['ABS', 'PP', 'PC', 'PA66', 'POM'];
const FINISHES = ['texture', 'SPI B-3', 'SPI A-3', 'SPI A-1'];
const $ = (x: number) => '$' + Math.round(x).toLocaleString('en-US');

export default function MoldMachinePanel({ onClose }: { onClose: () => void }) {
  const [spec, setSpec] = useState<MachineSpec>(PRESETS[0]);
  const set = <Kk extends keyof MachineSpec>(k: Kk, val: MachineSpec[Kk]) => setSpec((s) => ({ ...s, [k]: val }));
  const pkg: MoldPackage = useMemo(() => moldMachine(spec), [spec]);
  const c = pkg.cotizacion, v = pkg.veredicto, r = pkg.recomendacion;
  const [gen, setGen] = useState<'idle' | 'busy' | 'err'>('idle');

  // GENERAR PLANOS: construye el juego de láminas (mismo motor que el PDF) desde el
  // paquete y abre una ventana imprimible → PDF. "Lo mismo con puros clicks".
  const generarPlanos = async () => {
    setGen('busy');
    try {
      const oc = await K.getOCCT();
      const aspec = packageToAssemblySpec(pkg);
      const rows = [
        { grupo: 'Recomendación', param: 'arquitectura × cavidades', valor: `${r.arch} × ${r.nCav}`, ref: '§3.4' },
        { grupo: 'Máquina', param: 'inyectora', valor: `${pkg.maquina?.nombre ?? '—'} ${pkg.maquina?.ok ? '✓' : '⚠'}`, ref: '§4.3.3', ok: pkg.maquina?.ok },
        { grupo: 'DFM', param: 'moldeabilidad', valor: `${pkg.dfm.score}/100`, ref: '§2.3', ok: pkg.dfm.score >= 60 },
      ];
      const w = window.open('', '_blank');
      if (!w) { setGen('err'); return; }
      w.document.write('<!doctype html><title>Generando planos…</title><body style="font-family:sans-serif;padding:40px;color:#333">⏳ Construyendo las placas del molde y proyectando los planos…</body>');
      const pages = buildMoldLaminas(K, oc, aspec, rows);   // ensamble + análisis + 5 placas a 4 vistas
      w.document.open(); w.document.write(laminasToPrintHTML(pages, `Planos · ${aspec.name}`)); w.document.close();
      setGen('idle');
    } catch (e) { console.error('generarPlanos', e); setGen('err'); }
  };

  const numField = (label: string, k: keyof MachineSpec, unit: string, step = 1) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" value={spec[k] as number} step={step} data-testid={`mm-${k}`}
          onChange={(e) => set(k, Number(e.target.value) as MachineSpec[typeof k])}
          style={{ width: 92, background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
        <span style={{ fontSize: 10, opacity: 0.5 }}>{unit}</span>
      </div>
    </label>
  );

  return (
    <div data-testid="mold-machine-view" style={{ position: 'fixed', inset: 0, zIndex: 92, background: 'rgba(5,7,11,0.97)', fontFamily: "'JetBrains Mono', monospace", color: '#e9eef5', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #1c2634' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>🏭 LA MÁQUINA DE MOLDES</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Sube tu pieza → cotización de molde con veredicto de ingeniería (Kazmer)</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button data-testid="mm-planos" onClick={generarPlanos} disabled={gen === 'busy'}
            title="Genera el juego completo de planos (ensamble + análisis + cada placa a 4 vistas) e imprime a PDF"
            style={{ background: gen === 'busy' ? 'rgba(40,48,60,0.9)' : `linear-gradient(160deg,${GOLD},#a8851d)`, border: `1px solid ${GOLD}`, color: gen === 'busy' ? '#9fb0c4' : '#1a1206', cursor: gen === 'busy' ? 'wait' : 'pointer', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700 }}>
            {gen === 'busy' ? '⏳ Generando…' : gen === 'err' ? '⚠ Reintentar planos' : '📐 GENERAR PLANOS (PDF)'}
          </button>
          <button data-testid="mm-close" onClick={onClose} style={{ background: 'rgba(20,28,40,0.9)', border: '1px solid #2c3a50', color: '#dfe7f2', cursor: 'pointer', borderRadius: 7, padding: '7px 14px', fontSize: 12 }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, padding: '20px 22px', flex: 1 }}>
        {/* ── FORMULARIO ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.label} data-testid={`mm-preset-${p.label}`} onClick={() => setSpec(p)}
                style={{ background: spec.name === p.name ? GOLD : 'rgba(20,28,40,0.9)', color: spec.name === p.name ? '#1a1206' : '#cfd8e3', border: '1px solid #2c3a50', borderRadius: 6, padding: '4px 9px', fontSize: 10.5, cursor: 'pointer', fontWeight: spec.name === p.name ? 700 : 400 }}>{p.label}</button>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Nombre de la pieza</span>
            <input value={spec.name} data-testid="mm-name" onChange={(e) => set('name', e.target.value)}
              style={{ background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit', fontSize: 12 }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {numField('Largo', 'Lmm', 'mm')}{numField('Ancho', 'Wmm', 'mm')}{numField('Alto', 'Hmm', 'mm')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {numField('Superficie', 'surfaceMm2', 'mm²', 100)}{numField('Volumen', 'volumeMm3', 'mm³', 100)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {numField('Pared', 'wallMm', 'mm', 0.1)}{numField('Vol. anual', 'annualVolume', 'pzas', 10000)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Plástico</span>
              <select value={spec.plastic ?? 'ABS'} data-testid="mm-plastic" onChange={(e) => set('plastic', e.target.value)}
                style={{ background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', fontFamily: 'inherit', fontSize: 12 }}>
                {PLASTICS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Acabado</span>
              <select value={spec.finish ?? 'SPI B-3'} data-testid="mm-finish" onChange={(e) => set('finish', e.target.value as MachineSpec['finish'])}
                style={{ background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', fontFamily: 'inherit', fontSize: 12 }}>
                {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="checkbox" checked={!!spec.abrasive} data-testid="mm-abrasive" onChange={(e) => set('abrasive', e.target.checked)} /> abrasiva</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="checkbox" checked={!!spec.corrosive} onChange={(e) => set('corrosive', e.target.checked)} /> corrosiva</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="checkbox" checked={!!spec.mirror} onChange={(e) => set('mirror', e.target.checked)} /> espejo</label>
          </div>
          {/* UNDERCUT LATERAL → MOVIMIENTO (§11.3.6-8): activa la corredera en los planos */}
          <div style={{ borderTop: '1px solid #223046', paddingTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
              <input type="checkbox" data-testid="mm-undercut" checked={!!spec.undercuts?.length}
                onChange={(e) => set('undercuts', e.target.checked ? [{ aProjMm2: 220, strokeMm: 12 }] : undefined)} />
              ⟷ undercut lateral (corredera / side action §11.3.6)
            </label>
            {!!spec.undercuts?.length && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Área proy. del undercut</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" data-testid="mm-uc-area" value={spec.undercuts[0].aProjMm2} step={10}
                      onChange={(e) => set('undercuts', [{ aProjMm2: Number(e.target.value), strokeMm: spec.undercuts![0].strokeMm }])}
                      style={{ width: 92, background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
                    <span style={{ fontSize: 10, opacity: 0.5 }}>mm²</span>
                  </div>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>Carrera (stroke)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" data-testid="mm-uc-stroke" value={spec.undercuts[0].strokeMm} step={1}
                      onChange={(e) => set('undercuts', [{ aProjMm2: spec.undercuts![0].aProjMm2, strokeMm: Number(e.target.value) }])}
                      style={{ width: 92, background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
                    <span style={{ fontSize: 10, opacity: 0.5 }}>mm</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ── RESULTADO ── */}
        <div data-testid="mm-result" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* precio + veredicto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Card label="PRECIO SUGERIDO" value={$(v.precioMoldeUSD)} sub={`costo $${Math.round(c.totalUSD).toLocaleString()} · margen ×${(spec.margin ?? 1.6)}`} big gold />
            <Card label="COSTO POR PIEZA" value={`$${v.costoPiezaUSD.toFixed(3)}`} sub={`ciclo ${pkg.costoPieza.cycleTimeS.toFixed(0)}s`} big />
            <Card label="VEREDICTO" value={v.viable ? 'VIABLE ✓' : 'REVISAR ⚠'} sub={`${v.entregaSemanas} semanas de entrega`} big color={v.viable ? '#59d98c' : '#ff9433'} />
          </div>

          {/* recomendación */}
          <div style={{ background: 'rgba(14,20,30,0.8)', border: '1px solid #223046', borderRadius: 10, padding: '12px 15px' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>RECOMENDACIÓN DE INGENIERÍA</div>
            <div style={{ fontSize: 14, fontWeight: 700 }} data-testid="mm-arch">{r.arch.toUpperCase()} × {r.nCav} cavidad(es) · acero {pkg.metal.metal.key} (DIN {pkg.metal.metal.din})</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>mold base {pkg.base.base.wmm}×{pkg.base.base.lmm} mm · máquina {pkg.maquina?.nombre ?? '—'} {pkg.maquina?.ok ? '✓' : '⚠'} · DFM {pkg.dfm.score}/100</div>
          </div>

          {/* desglose de cotización */}
          <div style={{ background: 'rgba(14,20,30,0.8)', border: '1px solid #223046', borderRadius: 10, padding: '12px 15px' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>COTIZACIÓN DETALLADA (Kazmer §3.3)</div>
            {[
              ['Insertos (material + maquinado + acabado)', c.cavitiesUSD],
              [`Mold base (${c.moldBase.massKg.toFixed(0)} kg)`, c.moldBase.USD],
              ['Customización (colada + agua + eyección + estructura)', c.customization.USD],
            ].map(([k, val]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                <span style={{ opacity: 0.85 }}>{k}</span><b>{$(val as number)}</b>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #2c3a50', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>COSTO DEL MOLDE</span><b style={{ color: GOLD }} data-testid="mm-total">{$(c.totalUSD)}</b>
            </div>
          </div>

          {/* banderas */}
          {v.banderas.length > 0 && (
            <div style={{ background: 'rgba(40,20,10,0.6)', border: '1px solid #7a3f1e', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#ff9433', marginBottom: 5 }}>⚠ BANDERAS DE INGENIERÍA</div>
              {v.banderas.map((b, i) => <div key={i} style={{ fontSize: 11, opacity: 0.9, padding: '2px 0' }}>· {b}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, big, gold, color }: { label: string; value: string; sub?: string; big?: boolean; gold?: boolean; color?: string }) {
  return (
    <div style={{ background: gold ? 'linear-gradient(160deg,rgba(201,162,39,0.15),rgba(14,20,30,0.8))' : 'rgba(14,20,30,0.8)', border: `1px solid ${gold ? GOLD + '66' : '#223046'}`, borderRadius: 10, padding: '12px 15px' }}>
      <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 24 : 16, fontWeight: 800, marginTop: 3, color: color ?? (gold ? GOLD : '#e9eef5') }}>{value}</div>
      {sub && <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
