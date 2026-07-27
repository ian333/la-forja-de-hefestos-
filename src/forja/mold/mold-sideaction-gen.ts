/**
 * GENERADOR DE MECANISMOS §11.3.6-7 — de las regiones de undercut MEDIDAS
 * (dfm-mesh.regionsDetail) al KIT de partes móviles, con el libro LITERAL:
 *
 *   · Eq 11.24  F_core_pull = P_melt · A_core_projected   (bezel: 200 MPa · 220 mm² = 44 kN)
 *   · Eq 11.25  D_bore = √(4F / (π · P_hidráulica))       (10 MPa típico → 75 mm)
 *   · Eq 11.26  S_slide = L_angle_pin · sin(φ)            (φ limitado a ~20°; bezel:
 *               12 mm / sin 20° = 35 mm de contacto + 25 mm de encastre ≈ 60 mm)
 *
 * Decisión slide vs core pull (§11.3.7): "mold designers often prefer to use sliding
 * cores actuated by inclined angle pins" — corredera por defecto; cilindro HIDRÁULICO
 * cuando la carrera excede lo práctico del perno (el ejemplo del libro selecciona un
 * cilindro estándar de 25.4 mm de carrera — usamos 25 mm como frontera).
 *
 * El kit de la corredera (Figs 11.27-11.28): corredera + perno inclinado + inserto del
 * perno + GIB DE BRONCE (guía lubricada, dowels+tornillos) + HEEL BLOCK (da la fuerza
 * LATERAL — "the angle pin does not provide the lateral force") + placa retenedora +
 * resorte (mantiene la corredera afuera) + limit switch. El core pull (Figs 11.24-11.26):
 * núcleo móvil con CUÑA/keyway en B + interlock al frente + cilindro con risers.
 */

export interface UndercutRegion {
  x0: number; x1: number; y0: number; y1: number;   // bbox en coords locales de la pieza
  zLo: number; zHi: number;                          // rango z del hueco (sobre la partición)
  volMm3: number; cols: number;
  dir: [number, number] | null;                      // dirección de jale (ventea hacia allá)
}

import { pickSlideUnit, type SlideUnit } from './mechanism-catalog';

export interface SideActionPlan {
  kind: 'slide' | 'core-pull';
  /** SLIDE HIDRÁULICO (§11.3.6): corredera lateral EMPUJADA por cilindro, no por perno
   *  angular. Se usa cuando el stroke pasa el límite del perno (~25mm) — el caso del
   *  Phone Holder de Alwis. Geometría = cuerpo+rieles+gib de slide + cilindro+vástago. */
  hydraulic?: boolean;
  /** false = el ESTUDIO veta el mecanismo (F > 100 kN → split cavity §13.9.1):
   *  no se genera actuador — solo el núcleo insertado + la advertencia. */
  feasible?: boolean;
  /** unidad PRECARGADA del catálogo (slide); undefined = core pull a la medida */
  unit?: SlideUnit;
  dir: [number, number];
  /** frente del núcleo móvil (lo que ve el plástico): ancho ⊥ jale × alto en z */
  coreWmm: number; coreHmm: number;
  /** penetración de la región en la dirección de jale */
  penetrationMm: number;
  strokeMm: number;                                  // S = penetración + 3 (libra el sobre)
  aProjMm2: number;                                  // W × H (proyección frontal, conservador)
  forceKN: number;                                   // Eq 11.24
  angleDeg: number;                                  // φ = 20° (límite del libro)
  pinContactMm?: number;                             // Eq 11.26: S / sin φ
  pinTotalMm?: number;                               // + 25 mm de encastre (libro)
  boreMm?: number;                                   // Eq 11.25 (core pull, P_h = 10 MPa)
  region: UndercutRegion;
  notes: string[];
}

const ANGLE_DEG = 20;                 // "the inclined angle … is limited to about 20 degrees"
const PIN_EXTRA_MM = 25;              // "An additional 25 mm of length is required to mate…"
const SLIDE_MAX_STROKE_MM = 25;       // el libro selecciona cilindro de 25.4 mm para más carrera
const P_HYD_MPA = 10;                 // "many molding machines … operated at 10 MPa"
const ELASTIC_STRAIN_PCT = 2;         // §11.3.5 "most plastics have a strain to yield above 2%"

