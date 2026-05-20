/**
 * GLTF manifest — catálogo tipado de todos los modelos CC0 disponibles
 * en /public/models/library/. Centraliza paths, color defaults, scale,
 * y la categoría a la que pertenece cada uno.
 *
 * Cuando agregas un nuevo .glb:
 *   1. Lo metes en /public/models/library/{categoria}/{name}.glb
 *   2. Agregas su entry aquí
 *   3. (Opcional) AtomModel.preload(LIBRARY.lemon.src) en boot
 *
 * Si el archivo NO existe todavía (commit en proceso), `available: false`.
 * La página /library lo muestra como "pending" para que el usuario sepa
 * qué falta bajar.
 */

export type LibraryCategory =
  | 'food'        // econ Akerlof, intro
  | 'buildings'   // econ Coase, Spence, Acemoglu (walls), hipotecas
  | 'vehicles'    // econ Akerlof, Roth-Shapley (ambulance), institutions (police)
  | 'docs'        // econ Spence, Hart-Holmström, Vickrey (chest), props varios
  | 'people'      // observers, narrativa humana
  | 'physics'     // espacio, relatividad, mecánica
  | 'math'        // marble, funnel, helix — para Thaler/Markowitz/Galton
  | 'nature'      // Solow (capital arbolado), Ostrom (commons), Sen (cosecha)
  | 'lab';        // instrumentos científicos — reservado, hay que hand-craft

export interface LibraryEntry {
  /** Nombre canónico (kebab-case). Usado como id. */
  name: string;
  /** Ruta servida desde /public/. */
  src: string;
  /** Categoría — define subcarpeta y orden en el catálogo visual. */
  category: LibraryCategory;
  /** Color default para atom-style. */
  color: string;
  /** Escala default para que el modelo lea bien junto a otros. */
  defaultScale: number;
  /** Fuente CC0 / atribución. Para los TODO de README. */
  source: string;
  /** Si el archivo .glb está committed; false = pendiente de bajar. */
  available: boolean;
  /** Nobel/clase donde se usa principalmente. */
  primaryUse?: string;
}

