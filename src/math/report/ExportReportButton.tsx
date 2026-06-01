/**
 * ExportReportButton — boton del header del Math Lab + mini-modal del cajetin.
 *
 * Al exportar:
 *   1) captura el canvas 3D del modulo activo a dataURL PNG (via ReportContext,
 *      que invoca el CanvasCapture montado dentro de <Stage captureMode>),
 *   2) arma un ReporteLab con buildReporte (cajetin + pasos del solver + snapshot),
 *   3) descarga el PDF con descargarReportePDF.
 *
 * Estetica GAIA oscura. El modal recoge los campos del cajetin academico.
 */
import { useState } from 'react';
import { useReport } from './ReportContext';
import { buildReporte } from './buildReporte';
import { descargarReportePDF } from '@/reporte/pdf/generator';
import type { CajetinReporte } from '@/reporte/pdf/types';

const HOY = new Date().toISOString().slice(0, 10);

const DEFAULT_CAJETIN: CajetinReporte = {
  institucion: '',
  carrera: '',
  asignatura: 'Matematicas',
  practicaNumero: '1',
  practicaTitulo: '',
  alumno: '',
  cuentaOBoleta: '',
  grupo: '',
  profesor: '',
  fechaRealizacion: HOY,
  fechaEntrega: HOY,
};

const inputCls =
  'w-full px-2.5 py-1.5 rounded bg-[#05060A] border border-[#1E293B] text-[12px] text-white ' +
  'outline-none focus:border-[#4FC3F7] transition placeholder:text-[#475569]';

export default function ExportReportButton() {
  const { capture, solverResult, moduleMeta, hasCanvas } = useReport();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caj, setCaj] = useState<CajetinReporte>(DEFAULT_CAJETIN);

  function openModal() {
    // Sembrar el titulo de la practica con el nombre del modulo activo.
    setCaj((c) => ({
      ...c,
      practicaTitulo: c.practicaTitulo || moduleMeta?.nombre || 'Practica del Math Lab',
    }));
    setOpen(true);
  }

  function set<K extends keyof CajetinReporte>(k: K, v: CajetinReporte[K]) {
    setCaj((c) => ({ ...c, [k]: v }));
  }

  function exportar() {
    setBusy(true);
    try {
      const snapshot = hasCanvas ? capture() : null;
      const reporte = buildReporte({
        cajetin: caj,
        moduleMeta,
        resultado: solverResult,
        snapshotDataUrl: snapshot,
      });
      const rama = moduleMeta?.rama ?? 'math';
      const id = moduleMeta?.moduleId ?? 'modulo';
      descargarReportePDF(reporte, `lab-${rama}-${id}.pdf`);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        title="Exporta los pasos exactos + un snapshot del canvas 3D a PDF"
        className="text-[11px] font-mono px-2.5 py-1.5 rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition whitespace-nowrap"
      >
        ⤓ Exportar PDF
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-[15px] font-semibold text-white">Exportar reporte PDF</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Incluye los pasos exactos y un snapshot de la viz 3D.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#64748B] hover:text-white text-[18px] leading-none"
              >
                ×
              </button>
            </div>

            {/* Estado de lo que va a llevar el PDF */}
            <div className="mb-4 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="rounded border border-[#1E293B] bg-[#05060A] px-3 py-2">
                <span className="text-[#64748B]">Snapshot 3D: </span>
                <span className={hasCanvas ? 'text-[#34D399]' : 'text-[#EF5350]'}>
                  {hasCanvas ? 'disponible' : 'sin canvas'}
                </span>
              </div>
              <div className="rounded border border-[#1E293B] bg-[#05060A] px-3 py-2">
                <span className="text-[#64748B]">Pasos: </span>
                <span className={solverResult ? 'text-[#34D399]' : 'text-[#94A3B8]'}>
                  {solverResult ? `${solverResult.pasos.length}` : 'no mapeable'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Institucion" full value={caj.institucion} onChange={(v) => set('institucion', v)} placeholder="IPN · UNAM · TecNM" />
              <Field label="Carrera" full value={caj.carrera} onChange={(v) => set('carrera', v)} />
              <Field label="Asignatura" value={caj.asignatura} onChange={(v) => set('asignatura', v)} />
              <Field label="Grupo" value={caj.grupo} onChange={(v) => set('grupo', v)} />
              <Field label="No. practica" value={String(caj.practicaNumero)} onChange={(v) => set('practicaNumero', v)} />
              <Field label="Titulo de la practica" value={caj.practicaTitulo} onChange={(v) => set('practicaTitulo', v)} />
              <Field label="Alumno" value={caj.alumno} onChange={(v) => set('alumno', v)} />
              <Field label="Cuenta / Boleta" value={caj.cuentaOBoleta} onChange={(v) => set('cuentaOBoleta', v)} />
              <Field label="Profesor" full value={caj.profesor} onChange={(v) => set('profesor', v)} />
              <Field label="Realizacion" value={caj.fechaRealizacion} onChange={(v) => set('fechaRealizacion', v)} type="date" />
              <Field label="Entrega" value={caj.fechaEntrega} onChange={(v) => set('fechaEntrega', v)} type="date" />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-[12px] px-4 py-2 rounded border border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155] transition disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={exportar}
                disabled={busy}
                className="text-[12px] px-5 py-2 rounded font-semibold text-[#05060A] transition hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #4FC3F7, #FDB813)' }}
              >
                {busy ? 'Generando…' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="block text-[10px] uppercase tracking-wider text-[#64748B] mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );
}
