
import { useEffect, useState, type ReactNode } from "react";
import {
    BrowserRouter,
    Navigate,
    Routes,
    Route,
    useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { getLegalAcceptance } from "./services/legalAcceptance";
import LoadingScreen from "./scene/LoadingScreen";
import Home
    from "./pages/Home";

import Studio
    from "./pages/Studio";

import StudioEditor
    from "./pages/StudioEditor";

import LibraryPage
    from "./pages/Library";

import AuthPage
    from "./pages/auth/AuthPage";

import StudioLoadProject
    from "./pages/StudioLoadProject";

import SettingsPage
    from "./pages/Settings";

import AssetStartupGate
    from "./engine/AssetStartupGate";

function ClientAccessRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const [retryToken, setRetryToken] = useState(0);
    const [status, setStatus] = useState<{
        uid: string;
        accepted: boolean;
        error: string | null;
        retryToken: number;
    } | null>(null);

    useEffect(() => {
        if (loading || !user) return;

        let cancelled = false;
        const requestRetryToken = retryToken;
        void getLegalAcceptance(user)
            .then(accepted => {
                if (!cancelled) {
                    setStatus({
                        uid: user.uid,
                        accepted,
                        error: null,
                        retryToken: requestRetryToken,
                    });
                }
            })
            .catch(error => {
                console.error("Unable to verify access agreement:", error);
                if (!cancelled) {
                    setStatus({
                        uid: user.uid,
                        accepted: false,
                        error: error instanceof Error
                            ? error.message
                            : "Unable to verify your agreement. Please retry.",
                        retryToken: requestRetryToken,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user, loading, retryToken]);

    if (loading) {
        return <LoadingScreen label="Checking your session" />;
    }

    if (!user) {
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    if (status?.uid !== user.uid || status.retryToken !== retryToken) {
        return <LoadingScreen label="Verifying your agreement" />;
    }

    if (status.error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
                <p role="alert" className="max-w-md text-sm text-destructive">
                    {status.error} Protected areas remain unavailable until verification succeeds.
                </p>
                <button
                    type="button"
                    className="rounded-md border px-4 py-2 text-sm"
                    onClick={() => setRetryToken(value => value + 1)}
                >
                    Retry verification
                </button>
            </main>
        );
    }

    if (!status.accepted) {
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    return children;
}

function App() {

    return (

        <BrowserRouter>

            <AssetStartupGate>
                <Routes>

                {/* HOME */}

                <Route
                    path="/"
                    element={
                        <Home />
                    }
                />

                <Route
                    path="/home"
                    element={
                        <Home />
                    }
                />

                {/* AUTH */}

                <Route
                    path="/auth"
                    element={
                        <AuthPage />
                    }
                />

                {/* LIBRARY */}

                <Route
                    path="/library"
                    element={
                        <ClientAccessRoute>
                            <LibraryPage />
                        </ClientAccessRoute>
                    }
                />

                {/* ACCOUNT SETTINGS */}

                <Route
                    path="/settings"
                    element={
                        <ClientAccessRoute>
                            <SettingsPage />
                        </ClientAccessRoute>
                    }
                />

                {/* STUDIO / PROJECT MANAGEMENT */}

                <Route
                    path="/studio"
                    element={
                        <ClientAccessRoute>
                            <Studio />
                        </ClientAccessRoute>
                    }
                />

                {/* ACTUAL 3D EDITOR */}

                <Route
                    path="/studio/editor"
                    element={
                        <ClientAccessRoute>
                            <StudioEditor />
                        </ClientAccessRoute>
                    }
                />

                {/* LOAD SAVED PROJECT */}

                <Route
                    path="/studio/load/:projectId"
                    element={
                        <ClientAccessRoute>
                            <StudioLoadProject />
                        </ClientAccessRoute>
                    }
                />

                </Routes>
            </AssetStartupGate>

        </BrowserRouter>
    );
}

export default App;
