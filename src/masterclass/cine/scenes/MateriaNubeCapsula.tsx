/**
 * MateriaNubeCapsula — CineStage de la serie MATERIA en 3D (?sys=<name>).
 * PostFX = los valores del O₂. Marca por sistema (SYS_INFO). Sin narración:
 * contemplativo 24 s como la serie de átomos (la voz llega en la versión larga).
 */
import { CineStage } from '@/masterclass/cine';
import MateriaNube, { T, SYS_INFO, sysParam } from './MateriaNube';

export default function MateriaNubeCapsula() {
  const sys = sysParam();
  const info = SYS_INFO[sys] ?? { name: sys, sub: 'ab initio' };
  return (
    <CineStage
      mood="studio"
      envIntensity={0.0}
      duration={T.fin}
      fov={44}
      cameraPos={[0, 2.4, 11.5]}
      background="#000"
      postfx={{ intensity: 1.15, threshold: 0.20, smoothing: 0.6, vignette: 0.68, aberration: 0 }}
      brand={{ name: info.name, sub: info.sub, at: 2.0 }}
    >
      <MateriaNube />
    </CineStage>
  );
}