export const LIBRARY: Record<string, LibraryEntry> = {
  // ─── FOOD ───────────────────────────────────────────────
  lemon: {
    name: 'lemon',
    src: '/models/library/food/lemon.glb',
    category: 'food',
    color: '#FDB813',
    defaultScale: 1.0,
    source: 'Kenney — Food Kit (CC0)',
    available: true,
    primaryUse: 'Akerlof · Limones',
  },
  apple: {
    name: 'apple',
    src: '/models/library/food/apple.glb',
    category: 'food',
    color: '#D7263D',
    defaultScale: 1.0,
    source: 'Kenney — Food Kit (CC0)',
    available: true,
    primaryUse: 'Genérico · introducción a teoría',
  },
  cherry: {
    name: 'cherry',
    src: '/models/library/food/cherry.glb',
    category: 'food',
    color: '#D7263D',
    defaultScale: 0.8,
    source: 'Kenney — Food Kit (CC0) [cherries.glb]',
    available: true,
    primaryUse: 'Akerlof · Limones (cherries = carros buenos)',
  },
  banana: {
    name: 'banana',
    src: '/models/library/food/banana.glb',
    category: 'food',
    color: '#FFE066',
    defaultScale: 1.0,
    source: 'Kenney — Food Kit (CC0)',
    available: true,
    primaryUse: 'Genérico',
  },

  // ─── BUILDINGS ──────────────────────────────────────────
  factory: {
    name: 'factory',
    src: '/models/library/buildings/factory.glb',
    category: 'buildings',
    color: '#B0B8C0',
    defaultScale: 1.0,
    source: 'Kenney — City Kit Commercial (CC0) [building-c]',
    available: true,
    primaryUse: 'Coase · firma vs mercado',
  },
  office: {
    name: 'office',
    src: '/models/library/buildings/office.glb',
    category: 'buildings',
    color: '#A8B5C8',
    defaultScale: 1.0,
    source: 'Kenney — City Kit Commercial (CC0) [skyscraper-a]',
    available: true,
    primaryUse: 'Coase · firma como contrato',
  },
  university: {
    name: 'university',
    src: '/models/library/buildings/university.glb',
    category: 'buildings',
    color: '#C8B498',
    defaultScale: 1.0,
    source: 'Kenney — City Kit Commercial (CC0) [skyscraper-c]',
    available: true,
    primaryUse: 'Spence · señalización por título',
  },
  house: {
    name: 'house',
    src: '/models/library/buildings/house.glb',
    category: 'buildings',
    color: '#E8B888',
    defaultScale: 1.0,
    source: 'Kenney — City Kit Suburban (CC0) [building-type-a]',
    available: true,
    primaryUse: 'Hipotecas · 2008',
  },

  // ─── DOCS ───────────────────────────────────────────────
  diploma: {
    name: 'diploma',
    src: '/models/library/docs/diploma.glb',
    category: 'docs',
    color: '#F5E6C8',
    defaultScale: 1.0,
    source: 'Kenney — Furniture Kit (CC0) [books.glb como stand-in]',
    available: true,
    primaryUse: 'Spence · job market signaling',
  },
  contract: {
    name: 'contract',
    src: '/models/library/docs/contract.glb',
    category: 'docs',
    color: '#E8E0D0',
    defaultScale: 1.0,
    source: 'TODO · Poly Pizza CC0',
    available: false,
    primaryUse: 'Hart-Holmström · contracts',
  },
  briefcase: {
    name: 'briefcase',
    src: '/models/library/docs/briefcase.glb',
    category: 'docs',
    color: '#3A4858',
    defaultScale: 1.0,
    source: 'Kenney — Furniture Kit (CC0) [laptop.glb como stand-in modern]',
    available: true,
    primaryUse: 'Mercados / negocios genérico',
  },

  // ─── VEHICLES ───────────────────────────────────────────
  // (Tsuru se mantiene hand-made — feedback usuario). Otros sedans para variedad.
  sedan: {
    name: 'sedan',
    src: '/models/library/vehicles/sedan.glb',
    category: 'vehicles',
    color: '#34D399',
    defaultScale: 1.0,
    source: 'Kenney — Car Kit (CC0) [hatchback-sports]',
    available: true,
    primaryUse: 'Akerlof · variedad junto al Tsuru en wide shots',
  },
  ambulance: {
    name: 'ambulance',
    src: '/models/library/vehicles/ambulance.glb',
    category: 'vehicles',
    color: '#F5F5F5',
    defaultScale: 1.0,
    source: 'Kenney — Car Kit (CC0)',
    available: true,
    primaryUse: 'Roth-Shapley · matching de órganos, hospital',
  },
  police: {
    name: 'police',
    src: '/models/library/vehicles/police.glb',
    category: 'vehicles',
    color: '#3A4858',
    defaultScale: 1.0,
    source: 'Kenney — Car Kit (CC0)',
    available: true,
    primaryUse: 'Acemoglu · institutions, enforcement',
  },
  delivery: {
    name: 'delivery',
    src: '/models/library/vehicles/delivery.glb',
    category: 'vehicles',
    color: '#FBBF24',
    defaultScale: 1.0,
    source: 'Kenney — Car Kit (CC0)',
    available: true,
    primaryUse: 'Coase · logística, transaction costs',
  },

  // ─── PHYSICS (Kenney Space Kit) ─────────────────────────
  spacecraft: {
    name: 'spacecraft',
    src: '/models/library/physics/spacecraft.glb',
    category: 'physics',
    color: '#7FB0FF',
    defaultScale: 1.0,
    source: 'Kenney — Space Kit (CC0) [craft_racer]',
    available: true,
    primaryUse: 'Einstein · observador en movimiento (Lorentz)',
  },
  rover: {
    name: 'rover',
    src: '/models/library/physics/rover.glb',
    category: 'physics',
    color: '#FFB870',
    defaultScale: 1.0,
    source: 'Kenney — Space Kit (CC0)',
    available: true,
    primaryUse: 'Mecánica · planeta inhóspito, fricción extraterrestre',
  },
  meteor: {
    name: 'meteor',
    src: '/models/library/physics/meteor.glb',
    category: 'physics',
    color: '#B8856A',
    defaultScale: 1.0,
    source: 'Kenney — Space Kit (CC0)',
    available: true,
    primaryUse: 'Newton · impacto, momento, energía cinética',
  },
  satellite: {
    name: 'satellite',
    src: '/models/library/physics/satellite.glb',
    category: 'physics',
    color: '#E8E8F5',
    defaultScale: 1.0,
    source: 'Kenney — Space Kit (CC0) [satelliteDish]',
    available: true,
    primaryUse: 'Cosmología · señales, ondas, CMB',
  },

  // ─── BUILDINGS extras (Castle Kit) ─────────────────────
  wall: {
    name: 'wall',
    src: '/models/library/buildings/wall.glb',
    category: 'buildings',
    color: '#A89B8C',
    defaultScale: 1.0,
    source: 'Kenney — Castle Kit (CC0)',
    available: true,
    primaryUse: 'Acemoglu · institutional barriers, Berlin Wall',
  },
  tower: {
    name: 'tower',
    src: '/models/library/buildings/tower.glb',
    category: 'buildings',
    color: '#C8B89B',
    defaultScale: 1.0,
    source: 'Kenney — Castle Kit (CC0) [tower-base]',
    available: true,
    primaryUse: 'Acemoglu · institutions, vigilancia',
  },
  gate: {
    name: 'gate',
    src: '/models/library/buildings/gate.glb',
    category: 'buildings',
    color: '#8B7355',
    defaultScale: 1.0,
    source: 'Kenney — Castle Kit (CC0)',
    available: true,
    primaryUse: 'Acemoglu · open vs closed economies',
  },

  // ─── DOCS extras (Pirate Kit) ──────────────────────────
  chest: {
    name: 'chest',
    src: '/models/library/docs/chest.glb',
    category: 'docs',
    color: '#C9962B',
    defaultScale: 1.0,
    source: 'Kenney — Pirate Kit (CC0)',
    available: true,
    primaryUse: 'Vickrey · auction treasure, Akerlof hidden value',
  },
  cannon: {
    name: 'cannon',
    src: '/models/library/docs/cannon.glb',
    category: 'docs',
    color: '#3A3A3A',
    defaultScale: 1.0,
    source: 'Kenney — Pirate Kit (CC0)',
    available: true,
    primaryUse: 'Nash · MAD doctrine, game theory military',
  },
  barrel: {
    name: 'barrel',
    src: '/models/library/docs/barrel.glb',
    category: 'docs',
    color: '#8B5A2B',
    defaultScale: 1.0,
    source: 'Kenney — Pirate Kit (CC0)',
    available: true,
    primaryUse: 'Friedman · commodities, oil barrel inflation',
  },
  bottle: {
    name: 'bottle',
    src: '/models/library/docs/bottle.glb',
    category: 'docs',
    color: '#5BA34A',
    defaultScale: 1.0,
    source: 'Kenney — Pirate Kit (CC0)',
    available: true,
    primaryUse: 'Coase · negative externalities (botella tirada)',
  },
  flag: {
    name: 'flag',
    src: '/models/library/docs/flag.glb',
    category: 'docs',
    color: '#D7263D',
    defaultScale: 1.0,
    source: 'Kenney — Castle Kit (CC0)',
    available: true,
    primaryUse: 'Acemoglu · identidad nacional, instituciones',
  },
  key: {
    name: 'key',
    src: '/models/library/docs/key.glb',
    category: 'docs',
    color: '#FFD86B',
    defaultScale: 1.0,
    source: 'Kenney — Platformer Kit (CC0)',
    available: true,
    primaryUse: 'Hart-Holmström · acceso/control, Acemoglu · inclusión',
  },
  sword: {
    name: 'sword',
    src: '/models/library/docs/sword.glb',
    category: 'docs',
    color: '#C0C8D0',
    defaultScale: 1.0,
    source: 'Kenney — Mini Arena (CC0)',
    available: true,
    primaryUse: 'Nash · MAD, Acemoglu · conquista',
  },
  axe: {
    name: 'axe',
    src: '/models/library/docs/axe.glb',
    category: 'docs',
    color: '#8B5A2B',
    defaultScale: 1.0,
    source: 'Kenney — Survival Kit (CC0)',
    available: true,
    primaryUse: 'Ostrom · herramienta de cosecha, sobrexplotación',
  },
  present: {
    name: 'present',
    src: '/models/library/docs/present.glb',
    category: 'docs',
    color: '#D7263D',
    defaultScale: 1.0,
    source: 'Kenney — Holiday Kit (CC0)',
    available: true,
    primaryUse: 'Sen · capacidades, Thaler · framing positivo',
  },

  // ─── NATURE (Nature Kit) — Solow growth, Ostrom commons, Sen capacidades ─
  tree: {
    name: 'tree',
    src: '/models/library/nature/tree.glb',
    category: 'nature',
    color: '#2D8659',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0) [tree_cone]',
    available: true,
    primaryUse: 'Solow · capital arbolado, Ostrom · commons forestal',
  },
  log_stack: {
    name: 'log_stack',
    src: '/models/library/nature/log_stack.glb',
    category: 'nature',
    color: '#8B5A2B',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0)',
    available: true,
    primaryUse: 'Solow · commodities, Ostrom · cosecha sustentable',
  },
  corn: {
    name: 'corn',
    src: '/models/library/nature/corn.glb',
    category: 'nature',
    color: '#FBBF24',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0) [crops_cornStageC]',
    available: true,
    primaryUse: 'Friedman · agricultural inflation, Sen · cosecha y hambruna',
  },
  mushroom: {
    name: 'mushroom',
    src: '/models/library/nature/mushroom.glb',
    category: 'nature',
    color: '#D7263D',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0) [mushroom_red]',
    available: true,
    primaryUse: 'Ostrom · commons forestal, recursos compartidos',
  },
  cactus: {
    name: 'cactus',
    src: '/models/library/nature/cactus.glb',
    category: 'nature',
    color: '#5BA34A',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0) [cactus_tall]',
    available: true,
    primaryUse: 'México specific, Ostrom · desert commons',
  },
  flower: {
    name: 'flower',
    src: '/models/library/nature/flower.glb',
    category: 'nature',
    color: '#D7263D',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0) [flower_redA]',
    available: true,
    primaryUse: 'Sen · capacidades, dignidad humana',
  },
  bush: {
    name: 'bush',
    src: '/models/library/nature/bush.glb',
    category: 'nature',
    color: '#3D8C5A',
    defaultScale: 1.0,
    source: 'Kenney — Nature Kit (CC0)',
    available: true,
    primaryUse: 'Filler nature, ecosistema',
  },
  campfire: {
    name: 'campfire',
    src: '/models/library/nature/campfire.glb',
    category: 'nature',
    color: '#FF6B35',
    defaultScale: 1.0,
    source: 'Kenney — Survival Kit (CC0)',
    available: true,
    primaryUse: 'Ostrom · vida en común, calor compartido',
  },
  tent: {
    name: 'tent',
    src: '/models/library/nature/tent.glb',
    category: 'nature',
    color: '#8B5A2B',
    defaultScale: 1.0,
    source: 'Kenney — Survival Kit (CC0)',
    available: true,
    primaryUse: 'Ostrom · refugio en commons, vida nómada',
  },
  wood: {
    name: 'wood',
    src: '/models/library/nature/wood.glb',
    category: 'nature',
    color: '#A0522D',
    defaultScale: 1.0,
    source: 'Kenney — Survival Kit (CC0)',
    available: true,
    primaryUse: 'Ostrom · recurso extraído, commons',
  },
  tree_decorated: {
    name: 'tree_decorated',
    src: '/models/library/nature/tree_decorated.glb',
    category: 'nature',
    color: '#2D8659',
    defaultScale: 1.0,
    source: 'Kenney — Holiday Kit (CC0)',
    available: true,
    primaryUse: 'Sen · prosperidad simbólica, Thaler · framing',
  },

  // ─── MATH extras (Platformer Kit coins + star) ──────────
  coin_gold: {
    name: 'coin_gold',
    src: '/models/library/math/coin_gold.glb',
    category: 'math',
    color: '#FFD86B',
    defaultScale: 1.0,
    source: 'Kenney — Platformer Kit (CC0)',
    available: true,
    primaryUse: 'Friedman · oro/devaluación, Markowitz · portfolio',
  },
  coin_silver: {
    name: 'coin_silver',
    src: '/models/library/math/coin_silver.glb',
    category: 'math',
    color: '#C0C8D0',
    defaultScale: 1.0,
    source: 'Kenney — Platformer Kit (CC0)',
    available: true,
    primaryUse: 'Markowitz · diversificación',
  },
  coin_bronze: {
    name: 'coin_bronze',
    src: '/models/library/math/coin_bronze.glb',
    category: 'math',
    color: '#CD7F32',
    defaultScale: 1.0,
    source: 'Kenney — Platformer Kit (CC0)',
    available: true,
    primaryUse: 'Markowitz · clase activo, Friedman',
  },
  star: {
    name: 'star',
    src: '/models/library/math/star.glb',
    category: 'math',
    color: '#FFD86B',
    defaultScale: 1.0,
    source: 'Kenney — Platformer Kit (CC0)',
    available: true,
    primaryUse: 'Reward signal, Thaler nudge, attractor',
  },

  // ─── MATH (Marble Kit) — Thaler nudge, Markowitz/Galton, probability ────
  marble: {
    name: 'marble',
    src: '/models/library/math/marble.glb',
    category: 'math',
    color: '#FDB813',
    defaultScale: 1.0,
    source: 'Kenney — Marble Kit (CC0) [marble-center-high]',
    available: true,
    primaryUse: 'Thaler · nudge choice path, Markowitz · Galton ball',
  },
  funnel: {
    name: 'funnel',
    src: '/models/library/math/funnel.glb',
    category: 'math',
    color: '#7FB0FF',
    defaultScale: 1.0,
    source: 'Kenney — Marble Kit (CC0)',
    available: true,
    primaryUse: 'Probability · distribución, Galton convergence',
  },
  helix: {
    name: 'helix',
    src: '/models/library/math/helix.glb',
    category: 'math',
    color: '#A78BFA',
    defaultScale: 1.0,
    source: 'Kenney — Marble Kit (CC0) [helix-half-left]',
    available: true,
    primaryUse: 'Math · helix, cycles, spiral motion',
  },

  // ─── PEOPLE ─────────────────────────────────────────────
  astronaut: {
    name: 'astronaut',
    src: '/models/library/people/astronaut.glb',
    category: 'people',
    color: '#E8E8F5',
    defaultScale: 1.0,
    source: 'Kenney — Space Kit (CC0) [astronautA]',
    available: true,
    primaryUse: 'Observer humano, perspectiva, escala',
  },
  soldier: {
    name: 'soldier',
    src: '/models/library/people/soldier.glb',
    category: 'people',
    color: '#3A4858',
    defaultScale: 1.0,
    source: 'Kenney — Mini Arena (CC0)',
    available: true,
    primaryUse: 'Acemoglu · enforcement, Nash · estrategia militar',
  },
  snowman: {
    name: 'snowman',
    src: '/models/library/people/snowman.glb',
    category: 'people',
    color: '#F5F5F5',
    defaultScale: 1.0,
    source: 'Kenney — Holiday Kit (CC0)',
    available: true,
    primaryUse: 'Sen · personaje genérico amable, narrativa cálida',
  },
};

export const LIBRARY_LIST: LibraryEntry[] = Object.values(LIBRARY);

export function entriesByCategory(category: LibraryCategory): LibraryEntry[] {
  return LIBRARY_LIST.filter(e => e.category === category);
}

export const CATEGORIES: LibraryCategory[] = ['food', 'buildings', 'docs', 'vehicles', 'people', 'physics', 'math', 'nature', 'lab'];
