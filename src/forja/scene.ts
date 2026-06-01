import { defineScene } from './api';

/**
 * SERVO BED para MG996R — estilo InMoov ("Simple Servo Bed")
 * ===========================================================
 * La pieza MAS representativa, imprimible y didactica del ecosistema de
 * androides de plastico (InMoov / Poppy): el soporte que sujeta un
 * servomotor al chasis. Enseña lo esencial de mecatronica en UNA sola pieza:
 *   - cavidad con la forma EXACTA del cuerpo del MG996R (40.7 × 19.7 × 42.9 mm)
 *   - barrenos M3 (Ø3.2) en el patron de montaje real del servo (49.5 × 10 mm)
 *   - barrenos M3 en la pestaña base para atornillar el bed al chasis/antebrazo
 *   - ventana cilindrica frontal para que asome el eje + corneta (horn)
 *   - paredes y piso de 3 mm: rigidos e imprimibles sin soporte (FDM)
 *
 * UNIDADES: MM = 0.02 u/mm  (⇒ 1 u = 50 mm). El exportador usa scaleMM=50,
 * asi que el STL sale en MILIMETROS REALES y un servo de verdad encaja.
 * Todo parametrico: edita las 10 variables (en mm) en el panel de Variables.
 */
export default defineScene((f) => {
  const MM = 0.02; // 1 mm → 0.02 unidades de escena

  // ── Servo MG996R (medidas reales del cuerpo) ─────────────────
  const servoL = f.variable('servo_largo_mm', 40.7 * MM, { unit: 'mm' }); // X  cuerpo
  const servoW = f.variable('servo_ancho_mm', 19.7 * MM, { unit: 'mm' }); // Z  cuerpo
  const servoH = f.variable('servo_alto_mm',  42.9 * MM, { unit: 'mm' }); // Y  cuerpo
  const holeDx = f.variable('barreno_x_mm',   49.5 * MM, { unit: 'mm' }); // sep. larga
  const holeDz = f.variable('barreno_z_mm',   10.0 * MM, { unit: 'mm' }); // sep. corta
  const m3     = f.variable('m3_diam_mm',      3.2 * MM, { unit: 'mm' }); // M3 holgado

  // ── Parametros del bed ───────────────────────────────────────
  const wall    = f.variable('pared_mm',       3.0 * MM, { unit: 'mm' }); // grosor de pared
  const floor   = f.variable('piso_mm',        3.0 * MM, { unit: 'mm' }); // base inferior
  const cradleH = f.variable('cuna_alto_mm',  24.0 * MM, { unit: 'mm' }); // cuanto abraza
  const flange  = f.variable('pestana_mm',     7.0 * MM, { unit: 'mm' }); // saliente base

  // Caja exterior del bed = cavidad del servo + paredes en X/Z, abierta arriba.
  const outL = servoL + 2 * wall;
  const outW = servoW + 2 * wall;
  const outH = floor + cradleH;
  const cy = outH / 2; // centro de la pieza en Y

  // ── Cuerpo macizo (carcasa) ──────────────────────────────────
  const shell = f.box({ w: outL, h: outH, d: outW, at: [0, cy, 0], name: 'Carcasa' });

  // Pestaña inferior (mas ancha) para atornillar el bed al chasis.
  const baseSlab = f.box({
    w: outL + 2 * flange, h: floor, d: outW + 2 * flange,
    at: [0, floor / 2, 0], name: 'Base',
  });

  // ── Cavidad del servo (resta) — abierta arriba ───────────────
  // Hueco con la forma del cuerpo, desde encima del piso y abierto por arriba.
  const pocketH = cradleH + servoH; // sobra hacia arriba ⇒ techo abierto
  const pocket = f.box({
    w: servoL, h: pocketH, d: servoW,
    at: [0, floor + pocketH / 2, 0], name: 'Cavidad',
  });

  // ── Ventana frontal: eje + corneta (horn) del servo ──────────
  // En el MG996R el eje esta descentrado a ~10 mm de un extremo.
  const axisX = servoL / 2 - 10 * MM;
  const ventana = f.cylinder({
    r: 9 * MM, h: outW + 4 * wall,     // atraviesa todo el ancho en Z
    at: [axisX, floor + cradleH, 0],
    rot: [Math.PI / 2, 0, 0],          // eje del cilindro = Z
    name: 'VentanaCorneta',
  });

  // ── Barrenos M3 del patron de montaje del servo (4) ──────────
  const servoHoles = ([
    [ holeDx / 2,  holeDz / 2],
    [ holeDx / 2, -holeDz / 2],
    [-holeDx / 2,  holeDz / 2],
    [-holeDx / 2, -holeDz / 2],
  ] as [number, number][]).map(([hx, hz], i) =>
    f.cylinder({
      r: m3 / 2, h: outH + 4 * wall,
      at: [hx, cy, hz],
      name: `M3_servo_${i + 1}`,
    }),
  );

  // ── Barrenos M3 en la pestaña base (fijar al chasis) (4) ─────
  const baseHoleX = outL / 2 + flange / 2;
  const baseHoles = ([
    [ baseHoleX,  outW / 2 - wall / 2],
    [ baseHoleX, -outW / 2 + wall / 2],
    [-baseHoleX,  outW / 2 - wall / 2],
    [-baseHoleX, -outW / 2 + wall / 2],
  ] as [number, number][]).map(([hx, hz], i) =>
    f.cylinder({
      r: m3 / 2, h: floor + 4 * wall,
      at: [hx, floor / 2, hz],
      name: `M3_base_${i + 1}`,
    }),
  );

  // ── Ensamble: (carcasa ∪ base) menos todos los huecos ────────
  const solid = f.union(shell, baseSlab);
  const bed = f.subtract(solid, pocket, ventana, ...servoHoles, ...baseHoles);

  f.add(f.group('ServoBed_MG996R', bed));
});
