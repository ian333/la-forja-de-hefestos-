/**
 * Toggle niño ↔ investigador. Controla la densidad y tono del contenido.
 */

import { useAudience } from '@/physics/context';

export default function AudienceToggle() {
  const { audience, setAudience } = useAudience();
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0F17] border border-[#1E293B]">
      <Btn active={audience === 'child'}      onClick={() => setAudience('child')}>
        ◎ &nbsp;Niño
      </Btn>
      <Btn active={audience === 'researcher'} onClick={() => setAudience('researcher')}>
        ∑ &nbsp;Investigador
      </Btn>
    </div>
  );
}

function Btn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
