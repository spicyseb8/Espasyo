import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useAuth } from "../context/AuthContext";
import {
  getDoorWindowAssets,
  getDoorWindowStorageSources,
} from "./build/FirebaseDoorWindowLibrary";
import {
  getDefaultFloorMaterial,
  getFloorStorageSources,
  getFloorMaterials,
  LOCAL_DEFAULT_FLOOR_TEXTURE,
  preloadFloorTexture,
} from "./materials/floors";
import { getWallMaterials, getWallStorageSources } from "./materials/walls";
import {
  getFurnitureAssets,
  getFurnitureStorageSources,
} from "./furniture/FirebaseFurnitureLibrary";
import {
  registerAssetCacheWorker,
  syncLibraryAssets,
  type AssetSyncProgress,
} from "../lib/assetLibraryCache";
import LoadingScreen from "../scene/LoadingScreen";

interface PreparationState {
  uid: string | null;
  ready: boolean;
  progress: number;
  error: string | null;
  sync: AssetSyncProgress | null;
}

const EMPTY_PREPARATION: PreparationState = {
  uid: null,
  ready: false,
  progress: 0,
  error: null,
  sync: null,
};

/* ------------------------------------------------------------------ */
/* Design tokens + animations (presentation only)                      */
/* ------------------------------------------------------------------ */

const AUTO_DISMISS_MS = 3000; // how long the success state stays visible
const EXIT_MS = 420; // must match the lss-exit animation duration below

const ANIMATION_CSS = `
  @keyframes lss-enter { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes lss-exit { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(28px) scale(.95); } }
  @keyframes lss-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  @keyframes lss-bob { 0%, 100% { transform: translateY(-1.5px); } 50% { transform: translateY(1.5px); } }
  @keyframes lss-ping { 0% { transform: scale(.9); opacity: .5; } 80%, 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes lss-draw { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
  @keyframes lss-pop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
  .lss-enter { animation: lss-enter .45s cubic-bezier(.16, 1, .3, 1) both; }
  .lss-exit { animation: lss-exit ${EXIT_MS}ms cubic-bezier(.4, 0, 1, 1) forwards; pointer-events: none; }
  .lss-shimmer { animation: lss-shimmer 1.6s linear infinite; }
  .lss-bob { animation: lss-bob 1.1s ease-in-out infinite; }
  .lss-ping { animation: lss-ping 1.8s ease-out infinite; }
  .lss-check { stroke-dasharray: 24; animation: lss-draw .45s .1s ease-out both; }
  .lss-pop { animation: lss-pop .4s ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .lss-enter, .lss-exit, .lss-shimmer, .lss-bob, .lss-ping, .lss-check, .lss-pop {
      animation-duration: .01ms;
      animation-iteration-count: 1;
    }
  }
`;

type Tone = "active" | "success" | "warning";

