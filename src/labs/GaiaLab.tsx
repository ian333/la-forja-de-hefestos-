/**
 * GaiaLab — Workspace unificado, construido desde la física cuántica.
 *
 * Layout chemistry-first (Fase 1 del ROADMAP_CHEMISTRY.md):
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Header (sticky)                                                  │
 *   ├──────────────┬──────────────────────────────────────────────────┤
 *   │ Dock         │                                                  │
 *   │  ┌────────┐  │           HERO VIEWPORT 3D                       │
 *   │  │PeriodTb│  │           (el héroe; no se tapa)                 │
 *   │  └────────┘  │                                                  │
 *   │  ┌────────┐  │  ┌──────────────────────────────────────┐        │
 *   │  │HoverInf│  │  │ Overlay panel (info, controles)      │        │
 *   │  └────────┘  │  └──────────────────────────────────────┘        │
 *   └──────────────┴──────────────────────────────────────────────────┘
 *
 * La PeriodicTable es "ley absoluta": dock permanente colapsable, click
 * cambia el elemento activo para CUALQUIER tab (átomo, enlace, reacción).
 *
 * Filosofía: construimos la química desde abajo — ψ(r,θ,φ), configuración
 * electrónica real, orbitales, valencia. Todo lo demás es consecuencia.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PERIODIC_TABLE, elementByZ, configCompact } from '@/lib/chem/quantum/periodic-table';
import { completeLesson } from '@/lib/progress';
import { telemetry } from '@/lib/telemetry';
import PeriodicTable from './components/PeriodicTable';
import MultiElectronAtomView from './components/MultiElectronAtomView';
import CinematicAtom from '@/cinematic/CinematicAtom';
import CinematicMolecule, { MOLECULE_GALLERY, molMeta } from '@/cinematic/CinematicMolecule';
import BondTab from './components/BondTab';
import ReactionTab from './components/ReactionTab';
import SandboxTab from './components/SandboxTab';

const ELEMENT_AUDIO: Record<number, string> = {
  1:'01-hidrogeno',2:'02-helio',3:'03-litio',4:'04-berilio',5:'05-boro',
  6:'06-carbono',7:'07-nitrogeno',8:'08-oxigeno',9:'09-fluor',10:'10-neon',
  11:'11-sodio',12:'12-magnesio',13:'13-aluminio',14:'14-silicio',15:'15-fosforo',
  16:'16-azufre',17:'17-cloro',18:'18-argon',19:'19-potasio',20:'20-calcio',
  21:'21-escandio',22:'22-titanio',23:'23-vanadio',24:'24-cromo',25:'25-manganeso',
  26:'26-hierro',27:'27-cobalto',28:'28-niquel',29:'29-cobre',30:'30-zinc',
  31:'31-galio',32:'32-germanio',33:'33-arsenico',34:'34-selenio',35:'35-bromo',
  36:'36-kripton',37:'37-rubidio',38:'38-estroncio',39:'39-itrio',40:'40-circonio',
  41:'41-niobio',42:'42-molibdeno',43:'43-tecnecio',44:'44-rutenio',45:'45-rodio',
  46:'46-paladio',47:'47-plata',48:'48-cadmio',49:'49-indio',50:'50-estano',
  51:'51-antimonio',52:'52-telurio',53:'53-yodo',54:'54-xenon',55:'55-cesio',
  56:'56-bario',57:'57-lantano',58:'58-cerio',59:'59-praseodimio',60:'60-neodimio',
  61:'61-prometio',62:'62-samario',63:'63-europio',64:'64-gadolinio',65:'65-terbio',
  66:'66-disprosio',67:'67-holmio',68:'68-erbio',69:'69-tulio',70:'70-iterbio',
  71:'71-lutecio',72:'72-hafnio',73:'73-tantalo',74:'74-wolframio',75:'75-renio',
  76:'76-osmio',77:'77-iridio',78:'78-platino',79:'79-oro',80:'80-mercurio',
  81:'81-talio',82:'82-plomo',83:'83-bismuto',84:'84-polonio',85:'85-astato',
  86:'86-radon',87:'87-francio',88:'88-radio',89:'89-actinio',90:'90-torio',
  91:'91-protactinio',92:'92-uranio',93:'93-neptunio',94:'94-plutonio',95:'95-americio',
  96:'96-curio',97:'97-berkelio',98:'98-californio',99:'99-einstenio',100:'100-fermio',
  101:'101-mendelevio',102:'102-nobelio',103:'103-lawrencio',104:'104-rutherfordio',105:'105-dubnio',
  106:'106-seaborgio',107:'107-bohrio',108:'108-hassio',109:'109-meitnerio',110:'110-darmstadio',
  111:'111-roentgenio',112:'112-copernicio',113:'113-nihonio',114:'114-flerovio',115:'115-moscovio',
  116:'116-livermorio',117:'117-teneso',118:'118-oganeson',
};

type Tab = 'atom' | 'molecule' | 'bond' | 'reaction' | 'sandbox';
type ElementSubs = { dur: number; cues: { t: number; text: string }[] };

// ═══════════════════════════════════════════════════════════════
// TELEMETRÍA CON NOMBRE — qué TOCA la gente que sí se queda
//
// Los clics crudos que ya se guardaban son anónimos: `{tag:"BUTTON",
// cls:"px-3 py-1.5 rounded…", text:"siguien"}` no dice si tocaron el hierro
// o cambiaron de pestaña. Con 130 clics registrados no se podía contestar
// NADA. Estos eventos llevan la intención, no el DOM.
//
// La medida que decide si el hub funciona es `nOrdinal`: cuántos elementos
// DISTINTOS toca una sesión. Si la mediana es 1, la tabla no está invitando
// a explorar y el problema no es el contenido sino la puerta.
//
// Los contadores viven a nivel de módulo (no en un ref) porque la pregunta
// es por SESIÓN, y los componentes que los alimentan (dock, hero, galería)
// se montan y desmontan al cambiar de pestaña.
// ═══════════════════════════════════════════════════════════════
const tocados = { elementos: new Set<number>(), moleculas: new Set<string>(), orbito: false };

function labElemento(Z: number, via: 'tabla' | 'nav') {
  const nuevo = !tocados.elementos.has(Z);
  tocados.elementos.add(Z);
  telemetry.event('lab.elemento', {
    Z,
    simbolo: elementByZ(Z)?.symbol,
    nOrdinal: tocados.elementos.size,   // ← elementos DISTINTOS de la sesión
    nuevo,                              // false = volvió a uno que ya vio
    via,                                // tabla periódica vs botones ← →
  });
}

export default function GaiaLab() {
  const [tab, setTab] = useState<Tab>('atom');
  const [selectedZ, setSelectedZ] = useState(6);
  const [dockOpen, setDockOpen] = useState(true);
  const [hoverZ, setHoverZ] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [caption, setCaption] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subsRef = useRef<Record<number, ElementSubs> | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const tabRef = useRef<Tab>('atom');

  // Carga perezosa del JSON de subtítulos (timestamps por frase, vía forced
  // alignment de ElevenLabs — no gasta cuota de TTS).
  useEffect(() => {
    let alive = true;
    fetch('/audio/tabla-periodica/subtitles.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) subsRef.current = j; })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const playElementAudio = useCallback((Z: number) => {
    const slug = ELEMENT_AUDIO[Z];
    setCaption('');
    if (!slug) { setAudioPlaying(false); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.ontimeupdate = null; audioRef.current = null; }
    const audio = new Audio(`/audio/tabla-periodica/${slug}.mp3`);
    const cues = subsRef.current?.[Z]?.cues ?? [];
    const simbolo = elementByZ(Z)?.symbol;
    audio.onplay = () => {
      setAudioPlaying(true);
      // Escuchar es la señal de intención más cara que puede dar alguien en el
      // lab: se queda quieto minuto y medio. Se mide el arranque y el final por
      // separado porque la diferencia es la retención de la narración.
      telemetry.event('lab.audio', { Z, simbolo, accion: 'play' });
    };
    // Progreso: escuchar una narración de elemento COMPLETA = la tabla ya te habló.
    audio.onended = () => {
      setAudioPlaying(false); setCaption(''); completeLesson('quimica', 'tabla-viva');
      telemetry.event('lab.audio', { Z, simbolo, accion: 'fin', s: Math.round(audio.duration || 0) });
    };
    audio.onpause = () => setAudioPlaying(false);
    audio.ontimeupdate = () => {
      if (!cues.length) return;
      const t = audio.currentTime;
      let cur = '';
      for (const c of cues) { if (t >= c.t) cur = c.text; else break; }
      setCaption(cur);
    };
    // Si el navegador BLOQUEA la reproducción (política de autoplay de iOS)
    // hay que saberlo: sin este evento, "nadie escuchó" y "a nadie lo dejaron
    // escuchar" se ven exactamente igual en el log, y son problemas distintos.
    audio.play().catch(() => {
      setAudioPlaying(false);
      telemetry.event('lab.audio', { Z, simbolo, accion: 'bloqueado' });
    });
    audioRef.current = audio;
  }, []);

  const toggleAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) { playElementAudio(selectedZ); return; }
    if (a.paused) { a.play().catch(() => {}); }
    else { a.pause(); }
  }, [selectedZ, playElementAudio]);

  const handleSelect = useCallback((Z: number) => {
    labElemento(Z, 'tabla');
    setSelectedZ(Z);
    playElementAudio(Z);
  }, [playElementAudio]);

  const handleSelectNav = useCallback((Z: number) => {
    labElemento(Z, 'nav');
    setSelectedZ(Z);
    playElementAudio(Z);
  }, [playElementAudio]);

  // El "de" sale del ref y NO del updater de setTab: en StrictMode los
  // updaters corren dos veces y el evento saldría duplicado en desarrollo.
  const cambiarTab = useCallback((a: Tab) => {
    const de = tabRef.current;
    if (de !== a) telemetry.event('lab.tab', { de, a });
    setTab(a);
    completeLesson('quimica', `tab:${a}`);
  }, []);

  // La pestaña activa es "dónde está" el usuario dentro del lab: se la
  // declaramos a la telemetría para que el evento `salida` diga de qué mesa
  // de trabajo se fue. El lab no scrollea, así que sin esto no hay sección.
  useEffect(() => {
    tabRef.current = tab;
    telemetry.seccion(`lab:${tab}`);
  }, [tab]);

  // ORBITAR = la señal de que están JUGANDO, no mirando. Es el único gesto
  // que prueba que la escena 3D respondió en su teléfono. Se detecta un
  // arrastre (>12 px con el dedo abajo) y se emite UNA sola vez por sesión:
  // no se guardan coordenadas ni trayectoria, sólo el hecho.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let x0 = 0, y0 = 0, abajo = false;
    const down = (e: PointerEvent) => { abajo = true; x0 = e.clientX; y0 = e.clientY; };
    const up = () => { abajo = false; };
    const move = (e: PointerEvent) => {
      if (!abajo || tocados.orbito) return;
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 12) return;
      tocados.orbito = true;
      telemetry.event('lab.orbita', { tab: tabRef.current });
    };
    el.addEventListener('pointerdown', down, { passive: true });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerup', up, { passive: true });
    el.addEventListener('pointercancel', up, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []);

  const element = elementByZ(selectedZ) ?? PERIODIC_TABLE[0];
  const previewZ = hoverZ ?? selectedZ;
  const previewElement = elementByZ(previewZ) ?? element;

  return (
    <div className="h-screen w-screen bg-[#05060A] text-[#E2E8F0] font-sans flex flex-col overflow-hidden">
      {/* Grid textura sutil de fondo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header — sticky, slim */}
      <header className="shrink-0 bg-[#05060A]/85 backdrop-blur-xl border-b border-[#1E293B] z-40">
        <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setDockOpen(o => !o)}
              className="w-7 h-7 rounded-md bg-[#0B0F17] border border-[#1E293B] hover:border-[#4FC3F7] flex items-center justify-center text-[#94A3B8] hover:text-white transition"
              title={dockOpen ? 'Ocultar tabla' : 'Mostrar tabla'}
              aria-label="Toggle dock"
            >
              {dockOpen ? '⊣' : '⊢'}
            </button>
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4FC3F7] to-[#7E57C2] flex items-center justify-center font-bold text-[#0B0F17] text-[14px]">
              Γ
            </div>
            <div>
              <div className="text-[13px] font-semibold tracking-tight leading-none">GAIA Lab</div>
              <div className="text-[9px] text-[#64748B] font-medium leading-none mt-0.5 uppercase tracking-wider">
                química desde la cuántica
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0B0F17] border border-[#1E293B]">
            {/* Progreso: explorar cada mesa de trabajo cuenta como lección de química. */}
            <TabButton active={tab === 'atom'} onClick={() => cambiarTab('atom')}>ψ Átomo</TabButton>
            <TabButton active={tab === 'molecule'} onClick={() => cambiarTab('molecule')}>⬡ Molécula</TabButton>
            <TabButton active={tab === 'bond'} onClick={() => cambiarTab('bond')}>⟮⟯ Enlace</TabButton>
            <TabButton active={tab === 'reaction'} onClick={() => cambiarTab('reaction')}>⇌ Reacción</TabButton>
            <TabButton active={tab === 'sandbox'} onClick={() => cambiarTab('sandbox')}>✧ Sandbox</TabButton>
          </nav>

          {/* Navegación secundaria SOLO en escritorio: en 390 px se llevaba un renglón
              entero del alto (que aquí es el recurso escaso) para links que nadie toca en la
              primera visita. El regreso a la escuela vive en el botón de arriba a la izquierda. */}
          <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] text-[#64748B] font-mono">
            <span className="hidden md:inline">{element.symbol} · Z={element.Z} · {configCompact(element.Z)}</span>
            <a href="/escuela.html" className="text-[#64748B] hover:text-[#FDB813] transition">← Γ Escuela</a>
            <a href="/math.html" className="text-[#64748B] hover:text-[#4FC3F7] transition">Σ Mate</a>
            <a href="/physics.html" className="text-[#64748B] hover:text-[#4FC3F7] transition">Φ Física</a>
            <a href="/" className="text-[#64748B] hover:text-[#4FC3F7] transition">La Forja</a>
          </div>
        </div>
      </header>

      {/* Main: dock + hero.
          MÓVIL = COLUMNA, Y EL ÁTOMO ARRIBA. Antes era `flex` (fila) siempre, con el dock en
          `w-[336px] shrink-0`: a 390 px de ancho —o sea TODO el tráfico que llega de Instagram—
          el dock se comía 336 y dejaba 54 px para el hero, así que el átomo salía REBANADO por
          el borde y el texto se partía en tiras. Medido en captura a 390×844 el 2026-07-31; en
          escritorio nunca se vio porque ahí sobra ancho. Es el mismo defecto que el reproductor
          de masterclass (440 px fijos).
          Y el orden importa: en móvil el átomo va PRIMERO (`order-first`) porque es lo que la
          persona vino a ver — llega de un reel de moléculas, no de un índice. */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* DOCK — siempre visible (colapsable). PeriodicTable + hover info + nav */}
        {dockOpen && (
          <aside className="shrink-0 w-full md:w-[336px] max-h-[30%] md:max-h-none order-last md:order-first
                            border-t md:border-t-0 md:border-r border-[#1E293B] bg-[#070A11]/60 backdrop-blur-md overflow-y-auto">
            <div className="p-3 space-y-3">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Tabla periódica
                  </div>
                  <div className="text-[9px] font-mono text-[#64748B]">
                    {selectedZ}/118
                  </div>
                </div>
                <PeriodicTable
                  selectedZ={selectedZ}
                  onSelect={handleSelect}
                  onHover={setHoverZ}
                  compact
                  showLegend={false}
                />
              </div>

              <HoverInfoCard
                element={previewElement}
                isPreview={previewZ !== selectedZ}
                hasAudio={!!ELEMENT_AUDIO[previewElement.Z]}
                audioPlaying={audioPlaying && previewZ === selectedZ}
                onToggleAudio={toggleAudio}
              />
              <NavButtons selectedZ={selectedZ} onSelect={handleSelectNav} />
              <ReferencePanel />
            </div>
          </aside>
        )}

        {/* HERO — el viewport llena lo que sobra. min-h-0 además de min-w-0: en columna
            (móvil) el que puede desbordar es el ALTO, no el ancho. */}
        <main ref={heroRef} className="flex-1 min-w-0 min-h-0 relative overflow-hidden">
          {tab === 'atom'     && <AtomHero element={element} />}
          {tab === 'molecule' && <MoleculeHero />}
          {tab === 'bond'     && <BondTab />}
          {tab === 'reaction' && <ReactionTab />}
          {tab === 'sandbox'  && <SandboxTab />}

          {/* Subtítulos sincronizados con la narración del elemento */}
          {audioPlaying && caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(90%,720px)] px-2 pointer-events-none">
              <p className="text-center text-[15px] md:text-[17px] leading-snug font-medium text-white [text-shadow:_0_2px_8px_rgba(0,0,0,0.95),_0_0_2px_rgba(0,0,0,1)] bg-[#05060A]/55 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                {caption}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO: tab Átomo — viewport ocupa todo, overlays compactos
// ═══════════════════════════════════════════════════════════════

function AtomHero({ element }: { element: ReturnType<typeof elementByZ> extends infer E ? NonNullable<E> : never }) {
  const [showEdu, setShowEdu] = useState(true);
  // 'lab' = MultiElectronAtomView interactivo (paneles educativos) ·
  // 'cine' = la escena CINEMATIC viva (bloom + núcleo molten, contemplativa)
  // ABRE EN CINE. Es la vista que se ve como los reels (mismo postFX, mismo bloom), y es
  // de donde viene la persona. `ψ Lab` se queda a un toque porque enseña algo que la otra
  // no: los subshells por separado con su Zeff. Pero deja de ser lo PRIMERO.
  const [view, setView] = useState<'lab' | 'cine'>('cine');

  // ψ Lab ↔ ✦ Cinematic. Abre en `cine`; cada cambio se registra porque
  // responde a una pregunta de producto concreta: ¿la gente que llega del reel
  // se queda en la vista que se parece al reel, o busca la analítica?
  const cambiarVista = (a: 'lab' | 'cine') => {
    if (a !== view) telemetry.event('lab.vista', { de: view, a, Z: element.Z });
    setView(a);
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Viewport 3D ocupa todo el espacio disponible */}
      <div className="flex-1 min-h-0 relative">
        {view === 'cine'
          ? <CinematicAtom Z={element.Z} live />
          : <MultiElectronAtomView element={element} height="100%" nPoints={15000} chrome={false} />}

        {/* Toggle ψ Lab ↔ Cinematic */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex rounded-md border border-[#1E293B] bg-[#05060A]/70 backdrop-blur overflow-hidden text-[10px] uppercase tracking-wider">
          <button onClick={() => cambiarVista('lab')} className={`px-3 py-1.5 transition ${view === 'lab' ? 'bg-[#4FC3F7] text-[#05060A] font-semibold' : 'text-[#94A3B8] hover:text-white'}`}>ψ Lab</button>
          <button onClick={() => cambiarVista('cine')} className={`px-3 py-1.5 transition ${view === 'cine' ? 'bg-[#FDB813] text-[#05060A] font-semibold' : 'text-[#94A3B8] hover:text-white'}`}>✦ Cinematic</button>
        </div>

        {/* Overlay título de la molécula/átomo, arriba a la izquierda */}
        <div className="absolute top-3 left-3 rounded-lg border border-[#1E293B] bg-[#05060A]/70 backdrop-blur px-3 py-2 pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Átomo activo</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-[24px] font-bold text-white leading-none">{element.symbol}</span>
            <span className="text-[13px] text-[#CBD5E1]">{element.name}</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-[#7DD3FC]">{configCompact(element.Z)}</div>
        </div>

        {/* Botón mostrar/ocultar panel educacional */}
        <button
          onClick={() => setShowEdu(v => !v)}
          className="absolute top-3 right-3 rounded-md border border-[#1E293B] bg-[#05060A]/70 backdrop-blur px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#94A3B8] hover:text-white hover:border-[#4FC3F7] transition"
        >
          {showEdu ? 'Ocultar nota' : 'Mostrar nota'}
        </button>
      </div>

      {/* Panel educacional — overlay inferior, colapsable */}
      {showEdu && (
        <div className="shrink-0 border-t border-[#1E293B] bg-[#0B0F17]/80 backdrop-blur-md">
          <div className="px-4 py-2.5 max-w-[900px]">
            <EducationalNote element={element} />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO: tab Molécula — la escena CINEMATIC viva + galería de selección
// (mismas .bin que los videos 4K: moléculas, cadenas, catálogo, ADN)
// ═══════════════════════════════════════════════════════════════

function MoleculeHero() {
  const [molKey, setMolKey] = useState('h2o');
  const [galleryOpen, setGalleryOpen] = useState(true);
  const meta = molMeta(molKey);

  // Mismo criterio que `lab.elemento`: en la pestaña Molécula lo que se "toca"
  // son moléculas, y la pregunta —¿cuántas DISTINTAS?— es idéntica.
  const elegirMolecula = (k: string) => {
    tocados.moleculas.add(k);
    telemetry.event('lab.molecula', { key: k, formula: molMeta(k)?.formula, nOrdinal: tocados.moleculas.size });
    setMolKey(k);
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        {/* La escena cinematic viva (reusa el Canvas; re-fetchea la nube al cambiar molKey) */}
        <CinematicMolecule molKey={molKey} live />

        {/* Título de la molécula activa — arriba a la izquierda */}
        {meta && (
          <div className="absolute top-3 left-3 z-10 rounded-lg border border-[#1E293B] bg-[#05060A]/70 backdrop-blur px-3 py-2 pointer-events-none max-w-[280px]">
            <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Molécula activa</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[22px] font-bold text-white leading-none">{meta.formula}</span>
              <span className="text-[13px] text-[#CBD5E1]">{meta.name}</span>
            </div>
            <div className="mt-1 text-[10px] leading-snug text-[#94A3B8]">{meta.fact}</div>
          </div>
        )}

        {/* Toggle galería */}
        <button
          onClick={() => setGalleryOpen(v => !v)}
          className="absolute top-3 right-3 z-10 rounded-md border border-[#1E293B] bg-[#05060A]/70 backdrop-blur px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#94A3B8] hover:text-white hover:border-[#4FC3F7] transition"
        >
          {galleryOpen ? 'Ocultar galería' : '⬡ Galería'}
        </button>
      </div>

      {/* Galería — strip inferior scrollable, agrupado por sección */}
      {galleryOpen && (
        <div className="shrink-0 border-t border-[#1E293B] bg-[#0B0F17]/85 backdrop-blur-md max-h-[38%] overflow-y-auto">
          <div className="px-3 py-2.5 space-y-2.5">
            {MOLECULE_GALLERY.map(section => (
              <div key={section.label}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7DD3FC]">{section.label}</span>
                  <span className="text-[9px] text-[#64748B]">{section.hint}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {section.keys.map(k => {
                    const m = molMeta(k);
                    const active = k === molKey;
                    return (
                      <button
                        key={k}
                        onClick={() => elegirMolecula(k)}
                        title={m?.name}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono border transition ${
                          active
                            ? 'bg-[#FDB813] text-[#05060A] border-[#FDB813] font-semibold'
                            : 'bg-[#0B0F17] text-[#CBD5E1] border-[#1E293B] hover:border-[#4FC3F7] hover:text-white'
                        }`}
                      >
                        {m?.formula ?? k}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componentes del dock + overlay
// ═══════════════════════════════════════════════════════════════

function TabButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-[12px] font-semibold transition ${
        active
          ? 'bg-gradient-to-br from-[#1E40AF]/40 to-[#7E22CE]/40 text-white ring-1 ring-[#4FC3F7]/40'
          : 'text-[#94A3B8] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function HoverInfoCard({
  element, isPreview, hasAudio, audioPlaying, onToggleAudio,
}: {
  element: ReturnType<typeof elementByZ> extends infer E ? NonNullable<E> : never;
  isPreview: boolean;
  hasAudio?: boolean;
  audioPlaying?: boolean;
  onToggleAudio?: () => void;
}) {
  return (
    <div className={`rounded-xl border ${isPreview ? 'border-[#4FC3F7]/40' : 'border-[#1E293B]'} bg-[#0B0F17]/70 backdrop-blur-md p-3 transition`}>
      <div className="flex items-baseline justify-between">
        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
          {isPreview ? 'Hover' : 'Activo'}
        </div>
        <div className="text-[9px] font-mono text-[#64748B]">Z = {element.Z}</div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <div className="text-[28px] font-bold leading-none text-white">{element.symbol}</div>
        <div className="text-[12px] text-[#CBD5E1]">{element.name}</div>
        {hasAudio && !isPreview && (
          <button
            onClick={onToggleAudio}
            className={`ml-auto w-7 h-7 rounded-full border flex items-center justify-center transition text-sm ${
              audioPlaying
                ? 'border-[#FDB813] bg-[#FDB813]/20 text-[#FDB813] animate-pulse'
                : 'border-[#1E293B] bg-[#0B0F17] text-[#94A3B8] hover:border-[#4FC3F7] hover:text-white'
            }`}
            title={audioPlaying ? 'Pausar narración' : 'Escuchar narración'}
          >
            {audioPlaying ? '❚❚' : '▶'}
          </button>
        )}
      </div>
      <div className="mt-1 text-[10px] font-mono text-[#7DD3FC]">{configCompact(element.Z)}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
        <MiniProp label="m" value={`${element.mass.toFixed(3)} u`} />
        <MiniProp label="EN" value={element.electronegativity?.toFixed(2) ?? '—'} />
        <MiniProp label="IE₁" value={element.ionizationEnergy ? `${element.ionizationEnergy.toFixed(2)} eV` : '—'} />
        <MiniProp label="r cov" value={element.covalentRadius ? `${element.covalentRadius} pm` : '—'} />
      </div>
    </div>
  );
}

function MiniProp({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function EducationalNote({ element }: { element: typeof PERIODIC_TABLE[0] }) {
  const ion = element.ionizationEnergy;
  return (
    <div className="space-y-1 text-[11px] leading-snug text-[#CBD5E1]">
      <p>
        Núcleo con <strong className="text-white">{element.Z} protones</strong>; cada punto es una muestra ψ²
        (orbitales hidrogenoides + apantallamiento Slater).
        <strong className="text-[#4FC3F7]"> azul s</strong> ·
        <strong className="text-[#FF7043]"> naranja p</strong> ·
        <strong className="text-[#66BB6A]"> verde d</strong> ·
        <strong className="text-[#AB47BC]"> violeta f</strong>.
        {ion && (
          <> Arrancar un e⁻ cuesta <span className="font-mono text-[#7DD3FC]">{ion.toFixed(2)} eV</span>{' '}
          (λ = {(1240 / ion).toFixed(0)} nm).</>
        )}
      </p>
    </div>
  );
}

function NavButtons({
  selectedZ, onSelect,
}: {
  selectedZ: number;
  onSelect: (z: number) => void;
}) {
  const prev = selectedZ > 1 ? selectedZ - 1 : null;
  const next = selectedZ < 118 ? selectedZ + 1 : null;
  const prevEl = prev ? elementByZ(prev) : null;
  const nextEl = next ? elementByZ(next) : null;
  return (
    <div className="flex gap-1.5">
      <button
        disabled={!prev}
        onClick={() => prev && onSelect(prev)}
        className="flex-1 rounded-md border border-[#1E293B] bg-[#0B0F17] text-[#E2E8F0] px-2 py-1.5 text-[11px] disabled:opacity-30 hover:border-[#4FC3F7] transition text-left"
      >
        <div className="text-[8px] text-[#64748B] uppercase tracking-wider leading-none">Anterior</div>
        <div className="font-semibold leading-tight">{prevEl ? `← ${prevEl.symbol}` : '—'}</div>
      </button>
      <button
        disabled={!next}
        onClick={() => next && onSelect(next)}
        className="flex-1 rounded-md border border-[#1E293B] bg-[#0B0F17] text-[#E2E8F0] px-2 py-1.5 text-[11px] disabled:opacity-30 hover:border-[#4FC3F7] transition text-right"
      >
        <div className="text-[8px] text-[#64748B] uppercase tracking-wider leading-none">Siguiente</div>
        <div className="font-semibold leading-tight">{nextEl ? `${nextEl.symbol} →` : '—'}</div>
      </button>
    </div>
  );
}

function ReferencePanel() {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17]/50 backdrop-blur-md p-3">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        Fuentes
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[10px] leading-snug text-[#94A3B8]">
        <li>Griffiths, <em>Quantum Mech.</em> 3e (2018)</li>
        <li>Levine, <em>Quantum Chem.</em> 7e (2014)</li>
        <li>Slater, <em>Phys. Rev.</em> 36, 57 (1930)</li>
        <li>IUPAC <em>Atomic weights 2021</em></li>
        <li>NIST ASD v5.10</li>
        <li>Cordero, <em>Dalton Trans.</em> 2008</li>
      </ul>
    </div>
  );
}
