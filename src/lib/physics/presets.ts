/**
 * Presets for the gravitational sandbox. Each returns a fresh SimState
 * ready to `computeAccelerations` + `recenterCOM` on.
 */

import { AU, YEAR, SUN, PLANETS, MOON, G } from './constants';
import {
  createBody, computeAccelerations, recenterCOM,
  type SimState, type Body,
} from './nbody';
import { periapsisState } from './kepler';

function finalize(bodies: Body[]): SimState {
  const s: SimState = { bodies, t: 0, softening: 0 };
  computeAccelerations(s);
  recenterCOM(s);
  computeAccelerations(s);
  return s;
}

/** Sun + Earth only. Cleanest for testing Kepler. */
export function presetSunEarth(): SimState {
  const earth = PLANETS.find(p => p.id === 'earth')!;
  const { r, v } = periapsisState(earth.a!, earth.e!, SUN.mass);
  return finalize([
    createBody({ id: 'sun',   name: 'Sol',    mass: SUN.mass,   radius: SUN.radius,   color: SUN.color,   pos: [0,0,0], vel: [0,0,0] }),
    createBody({ id: 'earth', name: 'Tierra', mass: earth.mass, radius: earth.radius, color: earth.color, pos: r, vel: v }),
  ]);
}

/** Sun + Earth + Moon. Shows three-body hierarchy. */
export function presetSunEarthMoon(): SimState {
  const earth = PLANETS.find(p => p.id === 'earth')!;
  const { r: rE, v: vE } = periapsisState(earth.a!, earth.e!, SUN.mass);
  // Moon: place at periapsis of geocentric orbit, velocity = Earth's + lunar orbital velocity.
  const { r: rMrel, v: vMrel } = periapsisState(MOON.a!, MOON.e!, earth.mass);
  const rM: [number, number, number] = [rE[0] + rMrel[0], rE[1] + rMrel[1], rE[2] + rMrel[2]];
  const vM: [number, number, number] = [vE[0] + vMrel[0], vE[1] + vMrel[1], vE[2] + vMrel[2]];
  return finalize([
    createBody({ id: 'sun',   name: 'Sol',    mass: SUN.mass,   radius: SUN.radius,   color: SUN.color,   pos: [0,0,0], vel: [0,0,0] }),
    createBody({ id: 'earth', name: 'Tierra', mass: earth.mass, radius: earth.radius, color: earth.color, pos: rE, vel: vE }),
    createBody({ id: 'moon',  name: 'Luna',   mass: MOON.mass,  radius: MOON.radius,  color: MOON.color,  pos: rM, vel: vM }),
  ]);
}

/** Full inner solar system: Mercury → Mars + Sun. */
export function presetInnerSolarSystem(): SimState {
  const inner = PLANETS.filter(p => ['mercury','venus','earth','mars'].includes(p.id));
  const bodies: Body[] = [
    createBody({ id: 'sun', name: 'Sol', mass: SUN.mass, radius: SUN.radius, color: SUN.color, pos: [0,0,0], vel: [0,0,0] }),
  ];
  for (const p of inner) {
    const { r, v } = periapsisState(p.a!, p.e!, SUN.mass);
    bodies.push(createBody({ id: p.id, name: p.name, mass: p.mass, radius: p.radius, color: p.color, pos: r, vel: v }));
  }
  return finalize(bodies);
}

/** All 8 planets + Sun. */
export function presetFullSolarSystem(): SimState {
  const bodies: Body[] = [
    createBody({ id: 'sun', name: 'Sol', mass: SUN.mass, radius: SUN.radius, color: SUN.color, pos: [0,0,0], vel: [0,0,0] }),
  ];
  for (const p of PLANETS) {
    const { r, v } = periapsisState(p.a!, p.e!, SUN.mass);
    bodies.push(createBody({ id: p.id, name: p.name, mass: p.mass, radius: p.radius, color: p.color, pos: r, vel: v }));
  }
  return finalize(bodies);
}

/** Binary star system — equal masses, circular orbit. */
export function presetBinaryStar(): SimState {
  const M = 1e30;                               // ~½ solar mass each
  const a = 0.5 * AU;                           // separation
  const r = a / 2;                              // each at ±r
  // Circular: v = √(G(M+M)/(2r)) / 2 … actually for 2-body equal mass:
  // v_each = ½ √(G·Mtot / a) where Mtot = 2M, separation = a
  const v = 0.5 * Math.sqrt(G * (2*M) / a);
  return finalize([
    createBody({ id: 'a', name: 'Estrella A', mass: M, radius: 5e8, color: '#FFD740', pos: [ r, 0, 0], vel: [0,  v, 0] }),
    createBody({ id: 'b', name: 'Estrella B', mass: M, radius: 5e8, color: '#FF8A65', pos: [-r, 0, 0], vel: [0, -v, 0] }),
  ]);
}

/** Classic figure-8 three-body orbit (Chenciner-Montgomery 2000). */
export function presetFigureEight(): SimState {
  // In natural units G=M=1. Scale up to SI so it's visible in the viewport.
  const Lscale = AU;
  const Mscale = 5e29;
  const Tscale = Math.sqrt(Lscale*Lscale*Lscale / (G * Mscale));
  const Vscale = Lscale / Tscale;
  const p1x =  0.97000436, p1y = -0.24308753;
  const p2x = -p1x,        p2y = -p1y;
  const v3x = -0.93240737, v3y = -0.86473146;
  const v1x = -v3x/2,      v1y = -v3y/2;
  return finalize([
    createBody({ id:'a', name:'A', mass: Mscale, radius: 3e9, color:'#4FC3F7', pos:[ p1x*Lscale, p1y*Lscale, 0], vel:[ v1x*Vscale, v1y*Vscale, 0] }),
    createBody({ id:'b', name:'B', mass: Mscale, radius: 3e9, color:'#E27B58', pos:[ p2x*Lscale, p2y*Lscale, 0], vel:[ v1x*Vscale, v1y*Vscale, 0] }),
    createBody({ id:'c', name:'C', mass: Mscale, radius: 3e9, color:'#66BB6A', pos:[ 0, 0, 0],                   vel:[ v3x*Vscale, v3y*Vscale, 0] }),
  ]);
}

export const PRESETS = [
  { id: 'sun-earth',    name: 'Sol + Tierra',            factory: presetSunEarth,         dtDefault: 3600,        yearsDefault: 2  },
  { id: 'sun-earth-moon',name:'Sol + Tierra + Luna',     factory: presetSunEarthMoon,     dtDefault: 1800,        yearsDefault: 1  },
  { id: 'inner',        name: 'Sistema solar interior',  factory: presetInnerSolarSystem, dtDefault: 3600*6,      yearsDefault: 2  },
  { id: 'full',         name: 'Sistema solar completo',  factory: presetFullSolarSystem,  dtDefault: 3600*24,     yearsDefault: 30 },
  { id: 'binary',       name: 'Binaria estelar',         factory: presetBinaryStar,       dtDefault: 3600,        yearsDefault: 1  },
  { id: 'figure-8',     name: 'Órbita en ocho (3 cuerpos)',factory: presetFigureEight,    dtDefault: 60,          yearsDefault: 0.2},
] as const;

export type PresetId = typeof PRESETS[number]['id'];
