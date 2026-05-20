# Masterclass Asset Library — Guía de descargas

> **Fuente de verdad** para qué assets externos viven en `/public/models/library/`,
> de dónde vienen, y cómo se usan en las escenas.

---

## Estructura

```
src/masterclass/assets/
├── shapes/              ← Capa 2: extrusiones / lathes propios (sin descarga)
│   ├── _BaseShape.tsx   ← wrapper canónico (atom-style)
│   ├── Lemon.tsx · Apple.tsx · Cherry.tsx · Bill.tsx · Coin.tsx
│   └── index.ts
├── gltf/                ← Capa 3: wrappers para GLBs externos (CC0)
│   ├── AtomModel.tsx    ← carga GLB + aplica atom-style + auto-fit bbox
│   └── manifest.ts      ← catálogo tipado (paths, colors, source, category)
├── hdri/                ← Capa 4: environment maps (Poly Haven CC0)
│   ├── MasterclassEnv.tsx  ← <MasterclassEnv preset="studio" />
│   ├── manifest.ts      ← presets tipados por mood
│   └── index.ts
├── LibraryPage.tsx      ← /library.html (catálogo visual interactivo)
├── LemonCherryDemo.tsx  ← recipe de escena hero usando la library
└── MASTERCLASS_ASSETS.md (este archivo)

public/models/library/  ← 37 GLBs · 1.9 MB · todos CC0
├── food/        ← lemon, apple, cherry, banana                                    (4)
├── buildings/   ← factory, office, university, house, wall, tower, gate           (7)
├── docs/        ← briefcase, diploma, chest, cannon, barrel, bottle, flag         (7) +contract pending
├── vehicles/    ← sedan, ambulance, police, delivery (Tsuru hand-made aparte)    (4)
├── people/      ← astronaut                                                       (1)
├── physics/     ← spacecraft, rover, meteor, satellite                            (4)
├── math/        ← marble, funnel, helix                                           (3)
└── nature/      ← tree, log_stack, corn, mushroom, cactus, flower, bush           (7)

## Mapeo Nobel → assets (17 clases)

| Nobel | Assets clave |
|---|---|
| 01 Akerlof | Lemon, Cherry, sedan, Tsuru hand-made |
| 02 Coase | factory, office, delivery, contract* |
| 03 Spence | university, diploma, briefcase |
| 04 Hart-Holmström | contract*, chest (deal) |
| 05 Tirole | office, factory, dominance metaphor |
| 06 Nash | cannon (MAD), chest (payoff), marble |
| 07 Solow | tree, log_stack, corn, factory (capital) |
| 08 Kahneman | brain procedural, marble (anchoring) |
| 09 Acemoglu | wall, tower, gate, flag, police, two-houses |
| 10 Friedman | Bill (Capa 2), Coin, barrel (oil), corn |
| 11 Roth-Shapley | ambulance (hospital), chest (matching), Cherry pair |
| 12 Sen | corn, flower, rice (TODO), child figure (TODO) |
| 13 Markowitz-Sharpe | marble + funnel (Galton), Coin, pie chart procedural |
| 14 Thaler | marble + helix (nudge paths), funnel (choice) |
| 15 Ostrom | tree, mushroom, log_stack, cactus, fish (TODO), cow (TODO) |
| 16 Lucas | brain procedural, marble (decision), spacecraft |
| 17 Mirrlees-Vickrey | chest (auction), gavel (TODO), Bill, Coin |

*pending — buscar en Poly Pizza CC0.

public/hdri/  ← 5 MB · 3 environments CC0 Poly Haven
├── studio_small_03_1k.hdr        → studio neutro contemplativo
├── moonless_golf_1k.hdr          → noche urbana cálida (Akerlof)
└── rogland_clear_night_1k.hdr    → cielo estrellado (física)

public/hdri/
├── studio_small_03_1k.hdr        ← contemplativo neutro       [studio]
├── moonless_golf_1k.hdr          ← noche urbana cálida         [urban_night]
└── rogland_clear_night_1k.hdr    ← cielo estrellado            [starry_night]
```

---

## API unificada

```tsx
// Capa 2 — extrusión propia, cero descargas
import { Lemon, Apple, Cherry, Bill, Coin } from '@/masterclass/assets/shapes';

<Lemon scale={1.2} glow={1.5} color="#FDB813" mode="atom" />

// Capa 3 — GLB con tratamiento atom-style automático + auto-fit bbox
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { LIBRARY } from '@/masterclass/assets/gltf/manifest';

<AtomModel src={LIBRARY.lemon.src} color={LIBRARY.lemon.color} mode="atom" />

// Capa 4 — HDRI environment map (drei <Environment> tipado por mood)
import { MasterclassEnv } from '@/masterclass/assets/hdri';

<MasterclassEnv preset="starry_night" />     // física, cosmología
<MasterclassEnv preset="urban_night" />      // Akerlof, collapse
<MasterclassEnv preset="studio" />           // hero shots neutros
```

