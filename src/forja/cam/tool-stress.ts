/**
 * ⚒️ La Forja — ESTUDIO DE ESFUERZO DE LA HERRAMIENTA (CAM que explica sus números)
 * ================================================================================
 * El dolor real (saga CNC 2026-07-09, Hurco '98 + 304L): Fusion te pide rpm, feed,
 * stepdown, stickout… y NUNCA te dice "esta combinación ROMPE la herramienta" o
 * "este chip tan flaco ROZA y endurece el inox". Se tronaron 2 juegos de insertos
 * y una fresa entera — TODO era predecible con física de licenciatura.
 *
 * Este módulo ES esa predicción. Entradas: herramienta (Ø, filos, voladizo),
 * corte (rpm, avance, ap, ae) y material. Salidas: bocado real (chip thinning),
 * fuerza (Kienzle), potencia/torque (Sandvik), esfuerzo y deflexión del voladizo
 * (viga empotrada, MIT 2.080), y VEREDICTOS en español que enseñan el porqué.
 *
 * Fuentes de las fórmulas (docs/forja-research/manuales/ + biblioteca ISBN):
 *  - Kienzle: kc = kc1.1 · h^(−mc)  (König/Klocke, Fertigungsverfahren; Kalpakjian cap. corte)
 *  - Chip thinning radial: hm ≈ fz·√(ae/D) para ae ≤ D/2 (estándar de catálogo Sandvik/Kennametal)
 *  - Potencia: Pc[kW] = ap·ae·vf·kc / 60e6 ; Torque: Mc = 30000·Pc/(π·n)
 *  - Voladizo: σ = 32·F·L/(π·d³), δ = F·L³/(3·E·I)  (viga en voladizo, MIT OCW 2.080J)
 *  - TRS carburo ≈ 3000 MPa; E carburo = 600 GPa; E acero (cuerpo de insertos) = 210 GPa
 *  - Fatiga/vida del filo: cualitativo aquí (fe-safe vol.2 para el modelo S-N futuro)
 */

export interface Herramienta {
  /** diámetro de corte (mm) */
  d: number;
  /** número de filos (dientes efectivos) */
  z: number;
  /** voladizo: largo fuera del cono/porta (mm) — cuesta LINEAL en esfuerzo y AL CUBO en deflexión */
  voladizo: number;
  tipo: 'entera' | 'insertos';
  /** Ø de núcleo efectivo (mm); default 0.8·d entera (4F), 0.85·d insertos (cuerpo acero) */
  dCore?: number;
}

export interface Corte {
  rpm: number;
  /** avance de mesa (mm/min) */
  vf: number;
  /** profundidad axial ap / stepdown (mm) */
  ap: number;
  /** mordida radial ae / optimal load (mm) */
  ae: number;
}

export interface MaterialCorte {
  nombre: string;
  /** fuerza específica de corte a h=1mm, b=1mm (N/mm²) — tabla Kienzle publicada */
  kc11: number;
  /** exponente de Kienzle */
  mc: number;
  /** ¿endurece por deformación al ROZARLO? (austeníticos: el asesino silencioso) */
  endurece: boolean;
  /** ventana de velocidad de corte para carburo (m/min): abajo se PEGA (BUE), arriba se QUEMA */
  vcMin: number;
  vcMax: number;
}

/** Tabla Kienzle (valores publicados König/Klocke; ventanas Vc para carburo recubierto). */
export const MATERIALES: Record<string, MaterialCorte> = {
  'inox-304': { nombre: 'Inox austenítico 304/304L/316', kc11: 2350, mc: 0.21, endurece: true, vcMin: 50, vcMax: 160 },
  'acero-1045': { nombre: 'Acero al carbono 1045/C45', kc11: 1680, mc: 0.26, endurece: false, vcMin: 80, vcMax: 250 },
  'acero-4140': { nombre: 'Acero de moldes 4140/42CrMo4/P20', kc11: 2500, mc: 0.26, endurece: false, vcMin: 70, vcMax: 200 },
  'aluminio': { nombre: 'Aluminio (serie 6xxx)', kc11: 780, mc: 0.23, endurece: false, vcMin: 200, vcMax: 800 },
  'fundicion': { nombre: 'Fundición gris GG25', kc11: 1160, mc: 0.26, endurece: false, vcMin: 80, vcMax: 250 },
};

export interface Veredicto {
  nivel: 'ok' | 'aviso' | 'peligro';
  clave: 'roza' | 'bocado-gordo' | 'vc-baja' | 'vc-alta' | 'rompe' | 'flexion' | 'potencia' | 'grado-interrumpido';
  msg: string;
}

