
import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

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
                        <Studio />
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
