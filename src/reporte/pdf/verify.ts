/**
 * Verificador del generador de PDF.
 *
 * Importa generarReportePDF + REPORTE_EJEMPLO, construye el PDF y comprueba:
 *   (a) no lanza excepcion,
 *   (b) el output (arraybuffer) empieza con los bytes "%PDF-",
 *   (c) doc.getNumberOfPages() >= 1,
 *   (d) tamano > 2000 bytes.
 *
 * Imprime EXACTO al final:
 *   VERIFY_RESULT={"ok":true|false,"pages":N,"bytes":N,"err":null|"..."}
 * y termina con process.exit(ok ? 0 : 1).
 *
 * Correr con:  npx tsx src/reporte/pdf/verify.ts
 */

import { generarReportePDF } from './generator';
import { REPORTE_EJEMPLO } from './samples';

function main(): void {
  let ok = false;
  let pages = 0;
  let bytes = 0;
  let err: string | null = null;

  try {
    // (a) no debe lanzar excepcion
    const doc = generarReportePDF(REPORTE_EJEMPLO);

    pages = doc.getNumberOfPages();

    const ab = doc.output('arraybuffer') as ArrayBuffer;
    const u8 = new Uint8Array(ab);
    bytes = u8.byteLength;

    // (b) firma "%PDF-" al inicio
    const firmaEsperada = [0x25, 0x50, 0x44, 0x46, 0x2d]; // % P D F -
    const firmaOk =
      u8.length >= firmaEsperada.length &&
      firmaEsperada.every((b, i) => u8[i] === b);

    // (c) >= 1 pagina   (d) > 2000 bytes
    ok = firmaOk && pages >= 1 && bytes > 2000;

    if (!firmaOk) err = 'firma %PDF- ausente';
    else if (pages < 1) err = `paginas insuficientes (${pages})`;
    else if (bytes <= 2000) err = `tamano insuficiente (${bytes} bytes)`;
  } catch (e) {
    ok = false;
    err = e instanceof Error ? e.message : String(e);
  }

  // Linea de resultado EXACTA que consume el orquestador.
  process.stdout.write(
    `VERIFY_RESULT=${JSON.stringify({ ok, pages, bytes, err })}\n`,
  );
  process.exit(ok ? 0 : 1);
}

main();
