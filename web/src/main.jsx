import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { ThemeSync } from './components/ui/ThemeSync.jsx'
import { applyDocumentTheme, readInitialTheme } from './theme/themeDocument.js'

applyDocumentTheme(readInitialTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
