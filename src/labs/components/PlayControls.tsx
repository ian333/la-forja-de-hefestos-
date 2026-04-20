interface PlayControlsProps {
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  progress: number;    // 0..1
  elapsedLabel: string;
}

export default function PlayControls({
  playing,
  onPlay,
  onPause,
  onReset,
  progress,
  elapsedLabel,
}: PlayControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {playing ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0696D7] text-white font-semibold shadow-sm hover:bg-[#057ab1] transition"
          >
            <PauseIcon /> Pausa
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0696D7] text-white font-semibold shadow-sm hover:bg-[#057ab1] transition"
          >
            <PlayIcon /> Simular
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F9FAFB] transition"
        >
          <ResetIcon /> Reset
        </button>
        <div className="ml-auto font-mono text-[13px] text-[#6B7280]">
          {elapsedLabel}
        </div>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-[#F1F3F7] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-[#0696D7] transition-[width] duration-75"
          style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        />
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2v10l9-5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="3" y="2" width="3" height="10" />
      <rect x="8" y="2" width="3" height="10" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1.5 7a5.5 5.5 0 1 0 1.6-3.9" />
      <path d="M1.5 2v3.5H5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
