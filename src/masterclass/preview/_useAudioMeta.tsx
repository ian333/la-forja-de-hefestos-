/**
 * useAudioMeta — lee meta.json generado por scene-pipeline.cjs.
 *
 * Cada vez que el pipeline genera audio, escribe meta.json al lado de los MP3s.
 * Las escenas usan este hook para leer la duración REAL sin hardcoded constants.
 *
 * Uso:
 *   const meta = useAudioMeta('/audio/preview/meta.json', 'preview-escena01-limones');
 *   // meta = { duration: 14.37, trackFile: '01-hook.mp3', ... } | null
 */

import { useEffect, useState } from 'react';

interface Track {
  file: string;
  duration_sec: number;
}

interface MetaJson {
  generated_at: string;
  script: string;
  script_id: string | null;
  total_duration_sec: number;
  model_id: string | null;
  voice_id: string | null;
  tracks: Track[];
}

export interface AudioMeta {
  /** Duración total en segundos. */
  duration: number;
  /** Path relativo al track principal (primer track). */
  trackFile: string;
  /** Object Track completo. */
  track: Track;
  /** Meta JSON completo. */
  raw: MetaJson;
}

/**
 * Lee meta.json desde una URL. Filtra los tracks por scriptId si está dado
 * (varios scripts pueden compartir un mismo out_dir — meta.json se sobrescribe
 * en cada generate, así que el último wins). Para mayor seguridad: passa
 * `expectedTrackFile` si conoces el nombre exacto del MP3 que necesitas.
 */
export function useAudioMeta(
  metaUrl: string,
  options: {
    expectedTrackFile?: string;
    fallbackDuration?: number;
  } = {},
): AudioMeta | null {
  const [meta, setMeta] = useState<AudioMeta | null>(() =>
    options.fallbackDuration
      ? {
          duration: options.fallbackDuration,
          trackFile: options.expectedTrackFile || '',
          track: { file: options.expectedTrackFile || '', duration_sec: options.fallbackDuration },
          raw: {} as MetaJson,
        }
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(metaUrl)
      .then(r => r.json())
      .then((json: MetaJson) => {
        if (cancelled) return;
        let track: Track | undefined;
        if (options.expectedTrackFile) {
          track = json.tracks.find(t => t.file === options.expectedTrackFile);
        }
        if (!track && json.tracks.length > 0) {
          track = json.tracks[0];
        }
        if (track) {
          setMeta({
            duration: track.duration_sec,
            trackFile: track.file,
            track,
            raw: json,
          });
        }
      })
      .catch(e => {
        if (!cancelled) console.warn('useAudioMeta: failed to load', metaUrl, e);
      });
    return () => { cancelled = true; };
  }, [metaUrl, options.expectedTrackFile]);

  return meta;
}
