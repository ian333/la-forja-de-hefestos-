/**
 * Entry standalone para el cuásar. Routing via ?look=:
 *   /quasar.html              → EHT donut (default)
 *   /quasar.html?look=eht     → EHT donut close-up
 *   /quasar.html?look=m87     → M87-style jet con knots
 *   /quasar.html?look=hercules → Hercules A: galaxy + lobes
 *   /quasar.html?look=zoom    → cinematic zoom-out tour
 */

import ReactDOM from 'react-dom/client';
import './main.css';
import QuasarEHT from './quasar/QuasarEHT';
import QuasarM87 from './quasar/QuasarM87';
import QuasarHerculesA from './quasar/QuasarHerculesA';
import QuasarZoom from './quasar/QuasarZoom';
import QuasarKerr from './quasar/QuasarKerr';
import QuasarBZ from './quasar/QuasarBZ';
import QuasarSED from './quasar/QuasarSED';

type Look = 'eht' | 'm87' | 'hercules' | 'zoom' | 'kerr' | 'bz' | 'sed';
function readLook(): Look {
  if (typeof window === 'undefined') return 'eht';
  const p = new URLSearchParams(window.location.search).get('look');
  if (p === 'm87' || p === 'hercules' || p === 'zoom' || p === 'kerr' || p === 'bz' || p === 'sed') return p;
  return 'eht';
}

const look = readLook();
const Scene =
  look === 'm87' ? QuasarM87 :
  look === 'hercules' ? QuasarHerculesA :
  look === 'zoom' ? QuasarZoom :
  look === 'kerr' ? QuasarKerr :
  look === 'bz' ? QuasarBZ :
  look === 'sed' ? QuasarSED :
  QuasarEHT;

function Chrome() {
  const links: Array<{ k: Look; label: string }> = [
    { k: 'eht', label: 'EHT' },
    { k: 'm87', label: 'M87 Jet' },
    { k: 'hercules', label: 'Hercules A' },
    { k: 'zoom', label: 'Zoom-out' },
    { k: 'kerr', label: 'Kerr' },
    { k: 'bz', label: 'BZ precomp' },
    { k: 'sed', label: 'SED 𝔄' },
  ];
  return (
    <div className="absolute top-6 right-6 flex gap-3 text-[11px] font-mono">
      {links.map(l => (
        <a key={l.k}
           href={`/quasar.html?look=${l.k}`}
           className={`px-3 py-1 border rounded ${look === l.k
             ? 'border-[#FFE5A0] text-[#FFE5A0] bg-[#FFE5A0]/10'
             : 'border-[#475569] text-[#94A3B8] hover:border-[#94A3B8]'}`}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <Scene />
    <Chrome />
  </>,
);
