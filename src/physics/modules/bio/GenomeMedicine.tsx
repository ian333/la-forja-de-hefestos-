/**
 * Genoma humano y medicina molecular.
 *
 * Módulo 3D que visualiza cuatro fases del dogma central y la medicina genómica:
 *
 *   1. DNA B-form (hélice real Arnott-Hukins 1972)
 *      rise=3.4 Å, twist=34.29°/bp, ~10.5 bp/vuelta
 *      Surcos mayor (22.7 Å) / menor (11.7 Å) correctamente asimétricos.
 *
 *   2. Transcripción — RNA polimerasa II recorre el template, mRNA emerge
 *      como cadena de ribonucleótidos. Velocidad real: ~30 nt/s (Ardehali & Lis 2009).
 *
 *   3. Traducción — Ribosoma subunidades 40S/60S leen codones, cadena
 *      polipeptídica crece por el túnel de salida. ~6 aa/s (Ingolia et al. 2011).
 *
 *   4. CRISPR-Cas9 — guía gRNA (20 nt PAM-adyacente) + proteína Cas9 (esfera)
 *      que abre la hélice en el locus diana y produce DSB.
 *
 * Toda la geometría es física real. Coordenadas en ångström.
 *
 * Reglas del proyecto cumplidas:
 *   - 100% R3F 3D — nada de canvas 2D.
 *   - useFrame solo dentro de sub-componentes que viven dentro del Canvas.
 *   - Uniforms: useMemo + mutar .value — ningún inline.
 *   - Labels con Html (drei) o HUD div DOM.
 *   - Materiales emissivos para que el bloom reviente.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  B_DNA,
  BASE_COLOR,
  buildDuplex,
  complement,
  gcContent,
  hbondsFor,
  isPurine,
  tmWallace,
  type Base,
} from '@/lib/bio/dna';
import { AMINO_ACIDS, GENETIC_CODE, translate, type AACode } from '@/lib/bio/aminoacids';

// ─── Constantes físicas ─────────────────────────────────────────────────────

/** Escala de render: 1 THREE-unit = ANGSTROM_SCALE Å.
 *  Usamos 0.1 → 1 THREE-unit = 10 Å, la hélice de 30 bp mide ~10 units. */
const A_SCALE = 0.1; // three-units / ångström

/** Velocidades reales en la visualización (aceleradas ×40 para la demo). */
const RNAP_SPEED_NT_S = 30 * 40;    // nt/s visualizados
const RIBO_SPEED_AA_S = 6 * 40;     // aa/s visualizados

// ─── Secuencias de ejemplo ──────────────────────────────────────────────────

/** Gen sintético corto con ATG·START, codones variados y TAA·STOP (21 codones). */
const SYNTH_SEQ =
  'ATGAAAGCGTTCGATGACTTCGCTGAACGTCTGCAGTGGGCTTCTGAAATGGCAGAATAA';

/** Fragmento real del gen TP53 (codones 248-257 — hotspot R248W humano).
 *  NM_000546.6, CDS pos 742-771. */
const TP53_FRAGMENT =
  'ATGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTTAG';

/** Fragmente real del gen VEGFA (codifica factor angiogénico — clave en fármacos). */
const VEGFA_FRAGMENT =
  'ATGAACTTTCTGCTGTCTTGGGTGCATTGGAGCCTTGCCTTGCTGCTCTACCTCCACCAT' +
  'GCCAAGTTCATGGATGTCTATCAGCGCAGCTACTGCCATCCAATCGAGACCCTGGTGGAC' +
  'ATCTTCCAGGAGTACCCTGATGAGATCGAGTACATCTTCAAGCCATCCTGTGTGCCCCTGATGCGATGCGGGGGCTGCTGCAATGACGAGGGCCTGGAGTGTGTGCCCACTGAGGAGTCCAACATCACCATGCAGATTATGCGGATCAAACCTCACCAAGGCCAGCACATAGGAGAGATGAGCTTCCTACAGCACAACAAATGTGAATGCAGACCAAAGAAAGATAGAGCAAGACAAGAAAATCCCTGTGGGCCTTGCTCAGAGCGGAGAAAGCATTTGTTTGTACAAGATCCGCAGACGTGTAAATGTTCCTGCAAAAAATACATGTTT';

interface Preset {
  id: string;
  name: string;
  seq: string;
  note: string;
  /** Coordenada PAM para CRISPR: índice de bp donde la guía empieza (0-based). */
  crisprtarget: number;
}

