/**
 * main.jsx — React application entry point.
 * Mounts the root <App /> component into #root.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '@/components/system/ErrorBoundary'
import { registerPWA } from './registerPWA'
import './styles/global.css'

registerPWA()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
