/**
 * LevelBadges — selector de nivel de complejidad.
 * Nivel 1: escuela básica / divulgación
 * Nivel 2: prepa / bachillerato
 * Nivel 3: universidad (fórmulas visibles)
 * Nivel 4: ingeniero industrial (reactores)
 * Nivel 5: atmósfera y ecosistema (multi-caja)
 */

export type LabLevel = 1 | 2 | 3 | 4 | 5;

interface LevelBadgesProps {
  value: LabLevel;
  onChange: (l: LabLevel) => void;
}

const LEVELS: Array<{
  level: LabLevel;
  name: string;
  icon: string;
  desc: string;
}> = [
  { level: 1, name: 'Explorar',    icon: '🎈', desc: 'Elige una reacción, juega con T' },
  { level: 2, name: 'Aprender',    icon: '📘', desc: 'Cambia concentraciones, ve datos' },
  { level: 3, name: 'Analizar',    icon: '🔬', desc: 'Fórmulas visibles, Arrhenius, k(T)' },
  { level: 4, name: 'Diseñar',     icon: '⚙️', desc: 'CSTR/PFR/Batch, runaway térmico' },
  { level: 5, name: 'Simular',     icon: '🌎', desc: 'Atmósfera, fotólisis, multi-caja' },
];

export default function LevelBadges({ value, onChange }: LevelBadgesProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F1F3F7] border border-[#E5E7EB]">
      {LEVELS.map((l) => {
        const active = l.level === value;
        return (
          <button
            key={l.level}
            onClick={() => onChange(l.level)}
            title={`${l.name}: ${l.desc}`}
            className={`relative px-2.5 py-1.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition ${
              active
                ? 'bg-white text-[#0696D7] shadow-sm'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <span className="text-[14px]">{l.icon}</span>
            <span className="hidden md:inline">{l.name}</span>
            <span className="md:hidden font-mono">{l.level}</span>
          </button>
        );
      })}
    </div>
  );
}