export interface EstudioHerramienta {
  /** velocidad de corte (m/min) */
  vc: number;
  /** avance por diente comandado (mm) */
  fz: number;
  /** bocado REAL tras adelgazamiento radial (mm) — el número que mata o salva filos */
  hm: number;
  /** fuerza específica a ese bocado (N/mm²) — crece al rozar: castigo por chip flaco */
  kc: number;
  /** remoción (cm³/min) */
  mrr: number;
  potenciaKW: number;
  torqueNm: number;
  /** fuerza tangencial media en la periferia (N) */
  fuerzaN: number;
  /** esfuerzo de flexión en el empotre del voladizo (MPa) */
  sigmaMPa: number;
  /** deflexión en la punta (mm) */
  deflexionMm: number;
  /** factor de seguridad contra rotura del cuerpo (TRS carburo / límite del cuerpo) */
  fs: number;
  veredictos: Veredicto[];
  /** true si no hay ningún 'peligro' */
  ok: boolean;
}

// Umbrales documentados en el módulo (radio de filo honed típico 8–15 µm →
// chip < 10 µm ARA en vez de cortar; en austeníticos el margen sano es ≥ 25 µm).
const HM_ROZA = 0.010;
const HM_MARGINAL_ENDURECE = 0.025;
const TRS_CARBURO = 3000;   // MPa (micrograno 2500–4000)
const LIM_CUERPO_ACERO = 600; // MPa (fatiga flexión cuerpo portainsertos)
const E_CARBURO = 600e3;    // MPa
const E_ACERO = 210e3;      // MPa

export function cutKinematics(tool: Herramienta, corte: Corte) {
  const vc = (Math.PI * tool.d * corte.rpm) / 1000;
  const fz = corte.vf / (tool.z * corte.rpm);
  const ratio = Math.min(1, corte.ae / tool.d);
  const hm = fz * Math.sqrt(ratio); // adelgazamiento radial (exacto para ae≤D/2, clamp arriba)
  return { vc, fz, hm };
}

