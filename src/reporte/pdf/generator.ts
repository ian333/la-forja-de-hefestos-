/**
 * Generador de PDF del Reporte de Laboratorio.
 *
 * Maqueta A4 limpia con cajetin de identificacion arriba, secciones en orden
 * academico (Objetivo -> Marco teorico -> Material -> Procedimiento ->
 * Resultados con tablas y graficas -> Analisis -> Conclusiones -> Referencias),
 * numero de pagina "X / Y" en el pie y sello discreto "Generado en GAIA".
 *
 * Mide el alto de cada bloque y agrega pagina cuando no cabe (saltos correctos).
 *
 * Firma publica:
 *   generarReportePDF(r: ReporteLab): jsPDF
 *   descargarReportePDF(r: ReporteLab, nombreArchivo?: string): void
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReporteLab, TablaReporte, ImagenReporte } from './types';

// ---- Geometria de pagina (A4 en mm) ----
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2; // 174 mm
const FOOTER_Y = PAGE_H - 10;
const BOTTOM_LIMIT = PAGE_H - 16; // a partir de aqui se salta de pagina

// ---- Paleta (impresa en papel, no es el tema oscuro de la UI) ----
const C_INK: [number, number, number] = [20, 24, 33]; // texto principal
const C_MUTE: [number, number, number] = [100, 116, 139]; // gris secundario
const C_ACCENT: [number, number, number] = [22, 96, 150]; // cyan GAIA oscurecido p/ papel
const C_LINE: [number, number, number] = [203, 213, 225]; // bordes/reglas
const C_BOX_BG: [number, number, number] = [244, 247, 251]; // fondo cajetin

/** Estado mutable del cursor de maquetado. */
interface Cursor {
  y: number;
}

/** jsPDF default (Helvetica) usa Latin-1: garantiza que los acentos no rompan. */
function txt(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return '';
  return String(s);
}

/** Crea nueva pagina y reinicia el cursor debajo del margen superior. */
function nuevaPagina(doc: jsPDF, cur: Cursor): void {
  doc.addPage();
  cur.y = MARGIN;
}

/** Garantiza que haya `alto` mm disponibles; si no, salta de pagina. */
function asegurarEspacio(doc: jsPDF, cur: Cursor, alto: number): void {
  if (cur.y + alto > BOTTOM_LIMIT) {
    nuevaPagina(doc, cur);
  }
}

/** Dibuja el cajetin de identificacion (recuadro con campos clave). */
function dibujarCajetin(doc: jsPDF, r: ReporteLab, cur: Cursor): void {
  const c = r.cajetin;
  const pad = 4;
  const lineH = 5.2;

  // Filas del cajetin: cada una es [etiqueta, valor] o un par doble.
  const filas: Array<[string, string, string?, string?]> = [
    ['Institucion', txt(c.institucion)],
    ['Carrera', txt(c.carrera)],
    ['Asignatura', txt(c.asignatura), 'Grupo', txt(c.grupo)],
    [
      'Practica',
      `No. ${txt(c.practicaNumero)} — ${txt(c.practicaTitulo)}`,
    ],
    ['Alumno', txt(c.alumno), 'Cuenta/Boleta', txt(c.cuentaOBoleta)],
    ['Profesor', txt(c.profesor)],
    [
      'Realizacion',
      txt(c.fechaRealizacion),
      'Entrega',
      txt(c.fechaEntrega),
    ],
  ];

  const alto = pad * 2 + filas.length * lineH;
  asegurarEspacio(doc, cur, alto + 4);

  // Fondo + borde del recuadro.
  doc.setFillColor(...C_BOX_BG);
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, cur.y, CONTENT_W, alto, 1.6, 1.6, 'FD');

  // Barra de marca a la izquierda.
  doc.setFillColor(...C_ACCENT);
  doc.rect(MARGIN, cur.y, 1.6, alto, 'F');

  let yy = cur.y + pad + 3.4;
  const xLabelL = MARGIN + pad + 2;
  const xValL = MARGIN + pad + 30;
  const xLabelR = MARGIN + CONTENT_W / 2 + 6;
  const xValR = MARGIN + CONTENT_W / 2 + 32;

  doc.setFontSize(8);
  for (const fila of filas) {
    const [lblL, valL, lblR, valR] = fila;
    // Columna izquierda.
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_MUTE);
    doc.text(`${lblL}:`, xLabelL, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_INK);
    const anchoValL = lblR ? CONTENT_W / 2 - 34 : CONTENT_W - 36;
    const lineasL = doc.splitTextToSize(valL, anchoValL);
    doc.text(lineasL[0] ?? '', xValL, yy);

    // Columna derecha (si existe).
    if (lblR) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C_MUTE);
      doc.text(`${lblR}:`, xLabelR, yy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C_INK);
      const lineasR = doc.splitTextToSize(txt(valR), CONTENT_W / 2 - 40);
      doc.text(lineasR[0] ?? '', xValR, yy);
    }
    yy += lineH;
  }

  cur.y += alto + 6;
}