const TONE_STYLES: Record<Tone, { icon: string; bar: string; text: string }> = {
  active: {
    icon: "bg-neutral-900/5 text-neutral-900",
    bar: "from-neutral-900 to-neutral-600",
    text: "text-neutral-900",
  },
  success: {
    icon: "bg-emerald-500/10 text-emerald-600",
    bar: "from-emerald-500 to-emerald-400",
    text: "text-emerald-600",
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-600",
    bar: "from-amber-500 to-amber-400",
    text: "text-amber-600",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="lss-bob">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
      </g>
      <path d="M5 19h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="lss-check" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lss-pop h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-100 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Download progress panel                                             */
/* ------------------------------------------------------------------ */

function LibrarySyncStatus({ progress }: { progress: AssetSyncProgress }) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const exitTimer = useRef<number | undefined>(undefined);

  const settled = progress.completed;
  const isRunning = progress.phase === "starting" || progress.phase === "downloading";
  const isComplete = progress.phase === "complete";
  const hasIssues = progress.phase === "error" || progress.failed > 0 || Boolean(progress.error);
  const autoDismiss = isComplete && !hasIssues;
  const tone: Tone = hasIssues ? "warning" : isComplete ? "success" : "active";
  const styles = TONE_STYLES[tone];

  const rawPercent = progress.totalBytes > 0
    ? (progress.bytesDownloaded / progress.totalBytes) * 100
    : progress.total > 0
      ? (settled / progress.total) * 100
      : 0;
  const percent = isComplete && !hasIssues ? 100 : Math.min(100, Math.max(0, rawPercent));

  const dismiss = useCallback(() => {
    setLeaving(true);
    window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => setHidden(true), EXIT_MS);
  }, []);

  // A new sync run (e.g. retry) brings the card back.
  useEffect(() => {
    if (isRunning) {
      window.clearTimeout(exitTimer.current);
      setLeaving(false);
      setHidden(false);
    }
  }, [isRunning]);

  // Auto-dismiss after success. Hovering the card pauses the countdown.
  useEffect(() => {
    if (!autoDismiss || hovered) {
      return;
    }

    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [autoDismiss, hovered, dismiss]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  if (hidden) {
    return null;
  }

  const title = isRunning
    ? "Syncing your library"
    : hasIssues
      ? "Sync finished with issues"
      : "Library ready offline";

  const subtitle = progress.phase === "starting"
    ? "Preparing download…"
    : isRunning
      ? `${settled} of ${progress.total} files`
      : hasIssues
        ? `${progress.failed} file${progress.failed === 1 ? "" : "s"} unavailable`
        : `${progress.total} files saved`;

  return (
    <>
      <style>{ANIMATION_CSS}</style>

      <section
        role="status"
        aria-live="polite"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed bottom-4 right-4 z-[10000] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/90 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-md ${leaving ? "lss-exit" : "lss-enter"}`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {isRunning && (
                <span className="lss-ping absolute inset-0 rounded-xl bg-neutral-900/20" aria-hidden="true" />
              )}
              <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-500 ${styles.icon}`}>
                <span key={tone} className="flex">
                  {tone === "active" ? <DownloadIcon /> : tone === "success" ? <CheckIcon /> : <WarningIcon />}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-neutral-900">{title}</p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{subtitle}</p>
            </div>

            <span className={`text-lg font-bold tabular-nums transition-colors duration-500 ${styles.text}`}>
              {Math.round(percent)}%
            </span>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Collapse details" : "Expand details"}
                aria-expanded={expanded}
                className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-300 ${expanded ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {!isRunning && (
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss"
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="relative mt-3.5 h-2 overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-label="Library asset download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <div
              className={`relative h-full overflow-hidden rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out ${styles.bar}`}
              style={{ width: `${percent}%` }}
            >
              {isRunning && (
                <span className="lss-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Collapsible details */}
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="space-y-2.5 pt-3.5">
                <div className={`grid gap-2 ${isRunning ? "grid-cols-3" : "grid-cols-2"}`}>
                  <Stat label="Files" value={`${settled} / ${progress.total}`} />
                  <Stat
                    label="Size"
                    value={progress.totalBytes > 0
                      ? `${formatBytes(progress.bytesDownloaded)} / ${formatBytes(progress.totalBytes)}`
                      : formatBytes(progress.bytesDownloaded)}
                  />
                  {isRunning && <Stat label="Active" value={String(progress.activeDownloads)} />}
                </div>

                {progress.failed > 0 && (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    {progress.failed} file{progress.failed === 1 ? "" : "s"} could not be cached.
                    Missing Storage objects must be restored before they can load.
                  </p>
                )}
                {progress.error && (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    {progress.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Startup error screen                                                */
/* ------------------------------------------------------------------ */

function PreparationError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6">
      <style>{ANIMATION_CSS}</style>
      <section className="lss-enter max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <WarningIcon />
        </div>
        <h1 className="text-xl font-semibold">Unable to prepare your library</h1>
        <p className="text-sm text-neutral-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-md active:translate-y-0 active:scale-95"
        >
          Retry
        </button>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Startup gate (logic unchanged)                                      */
/* ------------------------------------------------------------------ */

export default function AssetStartupGate({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const [retryToken, setRetryToken] = useState(0);
  const [preparation, setPreparation] = useState(EMPTY_PREPARATION);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      setPreparation(EMPTY_PREPARATION);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const uid = user.uid;
    const cacheWorkerReady = registerAssetCacheWorker()
      .then(() => true)
      .catch((error: unknown) => {
        console.error("Unable to register the persistent asset cache worker:", error);
        return false;
      });

    setPreparation({
      uid,
      ready: false,
      progress: 5,
      error: null,
      sync: null,
    });

    void (async () => {
      try {
        setPreparation((current) => ({ ...current, progress: 20 }));
        const catalogs = await Promise.all([
          getFurnitureAssets(),
          getDoorWindowAssets(),
          getFloorMaterials(),
          getWallMaterials(),
        ]);

        if (cancelled) {
          return;
        }

        setPreparation((current) => ({ ...current, progress: 75 }));
        const defaultFloor = await getDefaultFloorMaterial();
        const texture = await preloadFloorTexture(
          defaultFloor?.texture ?? LOCAL_DEFAULT_FLOOR_TEXTURE,
        );

        if (!texture) {
          throw new Error("The bundled default floor texture could not be loaded.");
        }

        if (cancelled) {
          return;
        }

        setPreparation((current) => ({
          ...current,
          ready: true,
          progress: 100,
          sync: {
            phase: "starting",
            completed: 0,
            total: 0,
            failed: 0,
            bytesDownloaded: 0,
            totalBytes: 0,
            activeDownloads: 0,
          },
        }));

        void (async () => {
          try {
            if (!(await cacheWorkerReady)) {
              throw new Error("Persistent background caching is unavailable.");
            }
            if (cancelled) {
              return;
            }

            const storagePaths = [
              ...getFurnitureStorageSources(),
              ...getDoorWindowStorageSources(),
              ...getFloorStorageSources(),
              ...getWallStorageSources(),
            ];
            await syncLibraryAssets(
              [...catalogs, { storagePaths }],
              controller.signal,
              (sync) => {
                if (!cancelled) {
                  setPreparation((current) => ({ ...current, sync }));
                }
              },
            );
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error("Unable to synchronize the published asset library:", error);
              setPreparation((current) => ({
                ...current,
                sync: {
                  phase: "error",
                  completed: current.sync?.completed ?? 0,
                  total: current.sync?.total ?? 0,
                  failed: current.sync?.failed ?? 0,
                  bytesDownloaded: current.sync?.bytesDownloaded ?? 0,
                  totalBytes: current.sync?.totalBytes ?? 0,
                  activeDownloads: 0,
                  error: error instanceof Error
                    ? error.message
                    : "The persistent asset cache could not start.",
                },
              }));
            }
          }
        })();
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to prepare authenticated library data:", error);
          setPreparation((current) => ({
            ...current,
            error: "Check your connection and access permissions, then try again.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loading, user?.uid, retryToken]);

  if (loading) {
    return <LoadingScreen progress={8} label="Checking your session" />;
  }

  if (!user) {
    return children;
  }

  if (preparation.uid !== user.uid || !preparation.ready) {
    if (preparation.uid === user.uid && preparation.error) {
      return (
        <PreparationError
          message={preparation.error}
          onRetry={() => setRetryToken((value) => value + 1)}
        />
      );
    }

    return (
      <LoadingScreen
        progress={preparation.uid === user.uid ? preparation.progress : 5}
        label="Preparing your library"
      />
    );
  }

  return (
    <>
      {children}
      {preparation.sync && <LibrarySyncStatus progress={preparation.sync} />}
    </>
  );
}