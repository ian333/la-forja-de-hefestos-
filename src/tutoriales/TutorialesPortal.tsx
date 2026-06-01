/**
 * TutorialesPortal — "Cómo hacer tu tarea con GAIA".
 * Guías por materia, ancladas al plan de estudios real de IPN (ESIME/UPIITA) y
 * UNAM (Facultad de Ingeniería). Enfoque: el alumno abre la herramienta, sigue
 * los pasos, y entrega. Sin teoría de relleno: puro "cómo lo hago".
 */

type Tutorial = {
  area: string;
  materia: string;
  inst: string;        // institución + semestre
  tarea: string;       // la tarea real que resuelve
  tool: string;        // herramienta
  url: string;         // a dónde lleva
  pasos: string[];
};

const TUTORIALES: Tutorial[] = [
  {
    area: 'Matemáticas',
    materia: 'Álgebra Lineal',
    inst: 'IPN ESIME · UNAM FI · 1.º–2.º sem',
    tarea: 'Resolver un sistema de ecuaciones por Gauss-Jordan y entregar el procedimiento completo.',
    tool: 'Resolvedor', url: '/solver.html',
    pasos: [
      'Abre el Resolvedor y elige la pestaña “Sistema lineal”.',
      'Selecciona el tamaño (2×2, 3×3, 4×4) y escribe tu matriz aumentada [A | b].',
      'Pulsa “Resolver”: aparece la solución exacta y cada paso RREF numerado.',
      'Copia los pasos a tu reporte — son exactos (fracciones, sin redondeo), no una caja negra.',
    ],
  },
  {
    area: 'Matemáticas',
    materia: 'Cálculo Diferencial',
    inst: 'IPN · UNAM · 1.º sem',
    tarea: 'Derivar funciones con regla del producto y de la cadena, mostrando el procedimiento.',
    tool: 'Resolvedor', url: '/solver.html',
    pasos: [
      'Abre el Resolvedor → pestaña “Derivada”.',
      'Escribe tu función (por ejemplo x*sin(x) o e^(2x)).',
      'Pulsa “Resolver”: ves la regla aplicada (producto, cadena…) y el resultado simplificado.',
      'Cada paso te dice QUÉ regla usó — para entender, no solo copiar.',
    ],
  },
  {
    area: 'Matemáticas',
    materia: 'Cálculo Integral',
    inst: 'IPN · UNAM · 2.º sem',
    tarea: 'Integrales por tabla y sustitución; identificar cuándo toca integración por partes.',
    tool: 'Resolvedor', url: '/solver.html',
    pasos: [
      'Resolvedor → pestaña “Integral”.',
      'Escribe el integrando (por ejemplo cos(2x) o 2x+3).',
      'Si GAIA puede, te da la primitiva paso a paso. Si requiere una técnica que aún no soporta, te lo dice honestamente (no inventa) — así sabes qué método aplicar tú.',
    ],
  },
  {
    area: 'Física',
    materia: 'Laboratorio de Física · Cinemática',
    inst: 'IPN · UNAM · prepa–2.º sem',
    tarea: 'Reporte de práctica de caída libre (determinación de g) con datos, gráfica y % de error.',
    tool: 'Reporte de lab', url: '/reporte.html',
    pasos: [
      'Abre el lab de física y observa la simulación (es física real, no una animación).',
      'Abre el Generador de Reporte y pulsa “Cargar ejemplo” para ver la estructura: cajetín, objetivo, datos, % de error, conclusiones.',
      'Ajusta tus datos (nombre, número de práctica, grupo, profesor).',
      'Pulsa “Exportar PDF” → te descarga el reporte listo para entregar.',
    ],
  },
  {
    area: 'Física',
    materia: 'Termodinámica · Gas ideal',
    inst: 'IPN · UNAM · 3.º sem',
    tarea: 'Práctica de la relación P–V–T de un gas ideal.',
    tool: 'Lab + Reporte', url: '/physics.html',
    pasos: [
      'Abre el lab y manipula la simulación del gas ideal (volumen, temperatura): observa cómo cambia la presión.',
      'Anota los puntos P–V–T que te pida tu práctica.',
      'Pasa al Generador de Reporte, vacía tus datos en la tabla y exporta el PDF.',
    ],
  },
  {
    area: 'Química',
    materia: 'Química · Estructura de la materia',
    inst: 'prepa · 1.º sem',
    tarea: 'Explicar espectros atómicos y orbitales en tu tarea, con la imagen correcta.',
    tool: 'Labs de átomos', url: '/physics.html',
    pasos: [
      'Abre el lab de átomos / moléculas y elige el elemento o la molécula de tu tarea.',
      'Observa el espectro real y los orbitales (no son dibujos: salen de la física).',
      'Toma la captura y descríbela en tu reporte con el Generador de PDF.',
    ],
  },
  {
    area: 'Diseño · Mecatrónica',
    materia: 'Dibujo Mecánico / CAD',
    inst: 'IPN UPIITA · UNAM FI · 3.º sem',
    tarea: 'Modelar una pieza paramétrica y exportarla para impresión 3D.',
    tool: 'CAD Hefestos', url: '/cad.html',
    pasos: [
      'Abre Hefestos (el CAD). Verás una pieza de muestra en 3D real.',
      'En la barra SOLID → Create agrega primitivas (Caja = 1, Cilindro = 3, Esfera = 2).',
      'Selecciona dos cuerpos y aplica una booleana (Resta) para hacer barrenos.',
      'Usa Variables para parametrizar tus medidas en milímetros (puedes escribir expresiones, ej. lado/2).',
      'Pulsa “STL” para exportar tu pieza lista para imprimir.',
    ],
  },
  {
    area: 'Diseño · Mecatrónica',
    materia: 'Proyecto de robótica',
    inst: 'IPN UPIITA · Mecatrónica',
    tarea: 'Diseñar una pieza de tu robot (estilo InMoov) para imprimir y montarle un servo.',
    tool: 'CAD Hefestos', url: '/cad.html',
    pasos: [
      'En Hefestos, parte de un bloque y réstale los barrenos del servo (cilindros) y el eje.',
      'Redondea las uniones con “Suave” (blend) para que imprima mejor.',
      'Verifica el volumen en la barra de estado (te sirve para estimar material/peso).',
      'Exporta el STL y mándalo a tu impresora 3D. Eso es el proceso completo, sin pagar Fusion.',
    ],
  },
];

