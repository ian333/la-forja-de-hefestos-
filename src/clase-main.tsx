import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PREMIO_LABS } from './economia/labs/registry';
import { CineLayoutContext } from './masterclass/cine/useCineTime';
import './main.css';

/**
 * ClasePage — una masterclass SIEMPRE es pantalla completa.
 * Lee ?id=<premio>, monta la escena cine registrada en PREMIO_LABS a pantalla
 * completa (CineLayoutContext fill=true → CineStage llena el viewport).
 * Funciona en 16:9 (desktop) y 9:16 (vertical) — CineStage ajusta el fov.
 */
function ClasePage() {
  const id = new URLSearchParams(window.location.search).get('id') || '';
  const Comp = PREMIO_LABS[id];

  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { ho: html.style.overflow, bo: body.style.overflow, bg: body.style.background };
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; body.style.background = '#000';
    return () => { html.style.overflow = prev.ho; body.style.overflow = prev.bo; body.style.background = prev.bg; };
  }, []);

  if (!Comp) {
    return (
      <div className="fixed inset-0 bg-black text-[#E2E8F0] font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-[16px] font-bold mb-2">Clase no encontrada</div>
          <a href="/economia.html" className="text-[13px] font-mono text-[#34D399] hover:underline">← Economía Real</a>
        </div>
      </div>
    );
  }

  return (
    <CineLayoutContext.Provider value={{ fill: true }}>
      <div className="fixed inset-0 bg-black">
        <Suspense fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-black">
            <div className="w-10 h-10 rounded-full border-2 border-[#1E293B] border-t-[#FFE5A0] animate-spin" />
          </div>
        }>
          <Comp />
        </Suspense>
        <a href={`/premio.html?id=${id}`}
           className="fixed top-4 left-4 z-[60] text-[11px] font-mono text-[#FFE5A0]/70 hover:text-[#FFE5A0] bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-[#FFE5A0]/30 transition">
          ← salir
        </a>
      </div>
    </CineLayoutContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClasePage />
  </StrictMode>,
);
