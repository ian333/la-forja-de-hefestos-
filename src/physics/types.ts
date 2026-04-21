import type { ComponentType, LazyExoticComponent } from 'react';

export type Audience = 'child' | 'researcher';

export type ModuleStatus = 'live' | 'stub' | 'planned' | 'external';

export interface PhysicsModule {
  id: string;
  name: string;              // nombre del módulo (ej. "Sistema Solar")
  blurb: string;             // descripción de una línea
  childHint?: string;        // framing para niños
  researcherHint?: string;   // framing para investigadores
  status: ModuleStatus;
  component?: LazyExoticComponent<ComponentType<unknown>> | ComponentType<unknown>;
  externalUrl?: string;      // si status === 'external'
  roadmap?: string[];        // qué va aquí cuando se construya
}

export interface PhysicsBranch {
  id: string;
  name: string;              // ej. "Astrofísica"
  icon: string;              // glifo
  accent: string;            // color CSS
  blurb: string;
  modules: PhysicsModule[];
}