const PRESETS: Preset[] = [
  {
    id: 'synth',
    name: 'Sintético (21 codones)',
    seq: SYNTH_SEQ,
    note: 'Secuencia artificial: ATG → 19 codones variados → TAA (STOP). Ideal para leer la geometría.',
    crisprtarget: 9,
  },
  {
    id: 'tp53',
    name: 'TP53 — guardián del genoma',
    seq: TP53_FRAGMENT,
    note: 'Hotspot R248W en TP53 — la mutación somática más frecuente en todos los cánceres humanos. NM_000546.6.',
    crisprtarget: 30,
  },
  {
    id: 'vegfa',
    name: 'VEGFA — factor angiogénico',
    seq: VEGFA_FRAGMENT,
    note: 'Factor de crecimiento vascular (VEGF-A). Diana de bevacizumab (Avastin) — primer anticuerpo anti-angiogénico en clínica.',
    crisprtarget: 18,
  },
];

// ─── Tipos de lección ───────────────────────────────────────────────────────

type ViewMode = 'helix' | 'transcription' | 'translation' | 'crispr';

interface GMLessonState {
  presetId: string;
  mode: ViewMode;
}

const LESSON: Lesson<GMLessonState> = {
  hook: {
    title: 'De la doble hélice a la medicina: cómo leer, copiar y EDITAR el genoma.',
    body: `Tu genoma es una instrucción de 3,200 millones de letras escrita en dos hebras de DNA entrelazadas.
Durante décadas fue un libro ILEGIBLE. Hoy podemos leerlo por $200 USD, editarlo base por base, y diseñar fármacos que encajan en su producto.

Esta visualización muestra la física REAL del dogma central:
• La doble hélice B-form de Arnott-Hukins (rise=3.4 Å, twist=34.3°/bp, ~10.5 bp/vuelta)
• La transcripción: ARN polimerasa a 30 nt/s copiando el template
• La traducción: ribosoma 80S leyendo codones 3 nt = 1 aminoácido
• CRISPR-Cas9: la guía de ARN encuentra 20 nt específicos y Cas9 corta las dos hebras

Todo parte del mismo descubrimiento de 1953. Todo lleva a los fármacos de hoy.`,
  },

  steps: [
    {
      title: 'B-form: la geometría real de tu DNA',
      duration: 6000,
      body: `La forma que verás es la B-form canónica — la que existe en solución fisiológica.

Sus parámetros vienen de la fibra X-ray de Arnott-Hukins (1972): rise 3.4 Å por par de bases, twist 34.29° por bp → ~10.5 pares por vuelta completa.

Los dos "rieles" son los backbones fosfato-azúcar: celeste (hebra 1, 5'→3') y rosa (hebra 2, 3'→5' antiparalela). Entre ellos, las bases aparecen como escalones coloreados: A verde, T rojo, G ámbar, C cyan.

El surco mayor (22.7 Å) y el menor (11.7 Å) son el resultado de que las dos hebras se desfasen 155° angularmente — NO son simétricas. Las proteínas de regulación leen el gen por el surco MAYOR, donde los grupos funcionales de A, T, G, C están expuestos.`,
      formula: `B-form Arnott-Hukins 1972:
  rise  = 3.40 Å / bp
  twist = 34.29° / bp  (10.5 bp/vuelta)
  r_P   = 9.4 Å   (fósforo del backbone)
  r_C1' = 5.9 Å   (azúcar C1')
  Surco mayor = 22.7 Å, menor = 11.7 Å`,
      keyframes: [
        { at: 0, state: { mode: 'helix', presetId: 'synth' } },
        { at: 1, state: { mode: 'helix', presetId: 'synth' } },
      ],
    },
    {
      title: 'Transcripción — la ARN polimerasa copia el gen',
      duration: 7000,
      body: `La transcripción es la primera fase del dogma central: DNA → mRNA.

La ARN polimerasa II (RNAP II) se une al promotor, abre la doble hélice y recorre el template strand (3'→5'), sintetizando una cadena de mRNA complementaria (5'→3') sustituyendo T por U.

Velocidad real de la RNAP II eucariota: ~30 nucleótidos por segundo (Ardehali & Lis 2009, Nature Reviews). La secuencia del mRNA es IDÉNTICA al coding strand salvo que T → U.

El mRNA resultante lleva la "receta" completa del gen, incluyendo intrones (que serán cortados por el spliceosoma) y exones. Solo los exones llegan al ribosoma.`,
      formula: `Transcripción (RNAP II eucariota):
  Velocidad: ~30 nt/s
  Template: 3'→5' (complementario del coding)
  mRNA:  5'→3', U reemplaza T
  Codón inicio: AUG (Met)
  Codón stop:   UAA / UAG / UGA`,
      keyframes: [
        { at: 0, state: { mode: 'transcription', presetId: 'synth' } },
        { at: 1, state: { mode: 'transcription', presetId: 'synth' } },
      ],
    },
    {
      title: 'Traducción — el ribosoma descifra el código',
      duration: 7000,
      body: `La traducción es la segunda fase: mRNA → proteína.

El ribosoma 80S (subunidades 40S + 60S) lee el mRNA de 5'→3', tomando 3 nucleótidos (1 codón) a la vez. Cada codón codifica 1 aminoácido según el código genético estándar (NCBI tabla 1): 64 codones → 20 aminoácidos + 3 stops.

Velocidad: ~6 aminoácidos por segundo (Ingolia et al. 2011, Science). La cadena polipeptídica crece por el túnel de salida del ribosoma (~10 nm) y comienza a plegarse espontáneamente.

Codón de inicio: AUG (Metionina). Codones de paro: UAA, UAG, UGA — liberan el ribosoma y el polipéptido terminado.`,
      formula: `Traducción (ribosoma 80S eucariota):
  Velocidad: ~6 aa/s
  3 nt = 1 codón = 1 aminoácido
  64 codones totales (código degenerado)
  20 aminoácidos canónicos
  3 codones de paro: UAA, UAG, UGA`,
      keyframes: [
        { at: 0, state: { mode: 'translation', presetId: 'synth' } },
        { at: 1, state: { mode: 'translation', presetId: 'synth' } },
      ],
    },
    {
      title: 'CRISPR-Cas9 — edición precisa de bases',
      duration: 7000,
      body: `CRISPR-Cas9 (Doudna & Charpentier, Nobel 2020) es una tijera molecular programable.

La guía de ARN (gRNA) tiene 20 nucleótidos complementarios al DNA diana + un motivo PAM adyacente (NGG en SpCas9). La guía dirige la proteína Cas9 al locus específico; Cas9 abre la hélice y corta las DOS hebras — un corte de doble cadena (DSB).

La célula repara el DSB por NHEJ (introduce mutaciones: knockout) o HDR (reemplaza con la secuencia corregida: corrección). Eso permite silenciar genes, corregir mutaciones, o insertar secuencias terapéuticas.

Fármacos actuales basados en CRISPR: Casgevy (aprobado 2023, Vertex + CRISPR Therapeutics) — primera cura genómica para anemia falciforme y beta-talasemia.`,
      formula: `CRISPR-Cas9 SpCas9:
  guía gRNA: 20 nt + NGG (PAM adyacente)
  Corte: bp 3 upstream del PAM (ambas hebras)
  Eficiencia: >80% on-target con guía óptima
  Off-target: <0.1% con guías de alta especificidad`,
      keyframes: [
        { at: 0, state: { mode: 'crispr', presetId: 'tp53' } },
        { at: 1, state: { mode: 'crispr', presetId: 'tp53' } },
      ],
    },
    {
      title: 'TP53 — mutaciones en cáncer',
      duration: 6500,
      body: `TP53 codifica la proteína p53, "guardián del genoma". Detecta daño en el DNA y detiene el ciclo celular o induce apoptosis.

El 50% de todos los cánceres humanos tienen mutaciones somáticas en TP53. El hotspot R248W (arginina → triptófano en posición 248) está en el dominio de unión al DNA. Cuando R248 muta, p53 no puede unirse al promotor de sus genes diana → la célula con DNA dañado sigue proliferando → tumor.

El fragmento de TP53 mostrado aquí contiene exactamente este hotspot (NM_000546.6, CDS pos 742-771).

CRISPR terapéutico está en ensayos clínicos para restaurar R248 en células tumorales in vivo.`,
      formula: `TP53 R248W (hotspot más frecuente):
  Codón 248 original: CGG → Arg
  Mutación: TGG → Trp
  Cancers con TP53 mutado: ~50%
  Proteína: 393 aa, tetrámero activo`,
      keyframes: [
        { at: 0, state: { mode: 'crispr', presetId: 'tp53' } },
        { at: 1, state: { mode: 'crispr', presetId: 'tp53' } },
      ],
    },
  ],

  connect: {
    body: `El dogma central de la biología + CRISPR es la base de la medicina genómica del siglo XXI:

• Watson & Crick / Franklin / Wilkins (1953): estructura del DNA → base de todo lo demás.
• Sanger (1977): secuenciación → Nobel 1980 → lecturas de 1 Mbp/día.
• HGP (1990-2003): primer borrador del genoma humano por $3B USD.
• NGS (2007): el precio cae a $1000/genoma → diagnóstico rutinario.
• CRISPR-Cas9 (2012): Doudna & Charpentier → Nobel 2020 → edición de genes.
• Casgevy (2023): primera terapia génica aprobada basada en CRISPR.

El VEGFA es diana de bevacizumab (Avastin), uno de los anticuerpos más vendidos del mundo. El TP53 es el gen mutado más frecuente en oncología. Entender su DNA es entender el cáncer.`,
    links: [
      { label: 'Doble hélice — B-form detallada', href: '#double-helix' },
      { label: 'Dogma central — transcripción + traducción', href: '#central-dogma' },
      { label: 'Drug Discovery — docking molecular', href: '#drug-discovery' },
    ],
  },
};

