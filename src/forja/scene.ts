import { defineScene } from './api';

/**
 * SERVO BED para MG996R — estilo InMoov ("Simple Servo Bed")
 * ===========================================================
 * La pieza MAS representativa, imprimible y didactica del ecosistema de
 * androides de plastico (InMoov / Poppy): el soporte que sujeta un
 * servomotor. Enseña lo esencial de mecatronica en una sola pieza:
 *   - cavidad con la forma EXACTA del cuerpo del MG996R (40.7 × 19.7 × 42.9 mm)
 *   - barrenos M3 (Ø3) en el patron de montaje real del servo (49.5 × 10 mm)
 *   - barrenos M3 en la base para atornillar el bed al chasis / antebrazo
 *   - ventana frontal para que asome el eje + corneta (horn) del servo
 *   - paredes de 3 mm: rigidas e imprimibles sin soporte (FDM)
 *
 * Convencion de unidades del CAD: MM = 0.02 u/mm (igual que la escena del
 * brazo robotico). Todo se parametriza en mm para que el alumno juegue.
 */
export default defineScene((f) => {
  const MM = 0.02; // 1 mm  →  0.02 unidades de escena

  // ── Servo MG996R (medidas reales) ────────────────────────────
  const servoL = f.variable('servo_largo_mm',  40.7 * MM); // X  cuerpo
  const servoW = f.variable('servo_ancho_mm',  19.7 * MM); // Z  cuerpo
  const servoH = f.variable('servo_alto_mm',   42.9 * MM); // Y  cuerpo (con tapa)
  const holeDx = f.variable('barreno_x_mm',    49.5 * MM); // sep. larga de barrenos
  const holeDz = f.variable('barreno_z_mm',    10.0 * MM); // sep. corta de barrenos
  const m3     = f.variable('m3_diam_mm',       3.2 * MM); // taladro M3 holgado

  // ── Parametros del bed ───────────────────────────────────────
  const wall   = f.variable('pared_mm',         3.0 * MM); // grosor de pared
  const floor  = f.variable('piso_mm',          3.0 * MM); // base inferior
  const cradleH= f.variable('cuna_alto_mm',    24.0 * MM); // cuanto abraza el cuerpo
  const flange = f.variable('pestana_mm',       7.0 * MM); // saliente para barrenos base

  // Caja exterior del bed = cavidad del servo + paredes en X/Z, abierta arriba.
  const outL = servoL + 2 * wall;
  const outW = servoW + 2 * wall;
  const outH = floor + cradleH;

  // Centro de la cuna a media altura de la pieza.
  const cy = outH / 2;

  // ── Cuerpo macizo (caja con base ancha tipo pestaña) ─────────
  const shell = f.box({ w: outL, h: outH, d: outW, at: [0, cy, 0], name: 'Carcasa' });

  // Pestaña inferior (mas ancha) para atornillar el bed al chasis.
  const baseSlab = f.box({
    w: outL + 2 * flange, h: floor, d: outW + 2 * flange,
    at: [0, floor / 2, 0], name: 'Base',
  });

  // ── Cavidad del servo (resta) ────────────────────────────────
  // Hueco con la forma del cuerpo, desde el piso hacia arriba y ABIERTO arriba.
  const pocket = f.box({
    w: servoL, h: cradleH + servoH, d: servoW,
    at: [0, floor + (cradleH + servoH) / 2, 0], name: 'Cavidad',
  });

  // ── Ventana frontal: deja pasar el eje + la corneta del servo ─
  // En el MG996R el eje esta descentrado hacia un extremo (a ~10 mm del borde).
  const axisX = servoL / 2 - 10 * MM;
  const window = f.cylinder({
    r: 9 * MM, h: outW + 4 * wall,            // atraviesa todo el ancho
    at: [axisX, floor + cradleH, 0],
    rot: [Math.PI / 2, 0, 0],                 // eje del cilindro = Z
    name: 'VentanaCorneta',
  });

  // ── Barrenos M3 del patron de montaje del servo ──────────────
  // 4 taladros verticales en el plano de las pestañas del MG996R.
  const servoHoles = [
    [ holeDx / 2,  holeDz / 2],
    [ holeDx / 2, -holeDz / 2],
    [-holeDx / 2,  holeDz / 2],
    [-holeDx / 2, -holeDz / 2],
  ].map(([hx, hz], i) =>
    f.cylinder({
      r: m3 / 2, h: outH + 4 * wall,
      at: [hx, cy, hz],
      name: `M3_servo_${i + 1}`,
    }),
  );

  // ── Barrenos M3 en la pestaña base (fijar el bed al chasis) ──
  const baseHoleX = outL / 2 + flange / 2;
  const baseHoles = [
    [ baseHoleX,  outW / 2 - wall],
    [ baseHoleX, -outW / 2 + wall],
    [-baseHoleX,  outW / 2 - wall],
    [-baseHoleX, -outW / 2 + wall],
  ].map(([hx, hz], i) =>
    f.cylinder({
      r: m3 / 2, h: floor + 4 * wall,
      at: [hx, floor / 2, hz],
      name: `M3_base_${i + 1}`,
    }),
  );

  // ── Ensamble: solido (carcasa ∪ base) menos todos los huecos ──
  const solid = f.union(shell, baseSlab);
  const bed = f.subtract(solid, pocket, window, ...servoHoles, ...baseHoles);

  f.add(f.group('ServoBed_MG996R', bed));
});