const AREAS = ['Matemáticas', 'Física', 'Química', 'Diseño · Mecatrónica'];

const TOOL_COLOR: Record<string, string> = {
  'Resolvedor': '#4FC3F7',
  'Reporte de lab': '#34D399',
  'Lab + Reporte': '#34D399',
  'Labs de átomos': '#A78BFA',
  'CAD Hefestos': '#FDB813',
};

function TutorialCard({ t }: { t: Tutorial }) {
  const accent = TOOL_COLOR[t.tool] || '#4FC3F7';
  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0A0E17] p-6 flex flex-col gap-4 hover:border-[#334155] transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#F1F5F9]">{t.materia}</h3>
          <p className="text-xs font-mono uppercase tracking-wide text-[#64748B] mt-1">{t.inst}</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${accent}1A`, color: accent }}>{t.tool}</span>
      </div>
      <p className="text-sm text-[#94A3B8]"><span className="text-[#CBD5E1] font-semibold">La tarea:</span> {t.tarea}</p>
      <ol className="flex flex-col gap-2">
        {t.pasos.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm text-[#CBD5E1]">
            <span className="shrink-0 grid place-items-center w-5 h-5 rounded-full text-[11px] font-bold mt-0.5"
              style={{ background: `${accent}26`, color: accent }}>{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <a href={t.url}
        className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition"
        style={{ background: accent, color: '#05060A' }}>
        Abrir {t.tool} →
      </a>
    </div>
  );
}

export default function TutorialesPortal() {
  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0]">
      <header className="max-w-6xl mx-auto px-6 pt-10 flex items-center justify-between">
        <a href="/escuela.html" className="font-bold tracking-tight text-[#F1F5F9]">GAIA · Tutoriales</a>
        <a href="/escuela.html" className="text-sm text-[#64748B] hover:text-[#94A3B8] transition">← Escuela</a>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#475569]">Plan de estudios IPN · UNAM</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
          Cómo hacer tu tarea <span className="bg-gradient-to-r from-[#4FC3F7] to-[#FDB813] bg-clip-text text-transparent">con GAIA</span>.
        </h1>
        <p className="mt-4 text-[#94A3B8] max-w-2xl mx-auto">
          No tienes que construir nada. Abre la herramienta, sigue los pasos, entrega.
          Cada guía está pegada a una materia real de tu carrera.
        </p>
      </section>

      <main className="max-w-6xl mx-auto px-6 pb-24 flex flex-col gap-12">
        {AREAS.map((area) => {
          const items = TUTORIALES.filter((t) => t.area === area);
          if (!items.length) return null;
          return (
            <div key={area}>
              <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-[#475569] mb-4">{area}</h2>
              <div className="grid md:grid-cols-2 gap-5">
                {items.map((t, i) => <TutorialCard key={i} t={t} />)}
              </div>
            </div>
          );
        })}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-[#111827] text-center text-sm text-[#475569]">
        GAIA es gratis para estudiantes. Astutos como serpientes, sencillos como palomas. 🜂
      </footer>
    </div>
  );
}
