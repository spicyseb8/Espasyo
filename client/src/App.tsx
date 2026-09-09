import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Studio from "./pages/Studio";
import AuthPage from "./pages/auth/AuthPage";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<Home />} />
                <Route path="/studio" element={<Studio />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;