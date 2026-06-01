/**
 * Tipos del Reporte de Laboratorio (estructura validada IPN/UNAM/TecNM).
 *
 * Es el "organo de entrega" de GAIA: vuelve ENTREGABLE lo que ya se produce
 * en pantalla (resultados de sims, pasos del solver, datos medidos).
 *
 * El reporte se divide en dos partes:
 *  - `cajetin`: el header de identificacion (equivalente al cajetin del dibujo
 *    tecnico) que va recuadrado arriba de la primera pagina.
 *  - `cuerpo`: las secciones academicas en orden (objetivo, marco teorico,
 *    material, procedimiento, resultados con tablas/graficas, analisis,
 *    conclusiones y referencias).
 */

/** Cajetin / portada: bloque de identificacion del reporte. */
export interface CajetinReporte {
  institucion: string;
  carrera: string;
  asignatura: string;
  practicaNumero: string | number;
  practicaTitulo: string;
  alumno: string;
  /** No. de cuenta (UNAM) o boleta (IPN/TecNM). */
  cuentaOBoleta: string;
  grupo: string;
  profesor: string;
  fechaRealizacion: string;
  fechaEntrega: string;
}

/** Una seccion libre del cuerpo (titulo + texto). */
export interface SeccionReporte {
  titulo: string;
  contenido: string;
}

/** Tabla de resultados que se renderiza con jspdf-autotable. */
export interface TablaReporte {
  titulo: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Imagen / grafica embebida via addImage. `dataUrl` es un data URI PNG/JPEG. */
export interface ImagenReporte {
  titulo: string;
  /** data URL valido, p.ej. "data:image/png;base64,...". */
  dataUrl: string;
}

/** Cuerpo academico del reporte, en el orden en que se imprime. */
export interface CuerpoReporte {
  objetivo: string;
  marcoTeorico: string;
  materialEquipo: string;
  procedimiento: string;
  /** Secciones extra libres (introduccion, cuestionario, anexos, etc.). */
  secciones?: SeccionReporte[];
  /** Tablas de datos/resultados. */
  tablas?: TablaReporte[];
  /** Graficas o figuras embebidas. */
  imagenes?: ImagenReporte[];
  analisis: string;
  conclusiones: string;
  referencias?: string[];
}

/** Reporte de laboratorio completo. */
export interface ReporteLab {
  cajetin: CajetinReporte;
  cuerpo: CuerpoReporte;
}