/** ESTUDIOS del mecanismo (cada fila con su ecuación) — lo que SolidWorks no hace:
 *  la escalera §11.3.5→11.3.7→11.3.6→§13.9.1 CALCULADA para esta región. */
export function sideActionVerdicts(p: SideActionPlan, o?: { pitchMm?: number }): Array<{ param: string; valor: string; limite: string; ok: boolean; ref: string }> {
  const r = p.region;
  // Eq 11.20: ε = δ/L — δ = penetración del undercut, L = pared debajo (zLo).
  // Si ε ≤ 2% el LABIO podría expulsarse ELÁSTICO (stripper) sin mecanismo — solo
  // aplica a labios/snaps, NO a ventanas pasantes: se reporta para el ingeniero.
  const L = Math.max(1, r.zLo);
  const eps = (p.penetrationMm / L) * 100;
  const rows = [
    {
      param: 'Expulsión elástica (¿evitar mecanismo?)',
      valor: `ε = ${p.penetrationMm}/${L.toFixed(1)} = ${eps.toFixed(1)} %`,
      limite: `≤ ${ELASTIC_STRAIN_PCT} % (strain to yield §11.3.5) — solo si es LABIO, no ventana`,
      ok: eps <= ELASTIC_STRAIN_PCT,
      ref: 'Eq 11.20',
    },
    {
      param: 'F de retención del núcleo móvil',
      valor: `${p.forceKN} kN (A=${p.aProjMm2} mm²)`,
      limite: 'la aguanta el HEEL BLOCK (el perno no carga, §11.3.7)',
      ok: true,
      ref: 'Eq 11.24',
    },
    ...(p.kind === 'slide' ? [
      {
        param: 'Perno inclinado',
        valor: `φ=${p.angleDeg}° · L=${p.pinContactMm} + ${PIN_EXTRA_MM} = ${p.pinTotalMm} mm`,
        limite: `φ ≤ 20° ("limited to about 20 degrees")`,
        ok: p.angleDeg <= 20,
        ref: 'Eq 11.26',
      },
      {
        param: 'Apertura de molde requerida',
        valor: `${((p.pinContactMm ?? 0) * Math.cos(p.angleDeg * Math.PI / 180)).toFixed(0)} mm de carrera vertical`,
        limite: 'engancha todo el contacto del perno (L·cosφ)',
        ok: true,
        ref: 'Eq 11.26 (geometría)',
      },
    ] : [
      {
        param: 'Cilindro hidráulico',
        valor: `bore ${p.boreMm} mm @ ${P_HYD_MPA} MPa · carrera ${p.strokeMm} mm`,
        limite: 'con risers + limit switches (avance/retraído)',
        ok: true,
        ref: 'Eq 11.25',
      },
    ]),
    {
      param: 'Cavidad partida (split cavity)',
      valor: `F = ${p.forceKN} kN`,
      limite: '> 100 kN sugiere split cavity §13.9.1 (área atrapada grande)',
      ok: p.forceKN <= 100,
      ref: '§13.9.1',
    },
  ];
  if (o?.pitchMm != null) {
    const env = envelopeMm(p);
    rows.push({
      param: 'Paso multi-cavidad vs mecanismo',
      valor: `sobre ${env.toFixed(0)} mm vs paso ${o.pitchMm} mm`,
      limite: 'las celdas interiores NO tienen salida: fila única o back-to-back',
      ok: env <= o.pitchMm,
      ref: '§11.3.7 (layout)',
    });
  }
  return rows;
}

/** sobre (envelope) del mecanismo en la dirección de jale: cuerpo + talón + carrera. */
export function envelopeMm(p: SideActionPlan): number {
  return p.penetrationMm + 30 + 16 + p.strokeMm + 10;   // nariz+cuerpo fuera del inserto+talón+carrera
}

