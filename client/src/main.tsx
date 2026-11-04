import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { AssetFavoritesProvider } from './context/AssetFavoritesProvider'
import './index.css'
import './Variables.css'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AssetFavoritesProvider>
        <App />
      </AssetFavoritesProvider>
    </AuthProvider>
  </StrictMode>,
)