`mode` toggles entre `'solid' | 'wireframe' | 'edges' | 'atom'`. Default `'atom'`
matches el quality bar de Tsuru/Motor ([[feedback_visual_quality_bar]]).

`fitTo` en `AtomModel` normaliza la bbox máxima del modelo a N unidades
(default 2.0). Soluciona el problema de packs con escalas inconsistentes
(skyscrapers Kenney = 50 units vs. frutas = 0.5 units conviviendo en grid).

---

## Página de catálogo

Servida en **`/library.html`** (Vite). Muestra todos los shapes (Capa 2) y los
GLBs del manifest (Capa 3) en grid 3D con auto-orbit. Toggle de mode en HUD.

```bash
npm run dev
# abrir http://localhost:5001/library.html
```

GLBs no descargados aparecen como wireframe cube + "pending download" label.

---

## Lista de descargas pendientes

Estos son los packs CC0 que hay que bajar manualmente. Todo es **licencia CC0**
(sin atribución requerida, uso comercial OK).

### Quaternius — Ultimate packs (https://quaternius.com)

Todos los packs de Quaternius son **CC0**. La página de cada pack incluye un botón
"Download (GLB)" que da un ZIP con assets individuales.

| Pack | URL | Lo que necesitamos |
|------|-----|---------------------|
| **Ultimate Modular Items** | https://quaternius.com/packs/ultimatemodularitems.html | `lemon.glb`, `apple.glb`, `cherry.glb`, `banana.glb`, `briefcase.glb` |
| **Ultimate Cars Pack** | https://quaternius.com/packs/ultimatecars.html | `sedan.glb` (cualquier sedan genérico que case con paleta) |

### Kenney — Kits (https://kenney.nl/assets)

CC0 también. Cada kit viene como ZIP con FBX/GLTF. Usar **GLTF**.

| Kit | URL | Lo que necesitamos |
|-----|-----|---------------------|
| **City Kit (Commercial)** | https://kenney.nl/assets/city-kit-commercial | `office.glb`, `university.glb` |
| **City Kit (Suburban)** | https://kenney.nl/assets/city-kit-suburban | `house.glb` |
| **Industrial Kit** | https://kenney.nl/assets/industrial-kit | `factory.glb` |

### Poly Pizza — agregador CC0 (https://poly.pizza)

Para los últimos huecos que Quaternius/Kenney no cubren. Filtrar por **CC0** en
la búsqueda (NO por CC-BY, esos requieren atribución).

| Asset | Búsqueda sugerida | Filename target |
|-------|-------------------|-----------------|
| Diploma / título universitario | `diploma low poly` | `diploma.glb` |
| Contrato / documento firmado | `contract document` | `contract.glb` |

---

## Workflow de import (paso a paso)

1. **Bajar el pack** desde la URL de arriba.
2. **Extraer el ZIP** localmente.
3. **Buscar el asset específico** (ej. `Lemon.glb` adentro de `UltimateItemsPack/glb/`).
4. **Renombrar** al nombre canónico del manifest (ver `gltf/manifest.ts`).
   - `Lemon.glb` → `lemon.glb` (kebab-case)
5. **Copiar** a la subcarpeta correcta:
   ```bash
   cp ~/Downloads/UltimateItemsPack/glb/Lemon.glb \
      /home/ian/Orkesta/la-forja/public/models/library/food/lemon.glb
   ```
6. **Marcar `available: true`** en `gltf/manifest.ts` para ese entry.
7. **Verificar** en `/library.html` — debe aparecer renderizado en atom-style
   (no más placeholder wireframe cube).
8. **Commit** el GLB junto con el manifest update.

### Tamaño esperado
Cada GLB de Quaternius/Kenney pesa ~10-80 KB. Total proyectado para 12-15 assets:
**< 1 MB**. Trivial para repo.

---

## Reglas de uso en escenas

Aunque tengas 500 assets disponibles, [[feedback_scene_design_paradigm]] no
cambia. Reglas duras:

- **1 objeto principal** por encuadre (no still lifes).
- **Max 2 bloques de texto** en pantalla.
- **Fondo negro** + **bloom intenso** (PostFX ya configurado).
- **autoRotate cámara** suave > controles user.
- Las escenas **NO informan** — la narración informa. La escena **contempla**.

Benchmark interno: `BHGargantua` (52 LOC, 2 textos minúsculos).

---

## Reemplazar el Tsuru? — NO

El `TsuruWireframe` hand-made se mantiene como identidad mexicana de la clase
Akerlof (Limones). Los sedans de Quaternius sirven para variedad en wide shots
(e.g., `CarLot100` donde se muestran 100 carros) pero el carro hero nunca cambia.

---

## TODO al integrar nuevos assets

- [ ] Si un GLB tiene materiales PBR pesados (textures embebidas), considerar
      ejecutarlo por `gltf-pipeline -d` para draco-comprimir (`npm i -g gltf-pipeline`).
- [ ] Para escenas que usan múltiples assets del library: `AtomModel.preload(LIBRARY.X.src)`
      en boot/route-change para evitar popping.
- [ ] Documentar HDRI choice cuando se integre `<Environment>` de drei.