export function planSideAction(r: UndercutRegion, o?: { pMeltMPa?: number }): SideActionPlan | null {
  if (!r.dir) return null;                                        // sellada: NO hay mecanismo que la alcance
  const P = o?.pMeltMPa ?? 200;                                   // el libro asume 200 MPa "conservatively"
  const alongX = Math.abs(r.dir[0]) > Math.abs(r.dir[1]);
  const penetration = alongX ? r.x1 - r.x0 : r.y1 - r.y0;
  const coreW = Math.max(3, alongX ? r.y1 - r.y0 : r.x1 - r.x0);
  const coreH = Math.max(3, r.zHi - r.zLo);
  const S = +(penetration + 3).toFixed(1);                        // "travel sufficient to clear the envelope"
  const aProj = +(coreW * coreH).toFixed(0);
  const F = P * 1e6 * aProj * 1e-6 / 1000;                        // kN (Eq 11.24)
  const base = {
    dir: r.dir, coreWmm: +coreW.toFixed(1), coreHmm: +coreH.toFixed(1),
    penetrationMm: +penetration.toFixed(1), strokeMm: S, aProjMm2: aProj,
    forceKN: +F.toFixed(1), angleDeg: ANGLE_DEG, region: r,
  };
  // MECANISMO PRECARGADO: la unidad más chica del catálogo que cumple carrera y
  // cara (como se compra en la vida real); fuera de catálogo → core pull a la medida.
  const unit = pickSlideUnit(coreW, coreH, S);
  if (unit) {
    const Lc = S / Math.sin(unit.angleDeg * Math.PI / 180);       // Eq 11.26
    return {
      ...base, kind: 'slide', unit, angleDeg: unit.angleDeg,
      pinContactMm: +Lc.toFixed(0), pinTotalMm: +(Lc + PIN_EXTRA_MM).toFixed(0),
      notes: [
        `UNIDAD PRECARGADA ${unit.code} (catálogo) · corredera §11.3.7 · perno φ=${unit.angleDeg}°`,
        `S=${S} mm → L contacto ${Lc.toFixed(0)} mm (Eq 11.26) + ${PIN_EXTRA_MM} encastre = ${(Lc + PIN_EXTRA_MM).toFixed(0)} mm`,
        `F retención = ${P}·${aProj} = ${F.toFixed(1)} kN (Eq 11.24) — la da el HEEL BLOCK, no el perno`,
        'gib de bronce + retenedora + resorte (corredera afuera) + limit switch',
      ],
    };
  }
  const bore = Math.sqrt((4 * F * 1000) / (Math.PI * P_HYD_MPA * 1e6)) * 1000;   // Eq 11.25, en mm
  // EL ESTUDIO VETA LA GEOMETRÍA: F > 100 kN o bore > 100 mm = área atrapada grande
  // → esto no se resuelve con un actuador gigante colgado del molde, se resuelve con
  // SPLIT CAVITY §13.9.1 (o rediseño). Se genera SOLO el núcleo insertado + aviso.
  if (F > 100 || bore > 100) {
    return {
      ...base, kind: 'core-pull', feasible: false, boreMm: +bore.toFixed(0),
      notes: [
        `✗ FUERA DE ALCANCE de core pull: F = ${P}·${aProj} = ${F.toFixed(1)} kN (Eq 11.24) > 100 kN`,
        `el actuador pediría bore ${bore.toFixed(0)} mm (Eq 11.25) — no se cuelga eso de un molde`,
        '→ SPLIT CAVITY §13.9.1 (cavidad partida) o rediseñar la pieza (quitar el área atrapada)',
      ],
    };
  }
  return {
    ...base, kind: 'slide', hydraulic: true, feasible: true,
    boreMm: +bore.toFixed(0),
    notes: [
      `SLIDE HIDRÁULICO §11.3.6: corredera lateral + CILINDRO (carrera ${S} mm > ${SLIDE_MAX_STROKE_MM} mm — el perno angular no alcanza)`,
      `F = ${P}·${aProj} = ${F.toFixed(1)} kN (Eq 11.24)`,
      `bore = √(4F/π·${P_HYD_MPA} MPa) = ${bore.toFixed(0)} mm (Eq 11.25) + risers`,
      'corredera en rieles/gib + cilindro atornillado a B + interlock al frente + limit switches (avance/retraído)',
    ],
  };
}

