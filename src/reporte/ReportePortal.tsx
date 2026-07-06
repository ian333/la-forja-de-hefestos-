/**
 * ReportePortal — el "órgano de entrega" de GAIA.
 *
 * Convierte lo que el alumno produce en GAIA (resultados de sims, pasos del
 * solver, datos medidos) en un REPORTE DE LABORATORIO en PDF que ENTREGA.
 *
 * Esta es solo la UI. Consume la librería ya existente:
 *   - descargarReportePDF(r, nombre)  → genera y descarga el PDF.
 *   - REPORTE_EJEMPLO                 → fixture real (Caída libre) para el wow.
 *
 * Roadmap (chip "pronto"): autollenado desde una simulación o desde el
 * resolvedor paso a paso, para que el reporte salga sin teclear nada.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CajetinReporte, ReporteLab, TablaReporte } from './pdf/types';
import { descargarReportePDF } from './pdf/generator';
import { addReport } from '@/lib/progress';
import { REPORTE_EJEMPLO } from './pdf/samples';

const GAIA_GRADIENT = 'linear-gradient(135deg, #4FC3F7 0%, #7E57C2 50%, #F472B6 100%)';

// ─────────────────────────────────────────────────────────────────────────
//  Estado del formulario (forma plana, fácil de bindear a inputs/textareas).
// ─────────────────────────────────────────────────────────────────────────

type Tabla = { titulo: string; headers: string[]; rows: string[][] };

type FormState = {
  cajetin: CajetinReporte;
  objetivo: string;
  marcoTeorico: string;
  materialEquipo: string;
  procedimiento: string;
  analisis: string;
  conclusiones: string;
  referencias: string; // una referencia por línea
  tabla: Tabla;
};

const CAJETIN_VACIO: CajetinReporte = {
  institucion: '',
  carrera: '',
  asignatura: '',
  practicaNumero: '',
  practicaTitulo: '',
  alumno: '',
  cuentaOBoleta: '',
  grupo: '',
  profesor: '',
  fechaRealizacion: '',
  fechaEntrega: '',
};

const FORM_VACIO: FormState = {
  cajetin: { ...CAJETIN_VACIO },
  objetivo: '',
  marcoTeorico: '',
  materialEquipo: '',
  procedimiento: '',
  analisis: '',
  conclusiones: '',
  referencias: '',
  tabla: {
    titulo: 'Tabla 1. Datos de la práctica.',
    headers: ['Columna 1', 'Columna 2', 'Columna 3'],
    rows: [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ],
  },
};

/** Convierte REPORTE_EJEMPLO (forma rica) → estado plano del formulario. */
function ejemploAForm(r: ReporteLab): FormState {
  const t = r.cuerpo.tablas?.[0];
  return {
    cajetin: {
      ...r.cajetin,
      practicaNumero: String(r.cajetin.practicaNumero),
    },
    objetivo: r.cuerpo.objetivo,
    marcoTeorico: r.cuerpo.marcoTeorico,
    materialEquipo: r.cuerpo.materialEquipo,
    procedimiento: r.cuerpo.procedimiento,
    analisis: r.cuerpo.analisis,
    conclusiones: r.cuerpo.conclusiones,
    referencias: (r.cuerpo.referencias ?? []).join('\n'),
    tabla: t
      ? {
          titulo: t.titulo,
          headers: [...t.headers],
          rows: t.rows.map((row) => row.map((c) => String(c))),
        }
      : { ...FORM_VACIO.tabla, rows: FORM_VACIO.tabla.rows.map((r2) => [...r2]) },
  };
}

