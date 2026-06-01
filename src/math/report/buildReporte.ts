/**
 * buildReporte — arma un ReporteLab (estructura del generador PDF) a partir de
 *   - el cajetin que el alumno llena en el modal,
 *   - la identidad del modulo activo (ModuleMeta),
 *   - el resultado del solver (pasos exactos), si lo hay,
 *   - y el snapshot PNG del canvas 3D.
 *
 * El generador (src/reporte/pdf/generator.ts) imprime texto plano (Helvetica /
 * Latin-1): NO renderiza KaTeX. Por eso metemos los pasos como una seccion de
 * texto (titulo + operacion + nota), y el snapshot 3D como imagen embebida.
 * El PDF resultante trae: (a) los pasos legibles + (b) la captura de la viz.
 */
import type { ReporteLab, CajetinReporte, SeccionReporte, TablaReporte } from '@/reporte/pdf/types';
import type { Resultado } from '@/solver/engine';
import type { ModuleMeta } from './ReportContext';

/** Quita comandos LaTeX comunes para que el texto plano del PDF sea legible. */
function latexAtexto(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/\\begin\{[a-z]*matrix\}/gi, '[ ')
    .replace(/\\end\{[a-z]*matrix\}/gi, ' ]')
    .replace(/\\begin\{vmatrix\}/gi, 'det[ ')
    .replace(/\\end\{vmatrix\}/gi, ' ]')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\det/g, 'det')
    .replace(/\\quad/g, '   ')
    .replace(/\\\\/g, ' ; ')
    .replace(/[{}]/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\^\{?([0-9a-zA-Z]+)\}?/g, '^$1')
    .replace(/_\{?([0-9a-zA-Z]+)\}?/g, '_$1')
    .replace(/\\/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Convierte el Resultado del motor en una seccion de texto con los pasos. */
function seccionPasos(resultado: Resultado): SeccionReporte {
  const lineas: string[] = [];

  // Respuesta destacada primero.
  switch (resultado.op) {
    case 'lineal': {
      if (resultado.tipo === 'unica' && resultado.solucion) {
        lineas.push(
          'Solucion: ' +
            resultado.solucion.map((f, i) => `x${i + 1} = ${f.toString()}`).join(',  '),
        );
      } else if (resultado.tipo === 'infinitas') {
        lineas.push('Infinitas soluciones.' + (resultado.nota ? ` ${resultado.nota}` : ''));
      } else {
        lineas.push('El sistema no tiene solucion.' + (resultado.nota ? ` ${resultado.nota}` : ''));
      }
      break;
    }
    case 'determinante':
      lineas.push(`det(A) = ${resultado.valor.toString()}`);
      break;
    case 'derivada':
    case 'integral': {
      if (!resultado.soportado) {
        lineas.push(resultado.nota ?? 'Expresion fuera del alcance del motor.');
      } else if (resultado.resultadoLatex) {
        const pref = resultado.op === 'derivada' ? "f'(x) = " : '∫ = ';
        lineas.push(pref + latexAtexto(resultado.resultadoLatex));
      }
      break;
    }
  }
  lineas.push('');

  // Pasos numerados.
  resultado.pasos.forEach((p, i) => {
    let l = `${i + 1}. ${p.titulo}`;
    if (p.operacion) l += `   ${p.operacion}`;
    lineas.push(l);
    if (p.matrizLatex) {
      const m = latexAtexto(p.matrizLatex);
      if (m) lineas.push(`     ${m}`);
    }
    if (p.nota) lineas.push(`     (${p.nota})`);
  });

  return {
    titulo: 'Resolucion paso a paso (exacta)',
    contenido: lineas.join('\n'),
  };
}

/** Tabla de resultado compacta por tipo de operacion. */
function tablaResultado(resultado: Resultado): TablaReporte | null {
  switch (resultado.op) {
    case 'lineal': {
      if (resultado.tipo === 'unica' && resultado.solucion) {
        return {
          titulo: 'Solucion del sistema',
          headers: ['Variable', 'Valor exacto'],
          rows: resultado.solucion.map((f, i) => [`x${i + 1}`, f.toString()]),
        };
      }
      return null;
    }
    case 'determinante':
      return {
        titulo: 'Determinante',
        headers: ['Cantidad', 'Valor'],
        rows: [['det(A)', resultado.valor.toString()]],
      };
    case 'derivada':
    case 'integral': {
      if (resultado.soportado && resultado.resultadoLatex) {
        return {
          titulo: resultado.op === 'derivada' ? 'Derivada' : 'Integral indefinida',
          headers: ['Operacion', 'Resultado'],
          rows: [[resultado.op === 'derivada' ? "f'(x)" : '∫ f dx', latexAtexto(resultado.resultadoLatex)]],
        };
      }
      return null;
    }
  }
}

export interface BuildReporteArgs {
  cajetin: CajetinReporte;
  moduleMeta: ModuleMeta | null;
  resultado: Resultado | null;
  /** Snapshot PNG del canvas 3D (data URL) o null si no se pudo capturar. */
  snapshotDataUrl: string | null;
}

export function buildReporte({ cajetin, moduleMeta, resultado, snapshotDataUrl }: BuildReporteArgs): ReporteLab {
  const nombre = moduleMeta?.nombre ?? 'Modulo del Math Lab';

  const secciones: SeccionReporte[] = [];
  const tablas: TablaReporte[] = [];

  if (resultado) {
    secciones.push(seccionPasos(resultado));
    const t = tablaResultado(resultado);
    if (t) tablas.push(t);
  }

  const imagenes = snapshotDataUrl
    ? [{ titulo: `Visualizacion 3D — ${nombre}`, dataUrl: snapshotDataUrl }]
    : [];

  return {
    cajetin,
    cuerpo: {
      objetivo: `Visualizar y resolver paso a paso: ${nombre}.`,
      marcoTeorico:
        moduleMeta?.marco ??
        'Modulo interactivo del Math Lab de GAIA: la viz 3D y el resolvedor simbolico exacto muestran el mismo problema desde dos angulos (geometrico y algebraico).',
      materialEquipo:
        'GAIA Math Lab (university.gaiaprime.com.mx) — navegador con WebGL. Motor de algebra exacta (fracciones racionales) y render R3F.',
      procedimiento:
        `Se cargo el modulo "${nombre}" en el Math Lab, se ajusto la entrada en el panel, ` +
        'se observo la visualizacion 3D y se generaron los pasos exactos con el resolvedor simbolico ' +
        '(sin caja negra). El snapshot del canvas y los pasos se exportaron a este reporte.',
      secciones: secciones.length ? secciones : undefined,
      tablas: tablas.length ? tablas : undefined,
      imagenes: imagenes.length ? imagenes : undefined,
      analisis: resultado
        ? 'La viz 3D y la resolucion simbolica coinciden por construccion: ambas parten del mismo input del modulo. Cada paso es exacto y verificable.'
        : 'Este modulo aporta intuicion 3D; el resolvedor simbolico paso a paso aun no cubre esta operacion.',
      conclusiones:
        'El alumno conecto la intuicion visual (3D) con el procedimiento exacto (algebraico) del mismo problema, y obtuvo un entregable reproducible.',
      referencias: [
        'GAIA — La Forja, Math Lab. university.gaiaprime.com.mx',
      ],
    },
  };
}
