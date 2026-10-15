import { useEffect, useState, type ReactNode } from "react";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LibrarySyncStatus({ progress }: { progress: AssetSyncProgress }) {
  const settled = progress.completed;
  const percent = progress.totalBytes > 0
    ? Math.min(100, (progress.bytesDownloaded / progress.totalBytes) * 100)
    : progress.total > 0
      ? Math.min(100, (settled / progress.total) * 100)
      : 0;
  const title = progress.phase === "complete"
    ? "Library saved for offline reuse"
    : progress.phase === "error"
      ? "Library sync finished with unavailable assets"
      : "Downloading library assets";

  return (
    <details
      open={progress.phase === "downloading" || progress.phase === "starting"}
      className="fixed bottom-4 right-4 z-[10000] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg"
    >
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2 space-y-2">
        <progress
          className="h-2 w-full accent-neutral-900"
          max={100}
          value={percent}
          aria-label="Library asset download progress"
        />
        <p className="text-xs text-neutral-600">
          {settled} of {progress.total} files
          {progress.totalBytes > 0
            ? ` · ${formatBytes(progress.bytesDownloaded)} of ${formatBytes(progress.totalBytes)}`
            : ` · ${formatBytes(progress.bytesDownloaded)} downloaded`}
          {progress.activeDownloads > 0
            ? ` · ${progress.activeDownloads} active`
            : ""}
        </p>
        {progress.failed > 0 && (
          <p role="status" className="text-xs text-amber-800">
            {progress.failed} file{progress.failed === 1 ? "" : "s"} could not be cached.
            Missing Storage objects must be restored before they can load.
          </p>
        )}
        {progress.error && (
          <p role="status" className="text-xs text-amber-800">{progress.error}</p>
        )}
      </div>
    </details>
  );
}

function PreparationError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6">
      <section className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Unable to prepare your library</h1>
        <p className="text-sm text-neutral-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </section>
    </main>
  );
}

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
