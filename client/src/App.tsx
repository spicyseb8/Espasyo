
import type { ReactNode } from "react";
import {
    BrowserRouter,
    Link,
    Routes,
    Route
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
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

import AssetStartupGate
    from "./engine/AssetStartupGate";

function StudioAccess({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-black/60">
                Checking your sign-in…
            </div>
        );
    }

    if (user) {
        return children;
    }

    return (
        <div className="relative min-h-screen">
            <div
                aria-hidden="true"
                className="pointer-events-none select-none blur-sm"
                inert
            >
                {children}
            </div>

            <div className="fixed inset-0 z-50 grid place-items-center bg-[#faf7f2]/55 p-6 backdrop-blur-[2px]">
                <section
                    aria-labelledby="studio-login-title"
                    aria-modal="true"
                    className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-xl"
                    role="dialog"
                >
                    <h1
                        className="text-xl font-semibold text-[#1b1b1b]"
                        id="studio-login-title"
                    >
                        Sign in to access Studio
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-black/60">
                        Please log in first to view and manage your projects.
                    </p>
                    <Link
                        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#1b1b1b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
                        to="/auth"
                    >
                        Log in
                    </Link>
                </section>
            </div>
        </div>
    );
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
                        <LibraryPage />
                    }
                />

                {/* STUDIO / PROJECT MANAGEMENT */}

                <Route
                    path="/studio"
                    element={
                        <StudioAccess>
                            <Studio />
                        </StudioAccess>
                    }
                />

                {/* ACTUAL 3D EDITOR */}

                <Route
                    path="/studio/editor"
                    element={
                        <StudioEditor />
                    }
                />

                {/* LOAD SAVED PROJECT */}

                <Route
                    path="/studio/load/:projectId"
                    element={
                        <StudioLoadProject />
                    }
                />

                </Routes>
            </AssetStartupGate>

        </BrowserRouter>
    );
}

export default App;
