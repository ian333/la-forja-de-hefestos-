# El estándar de las masterclass GAIA

> Basado en los dos benchmarks: **Gargantua** (agujero negro) y **Limones** (Akerlof).
> Toda masterclass debe sentirse igual: **inmersiva, penetrante, aplastante**. Cero
> escenas artesanales de 500 líneas. Se arman con el motor `src/masterclass/cine/`.

## Qué hace inmersiva a una masterclass (las reglas)

De estudiar Gargantua y Limones, el ADN es:

1. **Pantalla completa, 3D real, fondo negro.** No 2D. R3F + ACES filmic tonemapping.
2. **Un HDRI por mood.** Cambia la "sensación" más que 5 luces. `urban_night` (noir/colapso), `studio` (hero contemplativo), `starry_night` (cosmos).
3. **PostFX siempre: bloom + viñeta + aberración.** Con shield anti-crash (nunca tira la escena). El glow hace que "respire" como cine.
4. **Cámara coreografiada, lenta.** Dolly/orbit suave. Nunca estática, nunca brusca. La cámara *contempla*.
5. **El objeto contempla, la narración informa.** Pocos objetos hero, grandes, emisivos. El texto no explica en pantalla — *nombra* momentos (reveal de un término, un veredicto).
6. **Texto 3D temporizado (`SkyText`), nunca drei `<Text>`** (rompe el EffectComposer).
7. **Narración (Matilda/ElevenLabs)** sincronizada al segundo. El visual se mueve con el audio. (Se enchufa por el pipeline iangpu; mientras, el texto en pantalla lleva el hilo.)
8. **Arco de actos:** gancho visceral → idea → el giro → la raíz animal/evolutiva → tu vida. La economía existe desde que somos animales.

## El motor: `src/masterclass/cine/`

| Pieza | Qué estandariza |
|---|---|
| `<CineStage>` | El shell: Canvas+ACES, HDRI, PostFX (con shield), reloj de escena (audio o clock) por contexto, HUD de cine (gradientes, capítulo, marca), botón ▶. |
| `<CineCamera keys={[...]}>` | Cámara por keyframes `{t, pos, look}`, interpolada suave (easeInOut). |
| `<CineText text at hold ...>` | Texto 3D (SkyText) con reveal temporizado (fade-in → hold → fade-out). |
| `<CineModel src at ...>` | Cualquier GLB de `/public/models/library/` con entrada coreografiada (scale-in + flote). 406 modelos: animals, buildings, food, coins, people… |
| `useCineTime()` | El reloj de la escena para primitivos custom. |

## Autorar una escena (ejemplo real: `cine/scenes/KrugmanClase.tsx`)

```tsx
import { CineStage, CineCamera, CineText, CineModel } from '@/masterclass/cine';

export default function MiClase() {
  return (
    <CineStage mood="urban_night" duration={44} chapter="Krugman · 2008"
               cameraPos={[0, 9, 38]} postfx={{ intensity: 1.5, vignette: 0.8 }}>
      <CineCamera keys={[
        { t: 0,  pos: [0, 9, 38], look: [0, 1.5, 0] },
        { t: 16, pos: [9, 6, 18], look: [0, 3, -3] },
        { t: 38, pos: [0, 16, 34], look: [0, 5, -3] },
      ]} />
      <CineModel src="/models/library/buildings/factory.glb" position={[0,0,0]} at={1} color="#FDB813" fitTo={4} />
      <CineText text="¿Por qué Silicon Valley está donde está?" position={[0,12,-8]} at={1.5} hold={4} />
      {/* …más modelos y textos en su segundo… */}
    </CineStage>
  );
}
```

## Cómo se monta

- **Por ahora:** se registra como "lab" del premio en `src/economia/labs/registry.ts`
  (`'econ-2008-krugman': lazy(() => import('@/masterclass/cine/scenes/KrugmanClase'))`),
  y aparece 🎮 jugable en su hub `/premio.html?id=`.
- **Multi-escena:** encadenar varias `CineStage` (cada una un acto) cuando esté el
  audio narrado, igual que `LimonesCinematicChain`. (Chain genérico = próximo paso.)
- **Audio:** grabar narración Matilda (ElevenLabs) y pasar `audio="/audio/..."` a
  `CineStage`; el reloj se sincroniza solo.

## Checklist antes de dar una masterclass por "lista"

- [ ] 3D real, fondo negro, ACES, PostFX activo.
- [ ] HDRI acorde al mood.
- [ ] Cámara coreografiada (mínimo 3 keyframes, movimiento lento).
- [ ] Arco con raíz animal/evolutiva (ver `docs/guiones-animal.md`).
- [ ] Texto que *nombra*, no que explica. Máx ~2 bloques a la vez.
- [ ] Cierre que conecta con la vida del que mira.
- [ ] Verificada en iangpu (render headless) antes de publicar.

Referencia viva: **`/premio.html?id=econ-2008-krugman`** (la primera clase armada con el estándar).
