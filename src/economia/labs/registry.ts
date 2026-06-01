/**
 * Registro de laboratorios interactivos por premio Nobel.
 *
 * Cada entrada mapea el `id` del catálogo a un componente lazy. El hub
 * `/premio.html?id=<id>` (PremioPage) lo monta en la sección "Juega". El
 * portal (EconomiaPortal) usa `hasLab` para marcar qué cards ya son jugables.
 *
 * Mantener esto en sync con `premio-content.ts`: un premio puede tener
 * contenido (paper, taquero) sin lab todavía, o lab sin contenido. El hub
 * renderiza con gracia lo que exista.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const PREMIO_LABS: Record<string, LazyExoticComponent<ComponentType<unknown>>> = {
  'econ-1969-frisch-tinbergen': lazy(() => import('./CaballitoFrisch')),
  'econ-1970-samuelson': lazy(() => import('./SamuelsonTazon')),
  'econ-1971-kuznets': lazy(() => import('./KuznetsPIB')),
  'econ-2005-aumann-schelling': lazy(() => import('./SchellingCiudad')),
  'econ-2008-krugman': lazy(() => import('@/masterclass/cine/scenes/KrugmanClase')),
  'econ-15-ostrom': lazy(() => import('@/masterclass/cine/scenes/OstromClase')),
  'econ-2018-romer-nordhaus': lazy(() => import('@/masterclass/cine/scenes/RomerClase')),
  'econ-1972-hicks-arrow': lazy(() => import('./HicksArrowLab')),
  'econ-1983-debreu': lazy(() => import('./DebreuLab')),
  'econ-1988-allais': lazy(() => import('./AllaisLab')),
  'econ-01-limones': lazy(() => import('./LimonesLab')),
  'econ-02-coase': lazy(() => import('./CoaseLab')),
  'econ-03-spence': lazy(() => import('./SpenceLab')),
  'econ-17-mirrlees-vickrey': lazy(() => import('./MirrleesVickreyLab')),
  'econ-05-tirole': lazy(() => import('./TiroleLab')),
  'econ-04-hart-holmstrom': lazy(() => import('./HartHolmstromLab')),
  'econ-06-nash': lazy(() => import('./NashLab')),
  'econ-2007-mechanism-design': lazy(() => import('./MechanismDesignLab')),
  'econ-11-roth-shapley': lazy(() => import('./RothShapleyLab')),
  'econ-2020-milgrom-wilson': lazy(() => import('./MilgromWilsonLab')),
  'econ-07-solow': lazy(() => import('./SolowLab')),
  'econ-16-lucas': lazy(() => import('./LucasLab')),
  'econ-2004-kydland-prescott': lazy(() => import('./KydlandPrescottLab')),
  'econ-2006-phelps': lazy(() => import('./PhelpsLab')),
  'econ-09-acemoglu': lazy(() => import('./AcemogluLab')),
  'econ-1981-tobin': lazy(() => import('./TobinLab')),
  'econ-1985-modigliani': lazy(() => import('./ModiglianiLab')),
  'econ-13-markowitz-sharpe': lazy(() => import('./MarkowitzSharpeLab')),
  'econ-1997-merton-scholes': lazy(() => import('./MertonScholesLab')),
  'econ-2013-fama-hansen-shiller': lazy(() => import('./FamaHansenShillerLab')),
  'econ-2022-bernanke-diamond-dybvig': lazy(() => import('./BernankeDiamondDybvigLab')),
  'econ-1974-myrdal-hayek': lazy(() => import('./MyrdalHayekLab')),
  'econ-10-friedman': lazy(() => import('./FriedmanLab')),
  'econ-1999-mundell': lazy(() => import('./MundellLab')),
  'econ-1979-schultz-lewis': lazy(() => import('./SchultzLewisLab')),
  'econ-12-sen': lazy(() => import('./SenLab')),
  'econ-2015-deaton': lazy(() => import('./DeatonLab')),
  'econ-2019-duflo-banerjee-kremer': lazy(() => import('./DufloBanerjeeKremerLab')),
  'econ-1992-becker': lazy(() => import('./BeckerLab')),
  'econ-2000-heckman-mcfadden': lazy(() => import('./HeckmanMcfaddenLab')),
  'econ-2010-diamond-mortensen-pissarides': lazy(() => import('./DiamondMortensenPissaridesLab')),
  'econ-2021-card-angrist-imbens': lazy(() => import('./CardAngristImbensLab')),
  'econ-2023-goldin': lazy(() => import('./GoldinLab')),
  'econ-1978-simon': lazy(() => import('./SimonLab')),
  'econ-08-kahneman': lazy(() => import('./KahnemanLab')),
  'econ-14-thaler': lazy(() => import('./ThalerLab')),
  'econ-1993-fogel-north': lazy(() => import('./FogelNorthLab')),
  'econ-1973-leontief': lazy(() => import('./LeontiefLab')),
  'econ-1975-kantorovich-koopmans': lazy(() => import('./KantorovichKoopmansLab')),
  'econ-1980-klein': lazy(() => import('./KleinLab')),
  'econ-1984-stone': lazy(() => import('./StoneLab')),
  'econ-1989-haavelmo': lazy(() => import('./HaavelmoLab')),
  'econ-2003-engle-granger': lazy(() => import('./EngleGrangerLab')),
  'econ-2011-sargent-sims': lazy(() => import('./SargentSimsLab')),
  'econ-1977-ohlin-meade': lazy(() => import('./OhlinMeadeLab')),
  'econ-1982-stigler': lazy(() => import('./StiglerLab')),
  'econ-1986-buchanan': lazy(() => import('./BuchananLab')),
};

export function hasLab(id: string): boolean {
  return id in PREMIO_LABS;
}

// Escenas cine (estándar `cine/`): se pueden ver a pantalla completa en /clase.html?id=.
export const CINE_CLASES = new Set<string>([
  'econ-2008-krugman',
  'econ-15-ostrom',
  'econ-2018-romer-nordhaus',
]);
export const esClaseCine = (id: string) => CINE_CLASES.has(id);
