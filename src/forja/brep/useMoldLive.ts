/**
 * useMoldLive — la SESIÓN VIVA compartida operador↔cliente (paso 2.2 de la
 * extracción del monolito). El operador remoto (Claude) publica una pieza en
 * /mold-live.json; el Studio arma el molde con las primitivas del kernel y lo
 * pone en la escena 3D real → el cliente ve y GIRA el molde de verdad, en vivo.
 *
 * Interfaz angosta a propósito: el hook es dueño del poll (1.5 s), de la spec
 * viva y de los SÓLIDOS REALES (splitMold); el Studio solo consume la bolsa.
 * Los handles OCC van por REF (no viven en React state) + un contador que
 * dispara el re-build.
 */
import { useEffect, useRef, useState } from 'react';
import { packageToAssemblySpec } from '../mold/mold-plano-set';
import { moldMachine } from '../mold/moldmachine';
import type { MoldAssemblySpec } from '../mold/mold-assembly';

export type LiveDfm = {
  moldable: 'si' | 'con-mecanismos' | 'no';
  verdicts: Array<{ param: string; valor: string; limite: string; ok: boolean; ref: string }>;
} | null;

export function useMoldLive() {
  const liveMoldRev = useRef(-1);
  const [liveMoldSpec, setLiveMoldSpec] = useState<MoldAssemblySpec | null>(null);
  const [liveMoldMesh, setLiveMoldMesh] = useState<{ positions: Float32Array; indices: Uint32Array } | null>(null);
  // INSERTOS del SÓLIDO REAL (splitMold de la figura) — la cavidad ES la pieza, no un tubo.
  const liveRealSolidsRef = useRef<{ cav: any; core: any; piece?: any; zPartSplit: number } | null>(null);
  const [liveRealSolidsRev, setLiveRealSolidsRev] = useState(0);
  // VEREDICTO DE MOLDEABILIDAD medido sobre la malla (Kazmer §2.3, viaja en mold-live.json)
  const [liveDfm, setLiveDfm] = useState<LiveDfm>(null);
  const b64ToArr = (b64: string, T: any) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new T(u.buffer);
  };
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch('/mold-live.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (typeof j.rev !== 'number' || j.rev === liveMoldRev.current) return;
        liveMoldRev.current = j.rev;
        liveRealSolidsRef.current = null;                      // una sesión viva (Tupper) NO es la flanera paramétrica
        if (j.clear) { setLiveMoldSpec(null); setLiveMoldMesh(null); setLiveDfm(null); return; }
        setLiveDfm(j.dfmMesh ?? null);
        if (j.partMeshUrl) {
          // la MALLA REAL de la pieza (STL decimado) viaja aparte — se baja UNA vez por rev
          try {
            const mr = await fetch(j.partMeshUrl + '?t=' + j.rev, { cache: 'no-store' });
            const mj = await mr.json();
            setLiveMoldMesh({ positions: b64ToArr(mj.positions, Float32Array), indices: b64ToArr(mj.indices, Uint32Array) });
          } catch { setLiveMoldMesh(null); }
        } else setLiveMoldMesh(null);
        // generate:false = "comparte la pieza/DFM, NO armes el molde". Ignorar este
        // flag fue EL freeze de prod del 2026-07-24: una sesión Tupper huérfana
        // (rect → 63 pines) armaba el molde COMPLETO en el main thread en CADA
        // carga de página, con el kernel recién llegado. El JSON sobrevive a los
        // deploys (excluido a propósito) — el gate vive AQUÍ, no en el archivo.
        if (j.generate === false) { setLiveMoldSpec(null); return; }
        if (j.assemblySpec) { setLiveMoldSpec(j.assemblySpec); return; }   // ejemplo del libro directo
        if (j.spec) { try { setLiveMoldSpec(packageToAssemblySpec(moldMachine(j.spec))); } catch { setLiveMoldSpec(null); } }
      } catch { /* sin sesión viva */ }
    }, 1500);
    return () => clearInterval(id);
  }, []);
  return { liveMoldSpec, setLiveMoldSpec, liveMoldMesh, setLiveMoldMesh, liveDfm, liveRealSolidsRef, liveRealSolidsRev, setLiveRealSolidsRev };
}
