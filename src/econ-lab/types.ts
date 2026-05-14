// El EconLab reutiliza el contrato de módulo/branch de física, igual que MathLab.
// Mismos estados (live/stub/planned), misma forma; solo cambia el contenido.
export type {
  Audience,
  ModuleStatus,
  PhysicsModule as LabModule,
  PhysicsBranch as LabBranch,
} from '@/physics/types';
