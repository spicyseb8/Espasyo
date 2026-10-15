import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { getFloorAssets } from "@/services/assets/floors";
import { getFurnitureAssets } from "@/services/assets/furniture";
import { getWallAssets } from "@/services/assets/walls";
import {
  registerAssetCacheWorker,
  syncLibraryAssets,
  type AssetSyncProgress,
} from "@/lib/assetLibraryCache";
import LoadingScreen from "@/components/LoadingScreen";

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
  const percent = progress.totalBytes > 0
    ? Math.min(100, (progress.bytesDownloaded / progress.totalBytes) * 100)
    : progress.total > 0
      ? Math.min(100, (progress.completed / progress.total) * 100)
      : 0;
  const title = progress.phase === "complete"
    ? "Library saved for offline reuse"
    : progress.phase === "error"
      ? "Library sync finished with unavailable assets"
      : "Downloading library assets";

  return (
    <details
      open={progress.phase === "downloading" || progress.phase === "starting"}
      className="fixed bottom-4 right-4 z-[10000] w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-background p-3 text-sm shadow-lg"
    >
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2 space-y-2">
        <progress
          className="h-2 w-full accent-primary"
          max={100}
          value={percent}
          aria-label="Library asset download progress"
        />
        <p className="text-xs text-muted-foreground">
          {progress.completed} of {progress.total} files
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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Unable to prepare the asset library</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </section>
    </main>
  );
}

function getPublishedAssets(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((asset) => {
    if (typeof asset !== "object" || asset === null) {
      return false;
    }

    const status = (asset as Record<string, unknown>).asset_status;
    return typeof status === "string" && status.trim().toLowerCase() === "available";
  });
}

export default function AssetStartupGate({
  children,
}: {
  children: ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [retryToken, setRetryToken] = useState(0);
  const [preparation, setPreparation] = useState(EMPTY_PREPARATION);
  const isLoginPage = location.pathname === "/login";

  useEffect(() => {
    if (loading || !user || !role || isLoginPage) {
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
      progress: 10,
      error: null,
      sync: null,
    });

    void (async () => {
      try {
        setPreparation((current) => ({ ...current, progress: 35 }));
        const catalogs = await Promise.all([
          getFurnitureAssets(),
          getFloorAssets(),
          getWallAssets(),
        ]);

        if (cancelled) {
          return;
        }

        const publishedCatalogs = catalogs.map(getPublishedAssets);
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

            await syncLibraryAssets(publishedCatalogs, controller.signal, (sync) => {
              if (!cancelled) {
                setPreparation((current) => ({ ...current, sync }));
              }
            });
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
          console.error("Unable to prepare authenticated asset metadata:", error);
          setPreparation((current) => ({
            ...current,
            error: "Check your connection and admin permissions, then try again.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isLoginPage, loading, role, retryToken, user?.uid]);

  if (loading || !user || !role || isLoginPage) {
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
