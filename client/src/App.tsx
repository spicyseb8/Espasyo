
import { type ReactNode } from "react";
import {
    BrowserRouter,
    Navigate,
    Routes,
    Route,
    useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { ProtectedNavigationProvider } from "./context/ProtectedNavigationContext";
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
    const { user, loading, agreement, verifyAgreement } = useAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingScreen label="Checking your session" />;
    }

    if (!user) {
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    if (!agreement || agreement.uid !== user.uid || agreement.status === "checking") {
        return <LoadingScreen label="Verifying your agreement" />;
    }

    if (agreement.status === "error") {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
                <p role="alert" className="max-w-md text-sm text-destructive">
                    {agreement.error} Protected areas remain unavailable until verification succeeds.
                </p>
                <button
                    type="button"
                    className="rounded-md border px-4 py-2 text-sm"
                    onClick={() => {
                        void verifyAgreement(user, true).catch(error => {
                            console.error("Unable to verify access agreement:", error);
                        });
                    }}
                >
                    Retry verification
                </button>
            </main>
        );
    }

    if (agreement.status !== "accepted") {
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    return children;
}

function App() {

    return (

        <BrowserRouter>
            <ProtectedNavigationProvider>
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
            </ProtectedNavigationProvider>

        </BrowserRouter>
    );
}

export default App;
