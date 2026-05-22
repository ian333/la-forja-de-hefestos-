# Migración a render determinista — Guía

> **Objetivo:** desbloquear 4K @ 60fps fluido en `dist-video/<class>/video.mp4`
> migrando escenas R3F al pattern `useRenderClock()` + `?deterministic=1`.

---

## Resumen del problema

El pipeline real-time actual (`capture.cjs` + CDP screencast) graba la pantalla
mientras el browser renderiza. En WSL2 con WebGL software (swiftshader), el
browser apenas alcanza ~12fps reales en 4K. ffmpeg duplica frames para llegar a
60fps target, lo cual produce video "fluido pero stuttery".

Solución (probada en `marketing/gaia-reveal/`):

1. **Captura determinista**: por cada frame `i`, el script llama
   `window.renderAt(i / fps)` y luego `page.screenshot()`. No hay screencast.
2. **Escenas determinatas**: las animaciones derivan TODA su animación del
   tiempo `t` global (no de `clock.elapsedTime` ni `performance.now()`).
3. **Frame-perfect**: cada PNG es exacto, sin importar la velocidad del browser.

---

## Andamiaje listo (ya implementado)

| Archivo | Función |
|---------|---------|
| `src/masterclass/render-clock.ts` | Context + `useRenderClock()` + `useRenderClockController()` |
| `src/masterclass/Player.tsx` | Detecta `?deterministic=1`, expone `window.renderAt`, provee context |
| `scripts/video-gaia/capture-deterministic.cjs` | Captura frame-perfect llamando `window.renderAt` |

**Modo deterministic se activa con la URL:**
```
/masterclass.html?id=<classId>&render=1&deterministic=1
```

En modo normal (sin `deterministic=1`), TODO funciona como antes —
las escenas usan wall-clock y el Player avanza con audio. Migración es opt-in
por escena. **Una escena no migrada se ve con stuttering en modo determinista
pero NO rompe la captura**.

---

## Cómo migrar una escena

### Patrón A — escena con `useFrame(({ clock }))`

**Antes:**
```tsx
function CorePulse() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;          // ← wall-clock
    meshRef.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.08);
  });
  return <mesh ref={meshRef}>...</mesh>;
}
```

**Después:**
```tsx
import { useRenderClock } from '../render-clock';

function CorePulse() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { isDeterministic, tInScene } = useRenderClock();
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = isDeterministic ? tInScene : clock.elapsedTime;  // ← branch
    meshRef.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.08);
  });
  return <mesh ref={meshRef}>...</mesh>;
}
```

### Patrón B — escena con `useState` + `setInterval`/`setTimeout`

**Antes:**
```tsx
function MillikanDataScene() {
  const [visiblePoints, setVisiblePoints] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setVisiblePoints(n => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  return <>{POINTS.slice(0, visiblePoints).map(...)}</>;
}
```

**Después:**
```tsx
import { useRenderClock } from '../render-clock';

function MillikanDataScene() {
  const [visiblePoints, setVisiblePoints] = useState(0);
  const { isDeterministic, tInScene } = useRenderClock();

  if (isDeterministic) {
    // Determinista: deriva visiblePoints de tInScene
    const computed = Math.min(POINTS.length, Math.floor(tInScene / 0.1));
    return <>{POINTS.slice(0, computed).map(...)}</>;
  }

  // Real-time: comportamiento original con setInterval
  useEffect(() => {
    const id = setInterval(() => setVisiblePoints(n => n + 1), 100);
    return () => clearInterval(id);
  }, []);
  return <>{POINTS.slice(0, visiblePoints).map(...)}</>;
}
```

⚠️ **Cuidado con react-hooks/rules-of-hooks**: el hook `useEffect` se llama
condicionalmente arriba. Mejor wrap: siempre llamar el hook, pero hacer no-op
si `isDeterministic`:

```tsx
useEffect(() => {
  if (isDeterministic) return;     // ← no-op en render determinista
  const id = setInterval(() => setVisiblePoints(n => n + 1), 100);
  return () => clearInterval(id);
}, [isDeterministic]);
```

### Patrón C — escena con `performance.now()` directo

**Antes:**
```tsx
function ConformalScene() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - start) / 1000;
      setPhase(Math.floor(elapsed / 0.5));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  ...
}
```

**Después:**
```tsx
function ConformalScene() {
  const { isDeterministic, tInScene } = useRenderClock();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (isDeterministic) return;
    let raf: number;
    const start = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - start) / 1000;
      setPhase(Math.floor(elapsed / 0.5));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isDeterministic]);

  // En modo determinista, deriva phase directamente
  const effectivePhase = isDeterministic ? Math.floor(tInScene / 0.5) : phase;
  // ... usa effectivePhase ...
}
```

---

## Escenas que necesitan migración (prioridad alta)

Las que usan `performance.now()` directo (6 escenas):

```bash
$ grep -l "performance.now()" src/masterclass/scenes/*.tsx
src/masterclass/scenes/CascadeQuanticaScene.tsx
src/masterclass/scenes/ConformalScene.tsx
src/masterclass/scenes/LenardApparatusScene.tsx
src/masterclass/scenes/MillikanDataScene.tsx
src/masterclass/scenes/MatchingScene.tsx
src/masterclass/scenes/VickreyScene.tsx
```

Las otras 45 escenas que usan `useFrame(({ clock }))` también deberían
migrarse para coherencia 60fps perfecto, pero el stuttering es menos visible
(R3F clock al menos es monotónico).

---

## Workflow del equipo

1. Migra 1 escena siguiendo Patrón A/B/C arriba
2. Verifica en navegador: `npm run dev` → `/masterclass.html?id=X&render=1&deterministic=1`
   El Player auto-arranca. Abre DevTools: `window.renderAt(5)` debe avanzar al
   segundo 5 del video.
3. Cuando todas las escenas de una clase estén migradas:
   ```bash
   node scripts/video-gaia/capture-deterministic.cjs <classId>
   node scripts/video-gaia/encode.cjs <classId> --fps 60
   ```
4. Compara con el viejo: el nuevo debe verse 60fps real, sin stutter.

---

## Test rápido del andamiaje (sin migrar escenas)

```bash
# Build
npm run build && npm run preview &
sleep 3

# DevTools en el browser
open http://localhost:5001/masterclass.html?id=phys-einstein-pe&render=1&deterministic=1

# En la consola:
window.__renderClockReady    // → true
window.__renderStatus        // → { idx, started, ... }
window.renderAt(10)          // → avanza a t=10s del video
window.__renderStatus.idx    // → debe haber cambiado a la escena que cae en 10s
```

Si los 4 pasos funcionan, el andamiaje está OK. Las escenas no migradas
seguirán con wall-clock (las verás haciendo cosas raras, pero la captura
funcionará — solo no será perfecta hasta que cada escena se migre).

---

## Referencia: pipeline equivalente probado

`marketing/gaia-reveal/` usa exactamente este pattern (sin R3F, solo SVG):

```js
// render.js
for (let i = 0; i < totalFrames; i++) {
  const t = i / FPS;
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.screenshot({ path: ..., omitBackground: true });
}
```

Frame-perfect, reproducible, frame por frame.
