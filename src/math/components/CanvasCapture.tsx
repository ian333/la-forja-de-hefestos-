/**
 * CanvasCapture — hijo R3F que expone un capturador del canvas al ReportContext.
 *
 * Va DENTRO de <Stage> (es hijo del arbol R3F), por eso puede usar useThree
 * para tomar gl/scene/camera. En un useEffect registra en el ReportContext una
 * funcion `capture()` que:
 *   1) fuerza un render SINCRONICO inmediato — gl.render(scene, camera) — para
 *      garantizar que el backbuffer tiene el frame actual (sin esto, aun con
 *      preserveDrawingBuffer:true, el toDataURL puede salir vacio por timing
 *      del composite del EffectComposer).
 *   2) devuelve gl.domElement.toDataURL('image/png').
 *
 * REQUISITO: el <Stage> padre debe ir con captureMode (preserveDrawingBuffer),
 * si no el PNG sale en blanco.
 *
 * No renderiza nada visible (devuelve null).
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useReport } from '@/math/report/ReportContext';

export default function CanvasCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const { registerCapture } = useReport();

  useEffect(() => {
    const capture = (): string | null => {
      try {
        // Render sincronico antes de leer el buffer.
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    };
    registerCapture(capture);
    return () => registerCapture(null);
  }, [gl, scene, camera, registerCapture]);

  return null;
}
