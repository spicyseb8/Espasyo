
import { useEffect, useState, type ReactNode } from "react";
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
import { reload } from "firebase/auth";
import { auth } from "./firebase/firebase";
import { getUserProfileByAuthUid } from "./firebase/user";
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
import StudioInspirationPreview
    from "./pages/StudioInspirationPreview";

import SettingsPage
    from "./pages/Settings";

import AssetStartupGate
    from "./engine/AssetStartupGate";

function ClientAccessRoute({ children }: { children: ReactNode }) {
    const { user, loading, agreement } = useAuth();
    const location = useLocation();
    const [clientAccess, setClientAccess] = useState<{
        uid: string;
        status: "valid" | "invalid";
        message?: string;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!user) {
            return;
        }

        const rejectClient = (message: string) => {
            if (!cancelled) {
                setClientAccess({ uid: user.uid, status: "invalid", message });
            }
        };

        const checkClient = async () => {
            try {
                await reload(user);
                if (cancelled || auth.currentUser?.uid !== user.uid) return;
                if (!user.emailVerified) {
                    rejectClient("Verify your email before signing in.");
                    return;
                }

                const profile = await getUserProfileByAuthUid(user.uid);
                if (cancelled || auth.currentUser?.uid !== user.uid) return;
                const profileIsActive = profile?.isActive === true ||
                    (profile?.isActive === undefined && profile?.account_status === "active");
                if (!profile || !profileIsActive) {
                    rejectClient("We could not find an active client profile linked to this login.");
                    return;
                }

                setClientAccess({ uid: user.uid, status: "valid" });
            } catch (error) {
                console.error("Unable to verify client access:", error);
                rejectClient("We could not verify your client account. Please sign in again.");
            }
        };

        void checkClient();
        return () => {
            cancelled = true;
        };
    }, [user]);

    if (loading) {
        return <LoadingScreen label="Checking your session" />;
    }

    if (!user) {
        if (clientAccess?.status === "invalid") {
            return (
                <Navigate
                    to="/auth"
                    replace
                    state={{ from: location, accessError: clientAccess.message }}
                />
            );
        }
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    if (!clientAccess || clientAccess.uid !== user.uid) {
        return <LoadingScreen label="Verifying your client account" />;
    }

    if (clientAccess.status === "invalid") {
        return (
            <Navigate
                to="/auth"
                replace
                state={{ from: location, accessError: clientAccess.message }}
            />
        );
    }

    if (!agreement || agreement.uid !== user.uid || agreement.status === "checking") {
        return <LoadingScreen label="Verifying your agreement" />;
    }

    if (agreement.status === "error") {
        return (
            <Navigate
                to="/auth"
                replace
                state={{
                    from: location,
                    accessError: `${agreement.error} Please sign in again to retry.`,
                }}
            />
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

                {/* VIEW-ONLY PUBLIC DESIGN PREVIEW */}

                <Route
                    path="/studio/inspiration/:publicId"
                    element={
                        <ClientAccessRoute>
                            <StudioInspirationPreview />
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