export function toolStress(tool: Herramienta, corte: Corte, mat: MaterialCorte, opts?: { potenciaMaxKW?: number }): EstudioHerramienta {
  const { vc, fz, hm } = cutKinematics(tool, corte);
  const veredictos: Veredicto[] = [];

  // Kienzle — con piso numérico en h para no divergir; el veredicto de roce se
  // dispara aparte (kc creciendo al adelgazar el chip ES la física del castigo).
  const kc = mat.kc11 * Math.pow(Math.max(hm, 0.005), -mat.mc);
  const mrr = (corte.ap * corte.ae * corte.vf) / 1000;
  const potenciaKW = (corte.ap * corte.ae * corte.vf * kc) / 60e6;
  const torqueNm = (30000 * potenciaKW) / (Math.PI * corte.rpm);
  const fuerzaN = vc > 0 ? (60000 * potenciaKW) / vc : 0;

  // Voladizo como viga empotrada (el dato que Fusion pide ¡y no usa!):
  const dCore = tool.dCore ?? (tool.tipo === 'entera' ? 0.8 * tool.d : 0.85 * tool.d);
  const E = tool.tipo === 'entera' ? E_CARBURO : E_ACERO;
  const lim = tool.tipo === 'entera' ? TRS_CARBURO : LIM_CUERPO_ACERO;
  const I = (Math.PI * Math.pow(dCore, 4)) / 64;
  const L = tool.voladizo;
  const sigmaMPa = (32 * fuerzaN * L) / (Math.PI * Math.pow(dCore, 3));
  const deflexionMm = (fuerzaN * Math.pow(L, 3)) / (3 * E * I);
  const fs = sigmaMPa > 0 ? lim / sigmaMPa : Infinity;

  // ── VEREDICTOS (el producto: el software te lo dice ANTES de tronar el filo) ──
  if (hm < HM_ROZA) {
    veredictos.push({
      nivel: mat.endurece ? 'peligro' : 'aviso', clave: 'roza',
      msg: `El bocado real es ${(hm * 1000).toFixed(0)} µm — más delgado que el radio del filo: la herramienta ROZA en vez de cortar${mat.endurece ? ', y este material SE ENDURECE al rozarlo (espiral de muerte del filo)' : ''}. Sube el avance o la mordida radial.`,
    });
  } else if (mat.endurece && hm < HM_MARGINAL_ENDURECE) {
    veredictos.push({
      nivel: 'aviso', clave: 'roza',
      msg: `Bocado real ${(hm * 1000).toFixed(0)} µm: marginal en un material que endurece por deformación. El filo se desgastará sin avisar (el carburo no "se siente" gastado). Ideal ≥ ${HM_MARGINAL_ENDURECE * 1000} µm: sube avance o mordida radial.`,
    });
  }
  const fzMax = tool.tipo === 'entera' ? 0.025 * tool.d : 0.4;
  const fzAviso = tool.tipo === 'entera' ? 0.012 * tool.d : 0.25;
  if (fz > fzMax) {
    veredictos.push({ nivel: 'peligro', clave: 'bocado-gordo', msg: `Avance por diente ${fz.toFixed(2)} mm — sobrecarga brutal del filo (máximo sano ~${fzMax.toFixed(2)}). REVIENTA al contacto. ¿Preset por defecto sin editar?` });
  } else if (fz > fzAviso) {
    veredictos.push({ nivel: 'aviso', clave: 'bocado-gordo', msg: `Avance por diente ${fz.toFixed(3)} mm, arriba del rango cómodo (~${fzAviso.toFixed(3)}). Vigila sonido y viruta.` });
  }
  if (vc < mat.vcMin) {
    veredictos.push({ nivel: 'aviso', clave: 'vc-baja', msg: `Vc = ${vc.toFixed(0)} m/min, abajo de ${mat.vcMin}: el material se PEGA al filo (filo recrecido) y al desprenderse arranca carburo. Sube rpm.` });
  } else if (vc > mat.vcMax) {
    veredictos.push({ nivel: 'aviso', clave: 'vc-alta', msg: `Vc = ${vc.toFixed(0)} m/min, arriba de ${mat.vcMax}: el filo se cuece (el calor no alcanza a irse en la viruta). Baja rpm.` });
  }
  if (fs < 1.5) {
    veredictos.push({ nivel: 'peligro', clave: 'rompe', msg: `Esfuerzo de flexión ${sigmaMPa.toFixed(0)} MPa en el empotre — factor de seguridad ${fs.toFixed(1)}: SE ROMPE. El voladizo de ${L} mm castiga LINEAL en esfuerzo; acorta la herramienta en el porta o baja ap·ae.` });
  } else if (fs < 3) {
    veredictos.push({ nivel: 'aviso', clave: 'rompe', msg: `Factor de seguridad ${fs.toFixed(1)} contra rotura — poco margen para un enganche o una entrada sin rampa. Acorta voladizo o baja carga.` });
  }
  if (deflexionMm > 0.05) {
    veredictos.push({ nivel: 'peligro', clave: 'flexion', msg: `La punta se dobla ${(deflexionMm * 1000).toFixed(0)} µm — vibración/chatter y tolerancias imposibles. La deflexión crece AL CUBO con el voladizo (${L} mm): acórtalo.` });
  } else if (deflexionMm > 0.02) {
    veredictos.push({ nivel: 'aviso', clave: 'flexion', msg: `Deflexión ${(deflexionMm * 1000).toFixed(0)} µm en la punta: en el límite para acabado; probable chatter en paredes.` });
  }
  if (opts?.potenciaMaxKW != null) {
    if (potenciaKW > opts.potenciaMaxKW) {
      veredictos.push({ nivel: 'peligro', clave: 'potencia', msg: `El corte pide ${potenciaKW.toFixed(1)} kW y la máquina da ${opts.potenciaMaxKW}: el husillo se ATASCA (o talonea el avance). Baja ap, ae o avance.` });
    } else if (potenciaKW > 0.8 * opts.potenciaMaxKW) {
      veredictos.push({ nivel: 'aviso', clave: 'potencia', msg: `Potencia ${potenciaKW.toFixed(1)} kW = ${(100 * potenciaKW / opts.potenciaMaxKW).toFixed(0)}% de la máquina: sin margen.` });
    }
  }
  // La lección cara del taller: 2 dientes + corte interrumpido + material que
  // endurece = grado tenaz o nada (el inserto "general" se astilla con TODO bien).
  if (tool.tipo === 'insertos' && mat.endurece && tool.z <= 2) {
    veredictos.push({ nivel: 'aviso', clave: 'grado-interrumpido', msg: `${tool.z} insertos golpeteando un material que endurece: exige inserto de GRADO TENAZ para inox (filo honed). Un grado "propósito general" se astilla aunque los parámetros estén perfectos.` });
  }

  return { vc, fz, hm, kc, mrr, potenciaKW, torqueNm, fuerzaN, sigmaMPa, deflexionMm, fs, veredictos, ok: !veredictos.some((v) => v.nivel === 'peligro') };
}