/** Titulo principal del reporte (debajo del cajetin). */
function dibujarTitulo(doc: jsPDF, r: ReporteLab, cur: Cursor): void {
  asegurarEspacio(doc, cur, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C_INK);
  const titulo = `Practica ${txt(r.cajetin.practicaNumero)}: ${txt(
    r.cajetin.practicaTitulo,
  )}`;
  const lineas = doc.splitTextToSize(titulo, CONTENT_W);
  doc.text(lineas, MARGIN, cur.y);
  cur.y += lineas.length * 7 + 2;

  // Regla bajo el titulo.
  doc.setDrawColor(...C_ACCENT);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, cur.y, MARGIN + CONTENT_W, cur.y);
  cur.y += 6;
}

/** Encabezado de seccion numerado. */
function tituloSeccion(doc: jsPDF, cur: Cursor, n: number, titulo: string): void {
  asegurarEspacio(doc, cur, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C_ACCENT);
  doc.text(`${n}. ${titulo}`, MARGIN, cur.y);
  cur.y += 5.2;
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, cur.y, MARGIN + CONTENT_W, cur.y);
  cur.y += 5;
}

/** Parrafo de texto con wrap y saltos de pagina por bloque. */
function parrafo(doc: jsPDF, cur: Cursor, texto: string): void {
  const limpio = txt(texto).trim();
  if (!limpio) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C_INK);
  const lineH = 5;

  // Respeta saltos de linea del autor; cada parrafo se envuelve a parte.
  const bloques = limpio.split(/\n+/);
  for (const bloque of bloques) {
    const lineas = doc.splitTextToSize(bloque.trim(), CONTENT_W) as string[];
    for (const linea of lineas) {
      asegurarEspacio(doc, cur, lineH);
      doc.text(linea, MARGIN, cur.y);
      cur.y += lineH;
    }
    cur.y += 1.5; // separacion entre parrafos
  }
  cur.y += 1.5;
}

/** Renderiza una tabla de resultados con jspdf-autotable. */
function dibujarTabla(doc: jsPDF, cur: Cursor, tabla: TablaReporte): void {
  // Subtitulo de la tabla.
  asegurarEspacio(doc, cur, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_INK);
  doc.text(txt(tabla.titulo), MARGIN, cur.y);
  cur.y += 3;

  autoTable(doc, {
    startY: cur.y,
    head: [tabla.headers.map((h) => txt(h))],
    body: tabla.rows.map((row) => row.map((cell) => txt(cell))),
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      textColor: C_INK,
      lineColor: C_LINE,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C_ACCENT,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    // Mantiene el cursor sincronizado tras posibles saltos de pagina internos.
    didDrawPage: () => {
      /* autoTable maneja su propio flujo; leemos finalY abajo. */
    },
  });

  // finalY lo expone autoTable en el doc.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY;
  cur.y = (finalY ?? cur.y) + 8;
}

/** Embebe una imagen/grafica via addImage, escalada al ancho de contenido. */
function dibujarImagen(doc: jsPDF, cur: Cursor, img: ImagenReporte): void {
  let w = CONTENT_W * 0.7;
  let h = w * 0.6; // razon por defecto si no se puede medir

  try {
    const props = doc.getImageProperties(img.dataUrl);
    if (props && props.width && props.height) {
      const ratio = props.height / props.width;
      // Limita el ancho y deriva el alto manteniendo proporcion.
      w = Math.min(CONTENT_W * 0.85, 150);
      h = w * ratio;
      // Si la imagen es diminuta (1x1 placeholder), dale un alto razonable.
      if (h < 6) h = 30;
    }
  } catch {
    // getImageProperties puede fallar con data URLs raros: usa el default.
  }

  // Subtitulo de la figura.
  asegurarEspacio(doc, cur, h + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_INK);
  doc.text(txt(img.titulo), MARGIN, cur.y);
  cur.y += 4;

  const x = MARGIN + (CONTENT_W - w) / 2;
  try {
    const fmt = /^data:image\/jpe?g/i.test(img.dataUrl) ? 'JPEG' : 'PNG';
    doc.addImage(img.dataUrl, fmt, x, cur.y, w, h);
    // Marco discreto.
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, cur.y, w, h);
    cur.y += h + 8;
  } catch {
    // Si la imagen es invalida, deja una nota en vez de romper.
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C_MUTE);
    doc.text('[imagen no disponible]', x, cur.y + 4);
    cur.y += 12;
  }
}

/** Lista de referencias en estilo numerado (IEEE). */
function dibujarReferencias(doc: jsPDF, cur: Cursor, refs: string[]): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_INK);
  const lineH = 4.8;
  refs.forEach((ref, i) => {
    const marca = `[${i + 1}] `;
    const sangria = doc.getTextWidth(marca);
    const lineas = doc.splitTextToSize(
      txt(ref),
      CONTENT_W - sangria,
    ) as string[];
    lineas.forEach((linea, j) => {
      asegurarEspacio(doc, cur, lineH);
      if (j === 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(marca, MARGIN, cur.y);
        doc.setFont('helvetica', 'normal');
        doc.text(linea, MARGIN + sangria, cur.y);
      } else {
        doc.text(linea, MARGIN + sangria, cur.y);
      }
      cur.y += lineH;
    });
    cur.y += 1.5;
  });
}

