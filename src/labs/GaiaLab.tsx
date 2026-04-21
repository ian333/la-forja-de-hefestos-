/**
 * GaiaLab — Workspace unificado, construido desde la física cuántica.
 *
 * Flujo: tabla periódica (entry) → clic elemento → AtomView multi-electrón.
 * Opcional: segundas pestañas (Reacciones, Sandbox) para capas superiores,
 * pero el punto de entrada y la primitiva visual es el átomo real.
 *
 * Filosofía: construimos la química desde abajo — ψ(r,θ,φ), configuración
 * electrónica real, orbitales, valencia. Todo lo demás es consecuencia.
 */

import { useState } from 'react';
import { PERIODIC_TABLE, elementByZ, configCompact } from '@/lib/chem/quantum/periodic-table';
import PeriodicTable from './components/PeriodicTable';
import MultiElectronAtomView from './components/MultiElectronAtomView';
import BondTab from './components/BondTab';
import ReactionTab from './components/ReactionTab';
import SandboxTab from './components/SandboxTab';

type Tab = 'atom' | 'bond' | 'reaction' | 'sandbox';

export default function GaiaLab() {
  const [tab, setTab] = useState<Tab>('atom');
  const [selectedZ, setSelectedZ] = useState(6); // Carbono por defecto (más interesante que H)

  const element = elementByZ(selectedZ) ?? PERIODIC_TABLE[0];

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans">
      {/* Grid textura sutil de fondo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#05060A]/85 backdrop-blur-xl border-b border-[#1E293B]">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#4FC3F7] to-[#7E57C2] flex items-center justify-center font-bold text-[#0B0F17]">
              Γ
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight leading-none">
                GAIA Lab
              </div>
              <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1 uppercase tracking-wider">
                química desde la cuántica
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0F17] border border-[#1E293B]">
            <TabButton active={tab === 'atom'} onClick={() => setTab('atom')}>
              ψ &nbsp;Átomo
            </TabButton>
            <TabButton active={tab === 'bond'} onClick={() => setTab('bond')}>
              ⟮⟯ &nbsp;Enlace
            </TabButton>
            <TabButton active={tab === 'reaction'} onClick={() => setTab('reaction')}>
              ⇌ &nbsp;Reacción
            </TabButton>
            <TabButton active={tab === 'sandbox'} onClick={() => setTab('sandbox')}>
              ✧ &nbsp;Sandbox
            </TabButton>
          </nav>

          <div className="ml-auto flex items-center gap-3 text-[11px] text-[#64748B] font-mono">
            <span>corre local · 343 tests</span>
            <a href="/physics.html" className="text-[#64748B] hover:text-[#4FC3F7] transition">
              Φ Física →
            </a>
            <a href="/" className="text-[#64748B] hover:text-[#4FC3F7] transition">
              ← La Forja
            </a>
          </div>
        </div>
      </header>

      {tab === 'bond' ? (
        // El tab Enlace usa layout CAD-like: viewport full-screen + paneles flotantes.
        // No hay max-width ni padding aquí — el workspace ES el viewport.
        <main className="relative px-6 py-6">
          <BondTab />
        </main>
      ) : (
        <>
          <main className="max-w-[1600px] mx-auto px-6 py-6 relative">
            {tab === 'atom'     && <AtomTab selectedZ={selectedZ} onSelect={setSelectedZ} element={element} />}
            {tab === 'reaction' && <ReactionTab />}
            {tab === 'sandbox'  && <SandboxTab />}
          </main>

          <footer className="max-w-[1600px] mx-auto px-6 py-4 border-t border-[#1E293B] mt-6 text-[11px] text-[#475569] font-mono flex items-center justify-between flex-wrap gap-3">
            <div>GAIA Lab · motor stiff + MD + cuántico · 376 tests verdes</div>
            <div>Construido abajo-arriba desde |ψ|²</div>
          </footer>
        </>
      )}
    </div>
  );
}

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
      className={`px-4 py-1.5 rounded-md text-[13px] font-semibold transition ${
        active
          ? 'bg-gradient-to-br from-[#1E40AF]/40 to-[#7E22CE]/40 text-white ring-1 ring-[#4FC3F7]/40'
          : 'text-[#94A3B8] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ÁTOMO — layout lado-a-lado: átomo IZQ (estrella), tabla DER
// ═══════════════════════════════════════════════════════════════

function AtomTab({
  selectedZ, onSelect, element,
}: {
  selectedZ: number;
  onSelect: (z: number) => void;
  element: ReturnType<typeof elementByZ> extends infer E ? NonNullable<E> : never;
}) {
  // Hover previsualiza elemento sobre el panel de info sin cambiar la selección.
  const [hoverZ, setHoverZ] = useState<number | null>(null);
  const previewZ = hoverZ ?? selectedZ;
  const previewElement = elementByZ(previewZ) ?? element;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* ═══════════════════ IZQUIERDA: átomo grande (estrella) ═══════════════════ */}
      <section className="col-span-12 lg:col-span-7 space-y-4">
        <MultiElectronAtomView element={element} height={620} nPoints={15000} />
        <EducationalPanel element={element} />
      </section>

      {/* ═══════════════════ DERECHA: tabla + hover info + nav ═══════════════════ */}
      <aside className="col-span-12 lg:col-span-5 space-y-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 backdrop-blur-md p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Tabla periódica · clic para seleccionar
            </div>
          </div>
          <PeriodicTable
            selectedZ={selectedZ}
            onSelect={onSelect}
            onHover={setHoverZ}
            compact
            showLegend
          />
        </div>

        {/* Info del elemento bajo hover (o seleccionado si no hay hover) */}
        <HoverInfoCard element={previewElement} isPreview={previewZ !== selectedZ} />

        <NavButtons selectedZ={selectedZ} onSelect={onSelect} />
        <ReferencePanel />
      </aside>
    </div>
  );
}