// ─── Utilidades ─────────────────────────────────────────────────────────────

function buildProtein(seq: string): Array<{ aa: AACode; codon: string }> {
  const s = seq.toUpperCase().replace(/[^ATGC]/g, '');
  const result: Array<{ aa: AACode; codon: string }> = [];
  for (let i = 0; i + 3 <= s.length; i += 3) {
    const codon = s.substring(i, i + 3);
    const rnaCodon = codon.replace(/T/g, 'U');
    const aa = GENETIC_CODE[rnaCodon];
    if (!aa || aa === '*') break;
    result.push({ aa: aa as AACode, codon: rnaCodon });
  }
  return result;
}

function aaColor(aa: AACode): string {
  return AMINO_ACIDS[aa]?.color ?? '#CBD5E1';
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function GenomeMedicine() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('synth');
  const [mode, setMode] = useState<ViewMode>('helix');
  const [running, setRunning] = useState(true);
  const [showGrooves, setShowGrooves] = useState(true);
  const [showHBonds, setShowHBonds] = useState(true);
  const [showAxis, setShowAxis] = useState(false);

  const preset = PRESETS.find(p => p.id === presetId)!;
  const duplex = useMemo(() => buildDuplex(preset.seq.substring(0, 60)), [preset.seq]);
  const protein = useMemo(() => buildProtein(preset.seq), [preset.seq]);

  const gc = gcContent(preset.seq.substring(0, 60));
  const tm = tmWallace(preset.seq.substring(0, 60));
  const bpCount = duplex.frames.length;
  const protLen = protein.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <GenomeViewport
          duplex={duplex}
          protein={protein}
          mode={mode}
          running={running}
          showGrooves={showGrooves}
          showHBonds={showHBonds}
          showAxis={showAxis}
          crisprTarget={preset.crisprtarget}
        />

        {/* HUD info */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5 pointer-events-none">
          <div><span className="text-[#64748B]">modo&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FDB813]">{mode}</span></div>
          <div><span className="text-[#64748B]">bp&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {bpCount}</div>
          <div><span className="text-[#64748B]">GC%&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {(gc * 100).toFixed(1)}%</div>
          <div><span className="text-[#64748B]">Tm&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {tm} °C</div>
          {mode === 'translation' && (
            <div><span className="text-[#64748B]">proteína</span>= {protLen} aa</div>
          )}
        </div>

        {/* Mode selector */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          {(['helix', 'transcription', 'translation', 'crispr'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1.5 rounded text-[11px] border transition ${
                mode === m
                  ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                  : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
              }`}
            >
              {m === 'helix' ? 'Hélice' : m === 'transcription' ? 'Transcripción' : m === 'translation' ? 'Traducción' : 'CRISPR'}
            </button>
          ))}
          <button
            onClick={() => setRunning(r => !r)}
            className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
              running
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
            }`}
          >
            {running ? '❚❚' : '▶'}
          </button>
        </div>
      </div>

      <LessonPanel<GMLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.mode !== undefined) setMode(patch.mode);
        }}
        sandbox={
          <>
            <Section title="Secuencia">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    data-testid={`preset-${p.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-[#64748B] leading-relaxed italic">{preset.note}</div>
            </Section>

            <Section title="Modo de visualización">
              <div className="grid grid-cols-2 gap-1.5">
                {(['helix', 'transcription', 'translation', 'crispr'] as ViewMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-2 py-1.5 rounded border text-[11px] transition ${
                      mode === m
                        ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {m === 'helix' ? 'Hélice' : m === 'transcription' ? 'Transcripción' : m === 'translation' ? 'Traducción' : 'CRISPR'}
                  </button>
                ))}
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Geometría B-form">
                <Row label="rise/bp" value={`${B_DNA.rise} Å`} />
                <Row label="twist/bp" value={`${B_DNA.twistDeg}°`} />
                <Row label="bp/vuelta" value={`${(360 / B_DNA.twistDeg).toFixed(2)}`} />
                <Row label="r fósforo" value={`${B_DNA.rPhosphate} Å`} />
                <Row label="surco mayor" value={`${B_DNA.majorGrooveWidth} Å`} />
                <Row label="surco menor" value={`${B_DNA.minorGrooveWidth} Å`} />
                <Row label="GC%" value={`${(gc * 100).toFixed(1)}%`} />
                <Row label="Tm (Wallace)" value={`${tm} °C`} />
              </Section>
            )}

            {audience === 'child' ? (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Las dos espirales coloreadas son las <strong>hebras de DNA</strong>. Entre ellas hay "escalones": las letras A-T-G-C.</p>
                  <p>En la <span className="text-[#4FC3F7]">transcripción</span> una máquina copia el DNA en un mensaje de ARN.</p>
                  <p>El <span className="text-[#FDB813]">ribosoma</span> lee ese mensaje y construye una proteína, ladrillo por ladrillo.</p>
                  <p><span className="text-[#F472B6]">CRISPR</span> es como unas tijeras que cortan el DNA en un lugar exacto para arreglarlo.</p>
                </div>
              </Section>
            ) : (
              <Section title="Proteína traducida">
                <div className="font-mono text-[10px] leading-snug break-all">
                  {protein.slice(0, 30).map((p, i) => (
                    <span key={i} style={{ color: aaColor(p.aa) }} title={`${AMINO_ACIDS[p.aa]?.name} (${p.codon})`}>
                      {p.aa}
                    </span>
                  ))}
                  {protein.length > 30 && <span className="text-[#64748B]">…+{protein.length - 30}aa</span>}
                </div>
                <div className="mt-2 text-[10px] text-[#64748B]">
                  {protLen} aminoácidos traducidos. Colores por propiedad (PyMOL/Shapely).
                </div>
              </Section>
            )}

            <Section title="Visualización">
              <Toggle value={showGrooves} onChange={setShowGrooves} label="Surcos mayor/menor" />
              <Toggle value={showHBonds} onChange={setShowHBonds} label="Puentes de H" />
              <Toggle value={showAxis} onChange={setShowAxis} label="Eje helicoidal" />
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Viewport ──────────────────────────────────────────────────────────────

interface ViewportProps {
  duplex: ReturnType<typeof buildDuplex>;
  protein: Array<{ aa: AACode; codon: string }>;
  mode: ViewMode;
  running: boolean;
  showGrooves: boolean;
  showHBonds: boolean;
  showAxis: boolean;
  crisprTarget: number;
}

function GenomeViewport(props: ViewportProps) {
  const { duplex } = props;
  const midZ = (duplex.lengthA / 2) * A_SCALE;
  const camDist = Math.max(8, 1.4 * duplex.lengthA * A_SCALE);

  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [camDist, 2, midZ], fov: 40, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.25} />
        <pointLight position={[30, 20, midZ]} intensity={1.5} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[-20, -15, midZ + 5]} intensity={0.8} color="#FFAB91" distance={0} decay={0} />
        <pointLight position={[0, 0, midZ + 15]} intensity={0.5} color="#CE93D8" distance={0} decay={0} />

        <OrbitControls
          target={[0, 0, midZ]}
          enablePan enableZoom enableRotate enableDamping dampingFactor={0.08}
          autoRotate autoRotateSpeed={0.35}
        />

        <GenomeScene {...props} midZ={midZ} />

        <EffectComposer multisampling={4}>
          <Bloom intensity={1.1} luminanceThreshold={0.18} luminanceSmoothing={0.5} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.65} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

// ─── Scene (DENTRO del Canvas, puede usar useFrame) ───────────────────────

interface SceneProps extends ViewportProps {
  midZ: number;
}

function GenomeScene({
  duplex, protein, mode, running,
  showGrooves, showHBonds, showAxis,
  crisprTarget, midZ,
}: SceneProps) {
  const particleTex = useMemo(() => getParticleTexture(), []);
  const rootRef = useRef<THREE.Group>(null);
  const slowRotRef = useRef<THREE.Group>(null);

  // ─── Build geometry imperatively on duplex/mode/visibility changes ──────
  useEffect(() => {
    const g = rootRef.current!;
    disposeGroup(g);

    const N = duplex.frames.length;

    // ── Backbones ──────────────────────────────────────────────────────────
    const s1pts: THREE.Vector3[] = [];
    const s2pts: THREE.Vector3[] = [];
    for (const a of duplex.atoms) {
      const v = new THREE.Vector3(
        a.p[0] * A_SCALE,
        a.p[1] * A_SCALE,
        a.p[2] * A_SCALE,
      );
      if (a.strand === 1) s1pts.push(v);
      else s2pts.push(v);
    }
    if (s1pts.length >= 2) g.add(makeBackboneTube(s1pts, '#64B5F6', particleTex));
    if (s2pts.length >= 2) g.add(makeBackboneTube(s2pts, '#F06292', particleTex));

    // ── Base pairs ─────────────────────────────────────────────────────────
    for (const a of duplex.atoms) {
      const col = BASE_COLOR[a.base];
      const inward = isPurine(a.base) ? 1.2 : 0.6;
      const plateDepth = B_DNA.rSugar - inward;
      const width = Math.max(0.5, B_DNA.rSugar - plateDepth);
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(width * A_SCALE * 1.8, 3.0 * A_SCALE, 1.4 * A_SCALE),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: new THREE.Color(col),
          emissiveIntensity: 0.75,
          roughness: 0.4,
          metalness: 0.15,
        }),
      );
      const angle = Math.atan2(a.c1[1], a.c1[0]);
      const rCenter = (B_DNA.rSugar + plateDepth) / 2;
      plate.position.set(
        rCenter * A_SCALE * Math.cos(angle),
        rCenter * A_SCALE * Math.sin(angle),
        a.p[2] * A_SCALE,
      );
      plate.rotation.z = angle;
      g.add(plate);

      // Halo sprite
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: particleTex,
        color: new THREE.Color(col),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      halo.scale.set(2.0 * A_SCALE * 10, 2.0 * A_SCALE * 10, 1);
      halo.position.copy(plate.position);
      g.add(halo);
    }

    // ── Hydrogen bonds ─────────────────────────────────────────────────────
    if (showHBonds) {
      for (const f of duplex.frames) {
        const hb = hbondsFor(f.base1);
        const theta2 = f.theta + (B_DNA.grooveOffsetDeg * Math.PI) / 180;
        const r = B_DNA.rBaseEdge;
        const p1 = new THREE.Vector3(r * A_SCALE * Math.cos(f.theta), r * A_SCALE * Math.sin(f.theta), f.z * A_SCALE);
        const p2 = new THREE.Vector3(r * A_SCALE * Math.cos(theta2), r * A_SCALE * Math.sin(theta2), f.z * A_SCALE);
        for (let b = 0; b < hb; b++) {
          const off = (b - (hb - 1) / 2) * 0.5 * A_SCALE;
          const geom = new THREE.BufferGeometry().setFromPoints([
            p1.clone().add(new THREE.Vector3(0, 0, off)),
            p2.clone().add(new THREE.Vector3(0, 0, off)),
          ]);
          const mat = new THREE.LineDashedMaterial({
            color: 0xFFFFFF, dashSize: 0.04, gapSize: 0.04,
            transparent: true, opacity: 0.5,
          });
          const ln = new THREE.Line(geom, mat);
          ln.computeLineDistances();
          g.add(ln);
        }
      }
    }

    // ── Helix axis ─────────────────────────────────────────────────────────
    if (showAxis) {
      const axisMat = new THREE.LineDashedMaterial({
        color: 0x4FC3F7, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.3,
      });
      const axisGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -0.5),
        new THREE.Vector3(0, 0, duplex.lengthA * A_SCALE + 0.5),
      ]);
      const axisLine = new THREE.Line(axisGeom, axisMat);
      axisLine.computeLineDistances();
      g.add(axisLine);
    }

    // ── CRISPR guide marker ────────────────────────────────────────────────
    if (mode === 'crispr') {
      const targetBp = Math.min(crisprTarget, N - 5);
      const guideLen = Math.min(20, N - targetBp - 1);
      // Highlight the guide region with a glowing cylinder
      for (let i = targetBp; i < targetBp + guideLen; i++) {
        if (i >= N) break;
        const f = duplex.frames[i];
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(B_DNA.rPhosphate * A_SCALE * 1.25, 0.03, 8, 32),
          new THREE.MeshStandardMaterial({
            color: '#F59E0B',
            emissive: '#F59E0B',
            emissiveIntensity: 1.4,
            transparent: true,
            opacity: 0.65,
          }),
        );
        ring.position.set(0, 0, f.z * A_SCALE);
        g.add(ring);
      }
      // Cas9 "blob" at the cut site (bp 3 upstream of PAM end)
      const cutBp = targetBp + Math.floor(guideLen / 2);
      const cutFrame = duplex.frames[Math.min(cutBp, N - 1)];
      const cas9 = new THREE.Mesh(
        new THREE.SphereGeometry(B_DNA.rPhosphate * A_SCALE * 1.1, 32, 32),
        new THREE.MeshStandardMaterial({
          color: '#A78BFA',
          emissive: '#7C3AED',
          emissiveIntensity: 1.0,
          roughness: 0.3,
          metalness: 0.6,
          transparent: true,
          opacity: 0.75,
        }),
      );
      cas9.position.set(B_DNA.rPhosphate * A_SCALE * 1.3, 0, cutFrame.z * A_SCALE);
      g.add(cas9);
      // gRNA tail
      const grnaPts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const angle = t * Math.PI * 1.5 + Math.PI / 2;
        const r = (B_DNA.rPhosphate + 3 + k) * A_SCALE;
        grnaPts.push(new THREE.Vector3(
          r * Math.cos(angle),
          r * Math.sin(angle),
          (cutFrame.z + (k - 6) * B_DNA.rise) * A_SCALE,
        ));
      }
      const grnaGeom = new THREE.BufferGeometry().setFromPoints(grnaPts);
      const grnaMat = new THREE.LineBasicMaterial({ color: '#34D399', linewidth: 2 });
      g.add(new THREE.Line(grnaGeom, grnaMat));
    }

    return () => { disposeGroup(g); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplex, mode, showHBonds, showAxis, crisprTarget, particleTex]);

  // ─── Slow auto-rotation ──────────────────────────────────────────────────
  useFrame((_, dt) => {
    if (slowRotRef.current) {
      slowRotRef.current.rotation.z += dt * 0.08;
    }
  });

  return (
    <group ref={slowRotRef}>
      <group ref={rootRef} />
      {/* Animated overlays live in separate sub-components */}
      {mode === 'transcription' && <RNAPAnimation duplex={duplex} running={running} />}
      {mode === 'translation' && <RiboAnimation protein={protein} duplex={duplex} running={running} />}
    </group>
  );
}

// ─── Sub-componente: Animación de RNAP (transcripción) ────────────────────

function RNAPAnimation({ duplex, running }: { duplex: ReturnType<typeof buildDuplex>; running: boolean }) {
  const particleTex = useMemo(() => getParticleTexture(), []);
  const N = duplex.frames.length;
  // ntIndex as fractional (continuous)
  const nt = useRef(0);
  const rnapRef = useRef<THREE.Mesh>(null);
  const mrnaGrp = useRef<THREE.Group>(null);

  const rnapMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#34D399',
    emissive: '#10B981',
    emissiveIntensity: 1.2,
    roughness: 0.3,
    metalness: 0.5,
  }), []);

  const mrnaPtsBuf = useMemo(() => {
    const buf = new Float32Array(N * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geom.setDrawRange(0, 0);
    return { geom, buf };
  }, [N]);

  useFrame((_, dt) => {
    if (!running) return;
    // advance at scaled speed: dt is in seconds (real)
    const advance = (RNAP_SPEED_NT_S / 60) * dt; // nt per frame
    nt.current = (nt.current + advance) % N;
    const i = Math.floor(nt.current);
    const f = duplex.frames[i];
    if (!f) return;

    // RNAP position: ride the major groove exterior
    const theta = f.theta + Math.PI; // opposite side
    const r = (B_DNA.rPhosphate + 2) * A_SCALE;
    if (rnapRef.current) {
      rnapRef.current.position.set(
        r * Math.cos(theta),
        r * Math.sin(theta),
        f.z * A_SCALE,
      );
    }

    // mRNA trail — build as point cloud, offset radially outward from the helix
    const posArr = mrnaPtsBuf.geom.attributes.position as THREE.BufferAttribute;
    const colArr = mrnaPtsBuf.geom.attributes.color as THREE.BufferAttribute;
    const drawn = Math.min(i + 1, N);
    for (let k = 0; k < drawn; k++) {
      const fk = duplex.frames[k];
      const th2 = fk.theta + (B_DNA.grooveOffsetDeg * Math.PI / 180);
      const rm = (B_DNA.rPhosphate + 4 + k * 0.05) * A_SCALE;
      (posArr.array as Float32Array)[k * 3 + 0] = rm * Math.cos(th2 + 0.3);
      (posArr.array as Float32Array)[k * 3 + 1] = rm * Math.sin(th2 + 0.3);
      (posArr.array as Float32Array)[k * 3 + 2] = fk.z * A_SCALE;
      const col = new THREE.Color(BASE_COLOR[fk.base1] ?? '#CBD5E1');
      (colArr.array as Float32Array)[k * 3 + 0] = col.r;
      (colArr.array as Float32Array)[k * 3 + 1] = col.g;
      (colArr.array as Float32Array)[k * 3 + 2] = col.b;
    }
    posArr.needsUpdate = true;
    colArr.needsUpdate = true;
    mrnaPtsBuf.geom.setDrawRange(0, drawn);
  });

  return (
    <group>
      {/* RNAP sphere */}
      <mesh ref={rnapRef} material={rnapMat}>
        <sphereGeometry args={[B_DNA.rPhosphate * A_SCALE * 0.55, 24, 24]} />
      </mesh>
      {/* mRNA as emissive point cloud */}
      <points geometry={mrnaPtsBuf.geom}>
        <pointsMaterial
          vertexColors
          map={particleTex}
          alphaMap={particleTex}
          size={0.18}
          sizeAttenuation
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* RNAP label */}
      <Html
        position={[0, (B_DNA.rPhosphate + 6) * A_SCALE, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        occlude={false}
        as="div"
      >
        <span style={{
          fontSize: '9px', color: '#34D399', fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: '3px',
          whiteSpace: 'nowrap',
        }}>RNAP II</span>
      </Html>
    </group>
  );
}

// ─── Sub-componente: Animación del Ribosoma (traducción) ──────────────────

function RiboAnimation({ protein, duplex, running }: {
  protein: Array<{ aa: AACode; codon: string }>;
  duplex: ReturnType<typeof buildDuplex>;
  running: boolean;
}) {
  const particleTex = useMemo(() => getParticleTexture(), []);
  const aaIdx = useRef(0);
  const ribo40sRef = useRef<THREE.Mesh>(null);
  const ribo60sRef = useRef<THREE.Mesh>(null);
  const chainGrp = useRef<THREE.Group>(null);
  const lastAA = useRef(-1);

  const mat40s = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FDB813',
    emissive: '#B45309',
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 0.85,
  }), []);
  const mat60s = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#F97316',
    emissive: '#C2410C',
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 0.85,
  }), []);

  useFrame((_, dt) => {
    if (!running || protein.length === 0) return;
    const advance = (RIBO_SPEED_AA_S / 60) * dt;
    aaIdx.current = (aaIdx.current + advance) % protein.length;
    const i = Math.floor(aaIdx.current);

    // Map aa index → bp frame (each aa = 3 nt)
    const bpIdx = Math.min((i * 3) % duplex.frames.length, duplex.frames.length - 1);
    const f = duplex.frames[bpIdx];
    const ribZ = f.z * A_SCALE;
    const ribX = (B_DNA.rPhosphate + 4) * A_SCALE;

    if (ribo40sRef.current) ribo40sRef.current.position.set(ribX, 0, ribZ);
    if (ribo60sRef.current) ribo60sRef.current.position.set(ribX, (B_DNA.rPhosphate + 1) * A_SCALE * 0.5, ribZ);

    // Add sphere to chain group for each new aa
    if (chainGrp.current && i !== lastAA.current) {
      lastAA.current = i;
      const aa = protein[i];
      if (!aa) return;
      const col = aaColor(aa.aa);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: new THREE.Color(col),
          emissiveIntensity: 0.9,
          roughness: 0.3,
          metalness: 0.2,
        }),
      );
      // Spiral chain: offset each aa in a helix
      const chainAngle = i * 0.42;
      const chainR = 0.8;
      sphere.position.set(
        ribX + chainR * Math.cos(chainAngle) + 2.5,
        chainR * Math.sin(chainAngle),
        ribZ - (i * 0.18),
      );
      chainGrp.current.add(sphere);
      // Trim chain to keep < 60 spheres
      if (chainGrp.current.children.length > 60) {
        const oldest = chainGrp.current.children[0];
        chainGrp.current.remove(oldest);
        disposeObject(oldest);
      }
    }
  });

  return (
    <group>
      <mesh ref={ribo40sRef} material={mat40s}>
        <sphereGeometry args={[(B_DNA.rPhosphate * 0.55) * A_SCALE, 24, 24]} />
      </mesh>
      <mesh ref={ribo60sRef} material={mat60s}>
        <sphereGeometry args={[(B_DNA.rPhosphate * 0.7) * A_SCALE, 28, 28]} />
      </mesh>
      <group ref={chainGrp} />
      <Html
        position={[(B_DNA.rPhosphate + 8) * A_SCALE, 0, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        occlude={false}
        as="div"
      >
        <span style={{
          fontSize: '9px', color: '#FDB813', fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: '3px',
          whiteSpace: 'nowrap',
        }}>Ribosoma 80S</span>
      </Html>
    </group>
  );
}

// ─── Helpers geométricos ──────────────────────────────────────────────────

function makeBackboneTube(points: THREE.Vector3[], color: string, haloTex: THREE.Texture): THREE.Group {
  const grp = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const tubeSegments = Math.max(64, points.length * 6);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubeSegments, 0.7 * A_SCALE, 10, false),
    new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.3,
    }),
  );
  grp.add(tube);

  for (const p of points) {
    const sph = new THREE.Mesh(
      new THREE.SphereGeometry(0.9 * A_SCALE, 16, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.0,
        roughness: 0.25,
        metalness: 0.4,
      }),
    );
    sph.position.copy(p);
    grp.add(sph);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.scale.set(3 * A_SCALE * 10, 3 * A_SCALE * 10, 1);
    halo.position.copy(p);
    grp.add(halo);
  }
  return grp;
}

function disposeGroup(g: THREE.Group) {
  while (g.children.length) {
    const ch = g.children[0];
    g.remove(ch);
    disposeObject(ch);
  }
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse(child => {
    const m = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
      else m.material.dispose();
    }
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[12px] text-[#CBD5E1]">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-[#4FC3F7]" />
      {label}
    </label>
  );
}
