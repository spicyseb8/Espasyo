import { useEffect, useState } from "react";

//==================================================
// CONFIGURATION
//==================================================

type Variant = "straight" | "left" | "right";

// 4 images spaced evenly across the same 1s loop.
const MODELS: { url: string; delay: number; variant: Variant }[] = [
  { url: "/models/loader-files/furni1.png", delay: 0, variant: "straight" },
  { url: "/models/loader-files/furni2.png", delay: 0.25, variant: "left" },
  { url: "/models/loader-files/furni3.png", delay: 0.5, variant: "right" },
  { url: "/models/loader-files/furni4.png", delay: 0.75, variant: "straight" },
];

// Same keyframes as before (1 unit = 100px, y flipped because CSS y points down).
// Stops: 0% / 25% / 50% / 75% / 100%
const STOPS = [0, 25, 50, 75, 100];
const KEYFRAMES: Record<
  Variant,
  { x: number[]; y: number[]; s: number[]; r: number[] }
> = {
  straight: {
    x: [0, 0, 0, 0, 0],
    y: [0.9, 0.4, -0.2, -0.9, -1.5],
    s: [1, 0.92, 0.7, 0.35, 0],
    r: [0, 0, 0, 0, 0],
  },
  left: {
    x: [-0.9, -0.7, -0.4, -0.15, 0],
    y: [0.9, 0.4, -0.2, -0.9, -1.5],
    s: [1, 0.92, 0.7, 0.35, 0],
    r: [0, -8, -16, -24, -32],
  },
  right: {
    x: [0.9, 0.7, 0.4, 0.15, 0],
    y: [0.9, 0.4, -0.2, -0.9, -1.5],
    s: [1, 0.92, 0.7, 0.35, 0],
    r: [0, 8, 16, 24, 32],
  },
};

// Quick fade-in at the top, fade out as it vanishes at the bottom.
const OPACITY = [0, 1, 1, 0.9, 0];

/** Size of each image at its largest, in px. */
const TARGET_SIZE = 220;
const UNIT = 100; // px per keyframe unit

// Build the CSS @keyframes for each variant from the config above.
// Three.js rotation.z is counter-clockwise, CSS rotate() is clockwise,
// so the angle is negated to keep the same look.
const KEYFRAME_CSS = (Object.keys(KEYFRAMES) as Variant[])
  .map((variant) => {
    const k = KEYFRAMES[variant];
    const frames = STOPS.map((stop, i) => {
      const x = k.x[i] * UNIT;
      const y = -k.y[i] * UNIT;
      const s = Math.max(k.s[i], 0.0001);
      const r = -k.r[i];
      return `${stop}% { transform: translate(${x}px, ${y}px) rotate(${r}deg) scale(${s}); opacity: ${OPACITY[i]}; }`;
    }).join("\n");
    return `@keyframes loader-fall-${variant} {\n${frames}\n}`;
  })
  .join("\n");

//==================================================
// IMAGE PRELOADER
//==================================================

// Waits until every PNG is loaded so nothing pops in halfway through its fall.
function useImagesReady(urls: string[]) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // don't block the loader on a failed image
            img.src = url;
          })
      )
    ).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

//==================================================
// PROGRESS
//==================================================

interface LoadingScreenProps {
  /**
   * Real progress from 0 to 100. If you leave it out, a simulated
   * progress is shown: it climbs quickly, then slows down and waits
   * around 92% until this screen is unmounted.
   */
  progress?: number;
  label?: string;
}

function useSimulatedProgress(enabled: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setValue((v) => v + (92 - v) * 0.06);
    }, 100);
    return () => clearInterval(id);
  }, [enabled]);

  return value;
}

//==================================================
// ONE FALLING IMAGE
//==================================================

function FallingImage({
  url,
  delay,
  variant,
}: {
  url: string;
  delay: number;
  variant: Variant;
}) {
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="loader-fall-img pointer-events-none absolute select-none object-contain"
      style={{
        left: "50%",
        top: "50%",
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        marginLeft: -TARGET_SIZE / 2,
        marginTop: -TARGET_SIZE / 2,
        opacity: 0,
        // Negative delay = start already part-way through the loop (staggered).
        animation: `loader-fall-${variant} 1s linear ${-delay}s infinite`,
        willChange: "transform, opacity",
      }}
    />
  );
}

//==================================================
// LOADING LABEL
//==================================================

function LoadingLabel({ label }: { label: string }) {
  return (
    <p className="flex items-center text-lg font-bold tracking-tight text-neutral-700">
      <span>{label}</span>
      <span aria-hidden="true" className="ml-2 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block animate-pulse motion-reduce:animate-none"
            style={{ animationDelay: `${i * 200}ms`, animationDuration: "1.2s" }}
          >
            .
          </span>
        ))}
      </span>
    </p>
  );
}

//==================================================
// PROGRESS BAR (replaces the old sliding loading bar)
//==================================================

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value);

  return (
    <div className="flex w-56 flex-col gap-2">
      <div
        role="progressbar"
        aria-label="Loading project"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 w-full overflow-hidden rounded-full bg-black/10"
      >
        <div
          className="h-full rounded-full bg-black transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${value}%` }}
        />
      </div>

      <p
        aria-hidden="true"
        className="text-right text-sm font-semibold tabular-nums text-neutral-500"
      >
        {pct}%
      </p>
    </div>
  );
}

//==================================================
// LOADING SCREEN
//==================================================

export default function LoadingScreen({
  progress,
  label = "Loading Project",
}: LoadingScreenProps) {
  const ready = useImagesReady(MODELS.map((m) => m.url));
  const simulated = useSimulatedProgress(progress === undefined);
  const value = Math.min(100, Math.max(0, progress ?? simulated));

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white"
      aria-live="polite"
      aria-busy="true"
    >
      <style>{KEYFRAME_CSS}</style>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div
          className="relative h-[340px] w-[340px]"
          role="status"
          aria-label="Loading project"
        >
          {/* Purple glow sitting at the "drain" point at the bottom */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 h-24 w-48 -translate-x-1/2 rounded-full"
            style={{
              bottom: 40,
              background:
                "radial-gradient(closest-side, rgba(92,61,153,0.45), rgba(92,61,153,0))",
              filter: "blur(8px)",
            }}
          />

          {ready &&
            MODELS.map((m) => <FallingImage key={m.url} {...m} />)}
        </div>

        <div className="flex flex-col items-center gap-4">
          <LoadingLabel label={label} />
          <ProgressBar value={value} />
        </div>
      </div>
    </main>
  );
}