function HoverInfoCard({
  element, isPreview,
}: {
  element: ReturnType<typeof elementByZ> extends infer E ? NonNullable<E> : never;
  isPreview: boolean;
}) {
  return (
    <div className={`rounded-xl border ${isPreview ? 'border-[#4FC3F7]/40' : 'border-[#1E293B]'} bg-[#0B0F17]/70 backdrop-blur-md p-4 transition`}>
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
          {isPreview ? 'Previsualización (hover)' : 'Elemento seleccionado'}
        </div>
        <div className="text-[10px] font-mono text-[#64748B]">
          Z = {element.Z}
        </div>
      </div>
      <div className="flex items-baseline gap-3 mt-2">
        <div className="text-[36px] font-bold leading-none text-white">
          {element.symbol}
        </div>
        <div className="text-[15px] text-[#CBD5E1]">{element.name}</div>
      </div>
      <div className="mt-2 text-[11px] font-mono text-[#7DD3FC]">
        {configCompact(element.Z)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
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

function EducationalPanel({ element }: { element: typeof PERIODIC_TABLE[0] }) {
  const ion = element.ionizationEnergy;
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 backdrop-blur-md p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        Qué ves en este átomo
      </div>
      <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-[#CBD5E1]">
        <p>
          El núcleo amarillo contiene <strong className="text-white">{element.Z} protones</strong>.
          Alrededor, cada punto de color es una muestra del lugar donde los
          electrones tienen probabilidad de estar (ψ²), sampleado con las
          funciones de onda exactas de Schrödinger y apantallamiento Slater.
        </p>
        <p>
          <strong className="text-[#4FC3F7]">Azul = s</strong> ·
          <strong className="text-[#FF7043]"> naranja = p</strong> ·
          <strong className="text-[#66BB6A]"> verde = d</strong> ·
          <strong className="text-[#AB47BC]"> violeta = f</strong>.
          Puedes ocultar subshells con los toggles abajo del viewport.
        </p>
        {ion && (
          <p className="pt-2 border-t border-[#1E293B]">
            <strong className="text-white">Arrancar un electrón</strong> de este átomo cuesta{' '}
            <span className="font-mono text-[#7DD3FC]">{ion.toFixed(2)} eV</span>.
            En Joules eso es {(ion * 1.602e-19).toExponential(2)} J — la energía
            de un fotón de longitud de onda λ = {(1240 / ion).toFixed(0)} nm.
          </p>
        )}
      </div>
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
    <div className="flex gap-2">
      <button
        disabled={!prev}
        onClick={() => prev && onSelect(prev)}
        className="flex-1 rounded-lg border border-[#1E293B] bg-[#0B0F17] text-[#E2E8F0] px-3 py-2 text-[12px] disabled:opacity-30 hover:border-[#4FC3F7] transition text-left"
      >
        <div className="text-[9px] text-[#64748B] uppercase tracking-wider">Anterior</div>
        <div className="font-semibold">{prevEl ? `← ${prevEl.symbol} ${prevEl.name}` : '—'}</div>
      </button>
      <button
        disabled={!next}
        onClick={() => next && onSelect(next)}
        className="flex-1 rounded-lg border border-[#1E293B] bg-[#0B0F17] text-[#E2E8F0] px-3 py-2 text-[12px] disabled:opacity-30 hover:border-[#4FC3F7] transition text-right"
      >
        <div className="text-[9px] text-[#64748B] uppercase tracking-wider">Siguiente</div>
        <div className="font-semibold">{nextEl ? `${nextEl.symbol} ${nextEl.name} →` : '—'}</div>
      </button>
    </div>
  );
}

function ReferencePanel() {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 backdrop-blur-md p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        Referencias
      </div>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
        <li>Griffiths, <em>Introduction to Quantum Mechanics</em>, 3ª ed. (2018)</li>
        <li>Levine, <em>Quantum Chemistry</em>, 7ª ed. (2014)</li>
        <li>Slater, <em>Phys. Rev.</em> 36, 57 (1930) — apantallamiento</li>
        <li>Clementi & Raimondi, <em>J. Chem. Phys.</em> 38, 2686 (1963)</li>
        <li>IUPAC <em>Atomic weights 2021</em></li>
        <li>NIST Atomic Spectra Database v5.10</li>
      </ul>
      <div className="mt-3 pt-3 border-t border-[#1E293B] text-[10px] text-[#64748B] italic">
        Este visualizador no resuelve Hartree-Fock ni DFT — usa orbitales
        hidrogenoides con Z efectiva de Slater. Suficiente para forma y
        tendencias; para energías espectroscópicas precisas se necesita
        una capa superior.
      </div>
    </div>
  );
}
