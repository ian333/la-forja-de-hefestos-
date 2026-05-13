/**
 * Hash routing simple para los Labs (Math & Physics).
 *
 * Formato de URL:   /math.html#calc/tangent-plane
 *                   /physics.html#em/fields
 *
 * Lee el hash en mount + escucha `hashchange`. Cuando cambia, busca el
 * (branch, module) en `BRANCHES` y llama `setSelected`. Si nadie modifica
 * la URL, el hook no hace nada — la app sigue con su selección por estado.
 */

import { useEffect } from 'react';
import type { PhysicsBranch } from './types';

interface Selection { branchId: string; moduleId: string; }

export function useHashRoute(
  branches: PhysicsBranch[],
  setSelected: (s: Selection) => void,
) {
  useEffect(() => {
    const apply = () => {
      const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
      if (!raw) return;
      const [branchId, moduleId] = raw.split('/');
      if (!branchId || !moduleId) return;
      const br = branches.find(b => b.id === branchId);
      const mo = br?.modules.find(m => m.id === moduleId);
      if (!br || !mo) return;
      setSelected({ branchId, moduleId });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [branches, setSelected]);
}