/** Regiones medidas → planes (mayor primero, ruido fuera, tope razonable con nota). */
export function planSideActions(
  regions: UndercutRegion[], o?: { pMeltMPa?: number; max?: number },
): { plans: SideActionPlan[]; dropped: number } {
  const MAX = o?.max ?? 4;
  const candidates = regions
    .filter((r) => r.dir && r.volMm3 >= 2 && r.cols >= 3)
    .sort((a, b) => b.volMm3 - a.volMm3);
  const plans: SideActionPlan[] = [];
  for (const r of candidates) {
    if (plans.length >= MAX) break;
    const p = planSideAction(r, o);
    if (p) plans.push(p);
  }
  return { plans, dropped: Math.max(0, candidates.length - plans.length) };
}

/** Side action DECLARADO por el cliente (sin malla): A_proj y carrera vienen del spec —
 *  reproduce el ejemplo del bezel del libro (220 mm², 200 MPa → 44 kN; 12 mm → 60 mm).
 *  La región sintética vive en el borde +X de la HUELLA (fx×fy) — jala hacia afuera. */
export function planFromSpec(sa: { aProjMm2: number; pMeltMPa: number; strokeMm: number; hydraulic?: boolean }, coreHmm = 10, foot?: { fx: number; fy: number }): SideActionPlan {
  const coreW = Math.max(3, sa.aProjMm2 / coreHmm);
  const F = sa.pMeltMPa * 1e6 * sa.aProjMm2 * 1e-6 / 1000;
  const S = sa.strokeMm;
  const fx = foot?.fx ?? 3, fy = foot?.fy ?? coreW;
  const region: UndercutRegion = { x0: fx - 3, x1: fx, y0: (fy - coreW) / 2, y1: (fy + coreW) / 2, zLo: 0, zHi: coreHmm, volMm3: Math.round(sa.aProjMm2 * 3), cols: 9, dir: [1, 0] };
  // hidráulico si el cliente lo PIDE (sa.hydraulic) o si ninguna unidad de catálogo
  // cubre la carrera (S > 30 mm del CU-90) — el caso del Phone Holder de Alwis.
  const unit = sa.hydraulic ? null : pickSlideUnit(coreW, coreHmm, S);
  if (unit) {
    const Lc = S / Math.sin(unit.angleDeg * Math.PI / 180);
    return {
      kind: 'slide', unit, dir: [1, 0], coreWmm: +coreW.toFixed(1), coreHmm, penetrationMm: 3,
      strokeMm: S, aProjMm2: sa.aProjMm2, forceKN: +F.toFixed(1), angleDeg: unit.angleDeg,
      pinContactMm: +Lc.toFixed(0), pinTotalMm: +(Lc + PIN_EXTRA_MM).toFixed(0), region,
      notes: [`UNIDAD PRECARGADA ${unit.code} · declarado por el cliente: A=${sa.aProjMm2} mm² · S=${S} mm`,
        `L perno = ${S}/sin${unit.angleDeg}° = ${Lc.toFixed(0)} + ${PIN_EXTRA_MM} = ${(Lc + PIN_EXTRA_MM).toFixed(0)} mm (Eq 11.26)`,
        `F = ${F.toFixed(1)} kN (Eq 11.24)`],
    };
  }
  const bore = Math.sqrt((4 * F * 1000) / (Math.PI * P_HYD_MPA * 1e6)) * 1000;
  return {
    kind: 'slide', hydraulic: true, dir: [1, 0], coreWmm: +coreW.toFixed(1), coreHmm, penetrationMm: 3,
    strokeMm: S, aProjMm2: sa.aProjMm2, forceKN: +F.toFixed(1), angleDeg: ANGLE_DEG,
    boreMm: +bore.toFixed(0), region,
    notes: [`SLIDE HIDRÁULICO §11.3.6 (declarado): A=${sa.aProjMm2} mm² · S=${S} mm — ${sa.hydraulic ? 'el cliente eligió cilindro (actuación independiente)' : `S>${SLIDE_MAX_STROKE_MM} mm, fuera del catálogo de pernos`}`,
      `F = ${F.toFixed(1)} kN (Eq 11.24)`, `bore = ${bore.toFixed(0)} mm (Eq 11.25, P_h=${P_HYD_MPA} MPa)`, 'corredera en rieles/gib + cilindro atornillado a B + limit switches'],
  };
}
