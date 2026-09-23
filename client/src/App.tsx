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
import StudioLoadProject from "./pages/StudioLoadProject";

function App() {

    return (

        <BrowserRouter>

            <Routes>

                {/* ------------------------------------------
                    HOME
                ------------------------------------------ */}

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


                {/* ------------------------------------------
                    AUTH
                ------------------------------------------ */}

                <Route
                    path="/auth"
                    element={
                        <AuthPage />
                    }
                />


                {/* ------------------------------------------
                    LIBRARY
                ------------------------------------------ */}

                <Route
                    path="/library"
                    element={
                        <LibraryPage />
                    }
                />


                {/* ------------------------------------------
                    STUDIO / PROJECT MANAGEMENT
                ------------------------------------------ */}

                <Route
                    path="/studio"
                    element={
                        <Studio />
                    }
                />


                {/* ------------------------------------------
                    ACTUAL 3D EDITOR
                ------------------------------------------ */}

                <Route
                    path="/studio/editor"
                    element={
                        <StudioEditor />
                    }
                />

                <Route
    path="/studio/load/:projectId"
    element={
        <StudioLoadProject />
    }
/>

            </Routes>

        </BrowserRouter>
    );
}

export default App;