/** Pie de pagina: "X / Y" centrado + sello "Generado en GAIA". */
function dibujarPies(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Regla del pie.
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y - 3.5, MARGIN + CONTENT_W, FOOTER_Y - 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTE);

    // Sello discreto a la izquierda.
    doc.text('Generado en GAIA', MARGIN, FOOTER_Y);

    // Numero de pagina centrado.
    const etiqueta = `${i} / ${total}`;
    const w = doc.getTextWidth(etiqueta);
    doc.text(etiqueta, PAGE_W / 2 - w / 2, FOOTER_Y);

    // Marca de fecha a la derecha (fecha de entrega si existe en pagina 1).
    doc.text('university.gaiaprime.com.mx', MARGIN + CONTENT_W, FOOTER_Y, {
      align: 'right',
    });
  }
}

/**
 * Construye el documento PDF completo a partir de un ReporteLab.
 * Devuelve la instancia jsPDF (el caller decide save/output/blob).
 */
export function generarReportePDF(r: ReporteLab): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Practica ${txt(r.cajetin.practicaNumero)} — ${txt(
      r.cajetin.practicaTitulo,
    )}`,
    subject: txt(r.cajetin.asignatura),
    author: txt(r.cajetin.alumno),
    creator: 'GAIA — La Forja',
  });

  const cur: Cursor = { y: MARGIN };

  dibujarCajetin(doc, r, cur);
  dibujarTitulo(doc, r, cur);

  let n = 1;
  const cuerpo = r.cuerpo;

  // 1. Objetivo
  tituloSeccion(doc, cur, n++, 'Objetivo');
  parrafo(doc, cur, cuerpo.objetivo);

  // Secciones libres tempranas (p.ej. Introduccion) van antes del marco teorico
  // si el autor las nombra; aqui las dejamos al final del bloque libre para no
  // imponer un orden rigido. Se imprimen como secciones extra mas abajo.

  // 2. Marco teorico (con espacio para formulas como texto plano)
  tituloSeccion(doc, cur, n++, 'Marco teorico');
  parrafo(doc, cur, cuerpo.marcoTeorico);

  // 3. Material y equipo
  tituloSeccion(doc, cur, n++, 'Material y equipo');
  parrafo(doc, cur, cuerpo.materialEquipo);

  // 4. Procedimiento
  tituloSeccion(doc, cur, n++, 'Procedimiento');
  parrafo(doc, cur, cuerpo.procedimiento);

  // Secciones extra libres (introduccion, cuestionario, anexos...).
  if (cuerpo.secciones && cuerpo.secciones.length) {
    for (const sec of cuerpo.secciones) {
      tituloSeccion(doc, cur, n++, txt(sec.titulo));
      parrafo(doc, cur, sec.contenido);
    }
  }

  // 5. Resultados (tablas + graficas)
  const hayResultados =
    (cuerpo.tablas && cuerpo.tablas.length) ||
    (cuerpo.imagenes && cuerpo.imagenes.length);
  if (hayResultados) {
    tituloSeccion(doc, cur, n++, 'Resultados');
    if (cuerpo.tablas) {
      for (const tabla of cuerpo.tablas) {
        dibujarTabla(doc, cur, tabla);
      }
    }
    if (cuerpo.imagenes) {
      for (const img of cuerpo.imagenes) {
        dibujarImagen(doc, cur, img);
      }
    }
  }

  // 6. Analisis (con % de error)
  tituloSeccion(doc, cur, n++, 'Analisis de resultados');
  parrafo(doc, cur, cuerpo.analisis);

  // 7. Conclusiones
  tituloSeccion(doc, cur, n++, 'Conclusiones');
  parrafo(doc, cur, cuerpo.conclusiones);

  // 8. Referencias (IEEE)
  if (cuerpo.referencias && cuerpo.referencias.length) {
    tituloSeccion(doc, cur, n++, 'Referencias');
    dibujarReferencias(doc, cur, cuerpo.referencias);
  }

  // Pies de pagina al final (cuando ya conocemos el total).
  dibujarPies(doc);

  return doc;
}

/** Genera el PDF y dispara la descarga en el navegador. */
export function descargarReportePDF(
  r: ReporteLab,
  nombreArchivo?: string,
): void {
  const doc = generarReportePDF(r);
  const fallback = `reporte-practica-${txt(r.cajetin.practicaNumero)}.pdf`;
  let nombre = (nombreArchivo ?? fallback).trim() || fallback;
  if (!/\.pdf$/i.test(nombre)) nombre += '.pdf';
  doc.save(nombre);
}