/** Convierte el estado plano del formulario → ReporteLab para la librería. */
function formAReporte(f: FormState): ReporteLab {
  // La tabla solo se incluye si tiene al menos una celda con contenido.
  const filasUtiles = f.tabla.rows.filter((row) => row.some((c) => c.trim() !== ''));
  const tablas: TablaReporte[] = filasUtiles.length
    ? [
        {
          titulo: f.tabla.titulo.trim() || 'Tabla de resultados',
          headers: f.tabla.headers.map((h) => h.trim() || ' '),
          rows: filasUtiles.map((row) => row.map((c) => c.trim())),
        },
      ]
    : [];

  // Conserva las imágenes/figuras del ejemplo si la tabla coincide con él
  // (para que "Cargar ejemplo → Exportar" ejercite el path de addImage).
  const imagenes =
    f.objetivo === REPORTE_EJEMPLO.cuerpo.objetivo
      ? REPORTE_EJEMPLO.cuerpo.imagenes
      : undefined;

  const referencias = f.referencias
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    cajetin: f.cajetin,
    cuerpo: {
      objetivo: f.objetivo,
      marcoTeorico: f.marcoTeorico,
      materialEquipo: f.materialEquipo,
      procedimiento: f.procedimiento,
      tablas,
      imagenes,
      analisis: f.analisis,
      conclusiones: f.conclusiones,
      referencias: referencias.length ? referencias : undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────

export default function ReportePortal() {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // El portal scrollea (main.css ata body a overflow:hidden para apps full-screen).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { ho: html.style.overflow, hh: html.style.height, bo: body.style.overflow, bh: body.style.height };
    html.style.overflow = 'auto'; html.style.height = 'auto';
    body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.ho; html.style.height = prev.hh;
      body.style.overflow = prev.bo; body.style.height = prev.bh;
    };
  }, []);

  // Limpia el aviso "ok" tras unos segundos.
  useEffect(() => {
    if (!ok) return;
    const id = setTimeout(() => setOk(''), 4000);
    return () => clearTimeout(id);
  }, [ok]);

  const setCajetin = (k: keyof CajetinReporte, v: string) =>
    setForm((f) => ({ ...f, cajetin: { ...f.cajetin, [k]: v } }));

  const setCampo = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function cargarEjemplo() {
    setError('');
    setForm(ejemploAForm(REPORTE_EJEMPLO));
    setOk('Cargamos la práctica de ejemplo (Caída libre). Ya puedes exportar el PDF.');
  }

  function limpiar() {
    setError(''); setOk('');
    setForm({ ...FORM_VACIO, cajetin: { ...CAJETIN_VACIO }, tabla: { ...FORM_VACIO.tabla, rows: FORM_VACIO.tabla.rows.map((r) => [...r]) } });
  }

  function exportar() {
    setError(''); setOk('');
    // Validación mínima amable: que haya al menos título o alumno o un objetivo.
    const c = form.cajetin;
    if (!c.practicaTitulo.trim() && !c.alumno.trim() && !form.objetivo.trim()) {
      setError('Llena al menos el título de la práctica, tu nombre o el objetivo. O usa "Cargar ejemplo" para ver cómo queda.');
      return;
    }
    try {
      const reporte = formAReporte(form);
      const slugAlumno = c.alumno.trim().split(/\s+/)[0]?.toLowerCase() || 'gaia';
      const num = String(c.practicaNumero).trim() || 's-n';
      descargarReportePDF(reporte, `reporte-practica-${num}-${slugAlumno}.pdf`);
      addReport(); // progreso: reporte real generado (cuenta en tu recorrido)
      setOk('Generamos tu PDF. Revisa tu carpeta de descargas.');
    } catch (e: any) {
      setError('No pudimos generar el PDF: ' + (e?.message || 'error desconocido') + '. Revisa los datos e intenta de nuevo.');
    }
  }

  // ── Edición de la tabla ──
  function setCelda(ri: number, ci: number, v: string) {
    setForm((f) => {
      const rows = f.tabla.rows.map((r) => [...r]);
      rows[ri][ci] = v;
      return { ...f, tabla: { ...f.tabla, rows } };
    });
  }
  function setHeader(ci: number, v: string) {
    setForm((f) => {
      const headers = [...f.tabla.headers];
      headers[ci] = v;
      return { ...f, tabla: { ...f.tabla, headers } };
    });
  }
  function agregarFila() {
    setForm((f) => ({
      ...f,
      tabla: { ...f.tabla, rows: [...f.tabla.rows, f.tabla.headers.map(() => '')] },
    }));
  }
  function quitarFila(ri: number) {
    setForm((f) => {
      if (f.tabla.rows.length <= 1) return f;
      return { ...f, tabla: { ...f.tabla, rows: f.tabla.rows.filter((_, i) => i !== ri) } };
    });
  }
  function agregarColumna() {
    setForm((f) => ({
      ...f,
      tabla: {
        ...f.tabla,
        headers: [...f.tabla.headers, `Columna ${f.tabla.headers.length + 1}`],
        rows: f.tabla.rows.map((r) => [...r, '']),
      },
    }));
  }
  function quitarColumna(ci: number) {
    setForm((f) => {
      if (f.tabla.headers.length <= 1) return f;
      return {
        ...f,
        tabla: {
          ...f.tabla,
          headers: f.tabla.headers.filter((_, i) => i !== ci),
          rows: f.tabla.rows.map((r) => r.filter((_, i) => i !== ci)),
        },
      };
    });
  }

  const cajetinLleno = useMemo(
    () => Object.values(form.cajetin).filter((v) => String(v).trim() !== '').length,
    [form.cajetin],
  );

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Luces ambientales */}
      <div className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-25 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-25%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1100px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-[#05060A] text-[20px]"
            style={{ background: GAIA_GRADIENT }}>Γ</div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">reporte de laboratorio</div>
          </div>
        </a>
        <div className="flex items-center gap-4 text-[12px] font-mono">
          <a href="/escuela.html" className="text-[#94A3B8] hover:text-white transition">Escuela</a>
          <a href="/solver.html" className="text-[#94A3B8] hover:text-white transition">Resolver</a>
          <a href="/" className="text-[#94A3B8] hover:text-white transition">← Volver</a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-[820px] mx-auto px-6 pt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1E293B] bg-[#0B0F17] text-[11px] font-mono text-[#94A3B8] mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          el órgano de entrega de GAIA
        </div>
        <h1 className="text-[34px] md:text-[46px] font-extrabold leading-[1.05] tracking-tight text-white">
          Convierte tu trabajo en GAIA en un<br className="hidden md:block" />{' '}
          <span style={{ backgroundImage: GAIA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            reporte que ENTREGAS.
          </span>
        </h1>
        <p className="mt-4 text-[15px] text-[#94A3B8] max-w-[640px] mx-auto leading-relaxed">
          Lo que mediste, simulaste o resolviste paso a paso se queda en pantalla.
          Aquí lo vuelves un PDF presentable — con cajetín, tablas, gráficas y % de error —
          listo para subir a la plataforma de tu escuela. En dos clics.
        </p>

        {/* Chip de roadmap */}
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#7E57C2]/40 bg-[#7E57C2]/10 text-[12px] text-[#C4B5FD]">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-[2px] rounded-full bg-[#7E57C2]/30 text-[#DDD6FE]">pronto</span>
          Autollenado desde una simulación o desde el resolvedor paso a paso
        </div>
      </section>

      {/* Barra de acciones (sticky) */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[#05060A]/80 border-y border-[#0F172A]">
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <button onClick={cargarEjemplo}
            className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#05060A] transition hover:opacity-90"
            style={{ background: GAIA_GRADIENT }}>
            ✨ Cargar ejemplo
          </button>
          <button onClick={exportar}
            className="px-5 py-2.5 rounded-xl font-semibold text-[14px] bg-white text-[#05060A] transition hover:opacity-90">
            ⬇ Exportar PDF
          </button>
          <button onClick={limpiar}
            className="px-4 py-2.5 rounded-xl font-medium text-[13px] border border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white transition">
            Limpiar
          </button>
          <div className="ml-auto text-[11px] font-mono text-[#64748B]">
            cajetín: {cajetinLleno}/11 campos
          </div>
        </div>
      </div>

      {/* Avisos */}
      {(error || ok) && (
        <div className="relative z-10 max-w-[1100px] mx-auto px-6 pt-4">
          {error && (
            <div className="rounded-xl px-4 py-3 text-[13px] border bg-[#FB7185]/10 border-[#FB7185]/40 text-[#FECDD3]">
              {error}
            </div>
          )}
          {ok && (
            <div className="rounded-xl px-4 py-3 text-[13px] border bg-[#34D399]/10 border-[#34D399]/40 text-[#A7F3D0]">
              {ok}
            </div>
          )}
        </div>
      )}

      {/* Formulario */}
      <main className="relative z-10 max-w-[1100px] mx-auto px-6 py-8 grid gap-6">
        {/* ── CAJETÍN ── */}
        <Card titulo="Cajetín — identificación" hint="El recuadro que va arriba de la primera página (institución, práctica, alumno, profesor, fechas).">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Institución" value={form.cajetin.institucion} onChange={(v) => setCajetin('institucion', v)} placeholder="Instituto Politécnico Nacional — ESIME" wide />
            <Field label="Carrera" value={form.cajetin.carrera} onChange={(v) => setCajetin('carrera', v)} placeholder="Ing. en Comunicaciones y Electrónica" />
            <Field label="Asignatura" value={form.cajetin.asignatura} onChange={(v) => setCajetin('asignatura', v)} placeholder="Física Clásica (Laboratorio)" />
            <Field label="No. de práctica" value={String(form.cajetin.practicaNumero)} onChange={(v) => setCajetin('practicaNumero', v)} placeholder="3" />
            <Field label="Título de la práctica" value={form.cajetin.practicaTitulo} onChange={(v) => setCajetin('practicaTitulo', v)} placeholder="Caída libre — determinación de g" />
            <Field label="Alumno" value={form.cajetin.alumno} onChange={(v) => setCajetin('alumno', v)} placeholder="Nombre completo" />
            <Field label="Cuenta / Boleta" value={form.cajetin.cuentaOBoleta} onChange={(v) => setCajetin('cuentaOBoleta', v)} placeholder="2024630145" />
            <Field label="Grupo" value={form.cajetin.grupo} onChange={(v) => setCajetin('grupo', v)} placeholder="2CV3" />
            <Field label="Profesor" value={form.cajetin.profesor} onChange={(v) => setCajetin('profesor', v)} placeholder="M. en C. Jorge Ramírez" />
            <Field label="Fecha de realización" value={form.cajetin.fechaRealizacion} onChange={(v) => setCajetin('fechaRealizacion', v)} placeholder="15 de mayo de 2026" />
            <Field label="Fecha de entrega" value={form.cajetin.fechaEntrega} onChange={(v) => setCajetin('fechaEntrega', v)} placeholder="22 de mayo de 2026" />
          </div>
        </Card>

        {/* ── SECCIONES ── */}
        <Card titulo="Objetivo">
          <Area value={form.objetivo} onChange={(v) => setCampo('objetivo', v)} rows={3}
            placeholder="¿Qué se busca demostrar o medir en esta práctica?" />
        </Card>

        <Card titulo="Marco teórico" hint="Puedes escribir las fórmulas en texto plano, p. ej. y = y0 + v0 t - (1/2) g t^2.">
          <Area value={form.marcoTeorico} onChange={(v) => setCampo('marcoTeorico', v)} rows={6}
            placeholder="Teoría, ecuaciones y referencias [1], [2] que sustentan la práctica." />
        </Card>

        <Card titulo="Material y equipo">
          <Area value={form.materialEquipo} onChange={(v) => setCampo('materialEquipo', v)} rows={4}
            placeholder="- 1 generador de chispa&#10;- 1 plomada de 200 g&#10;- 1 regla graduada (1 mm)" />
        </Card>

        <Card titulo="Procedimiento">
          <Area value={form.procedimiento} onChange={(v) => setCampo('procedimiento', v)} rows={5}
            placeholder="1. Se montó el soporte…&#10;2. Se liberó la plomada desde el reposo…" />
        </Card>

        {/* ── TABLA EDITABLE ── */}
        <Card titulo="Resultados — tabla de datos" hint="Edita encabezados y celdas. Agrega o quita filas y columnas. Las filas vacías se omiten en el PDF.">
          <input
            value={form.tabla.titulo}
            onChange={(e) => setForm((f) => ({ ...f, tabla: { ...f.tabla, titulo: e.target.value } }))}
            placeholder="Tabla 1. Título de la tabla."
            className="w-full mb-3 px-3 py-2 rounded-lg bg-[#05060A] border border-[#1E293B] text-[13px] text-white outline-none focus:border-[#4FC3F7] transition"
          />
          <div className="overflow-x-auto rounded-lg border border-[#1E293B]">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {form.tabla.headers.map((h, ci) => (
                    <th key={ci} className="p-1.5 bg-[#0B0F17] border-b border-[#1E293B] min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <input
                          value={h}
                          onChange={(e) => setHeader(ci, e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#0F1622] border border-[#1E293B] text-[12px] font-semibold text-[#CBD5E1] outline-none focus:border-[#4FC3F7] transition"
                        />
                        <button onClick={() => quitarColumna(ci)} title="Quitar columna"
                          className="shrink-0 w-6 h-6 rounded text-[#64748B] hover:text-[#FB7185] hover:bg-[#FB7185]/10 transition">×</button>
                      </div>
                    </th>
                  ))}
                  <th className="p-1.5 bg-[#0B0F17] border-b border-[#1E293B] w-8" />
                </tr>
              </thead>
              <tbody>
                {form.tabla.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-1 border-b border-[#0F172A]">
                        <input
                          value={cell}
                          onChange={(e) => setCelda(ri, ci, e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#05060A] border border-transparent text-[12px] text-[#E2E8F0] outline-none focus:border-[#4FC3F7] hover:border-[#1E293B] transition"
                        />
                      </td>
                    ))}
                    <td className="p-1 border-b border-[#0F172A] text-center">
                      <button onClick={() => quitarFila(ri)} title="Quitar fila"
                        className="w-6 h-6 rounded text-[#64748B] hover:text-[#FB7185] hover:bg-[#FB7185]/10 transition">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={agregarFila}
              className="px-3 py-1.5 rounded-lg text-[12px] border border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7] hover:text-white transition">+ Fila</button>
            <button onClick={agregarColumna}
              className="px-3 py-1.5 rounded-lg text-[12px] border border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7] hover:text-white transition">+ Columna</button>
          </div>
        </Card>

        {/* ── ANÁLISIS / CONCLUSIONES / REFERENCIAS ── */}
        <Card titulo="Análisis" hint="Aquí van los cálculos y el % de error: % error = |medido − ref| / ref × 100.">
          <Area value={form.analisis} onChange={(v) => setCampo('analisis', v)} rows={5}
            placeholder="Interpretación de los datos, ajuste, y porcentaje de error contra el valor de referencia." />
        </Card>

        <Card titulo="Conclusiones">
          <Area value={form.conclusiones} onChange={(v) => setCampo('conclusiones', v)} rows={4}
            placeholder="¿Se cumplió el objetivo? ¿Qué tan buena fue la medición? ¿Qué mejorarías?" />
        </Card>

        <Card titulo="Referencias" hint="Una referencia por línea.">
          <Area value={form.referencias} onChange={(v) => setCampo('referencias', v)} rows={3}
            placeholder="Serway & Jewett, Física para ciencias e ingeniería, vol. 1, 10a ed.&#10;Young & Freedman, Sears y Zemansky: Física universitaria, vol. 1." />
        </Card>

        {/* CTA inferior */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-4">
          <button onClick={exportar}
            className="px-6 py-3 rounded-xl font-semibold text-[15px] text-[#05060A] transition hover:opacity-90"
            style={{ background: GAIA_GRADIENT }}>
            ⬇ Exportar PDF
          </button>
          <button onClick={cargarEjemplo}
            className="px-5 py-3 rounded-xl font-medium text-[14px] border border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white transition">
            ✨ Cargar ejemplo
          </button>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#0F172A] py-6 text-center text-[11px] text-[#475569] font-mono">
        Γ GAIA · El reporte es lo que entregas — y por lo que GAIA recibe crédito.
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Subcomponentes de UI
// ─────────────────────────────────────────────────────────────────────────

function Card({ titulo, hint, children }: { titulo: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#1E293B] bg-[#0A0D14]/80 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[15px] font-bold text-white">{titulo}</h2>
      </div>
      {hint && <p className="text-[12px] text-[#64748B] -mt-2 mb-3 leading-snug">{hint}</p>}
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, wide,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? 'md:col-span-2' : ''}`}>
      <span className="block text-[11px] font-mono uppercase tracking-wider text-[#64748B] mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-[#05060A] border border-[#1E293B] text-[13px] text-white outline-none focus:border-[#4FC3F7] transition placeholder:text-[#475569]"
      />
    </label>
  );
}

function Area({
  value, onChange, placeholder, rows,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-lg bg-[#05060A] border border-[#1E293B] text-[13px] text-[#E2E8F0] leading-relaxed outline-none focus:border-[#4FC3F7] transition placeholder:text-[#475569] resize-y"
    />
  );
}
