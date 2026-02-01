// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initializeTheme } from './stores/uiStore';
import './index.css';
import './styles/index.css';

// Initialize theme on load
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <ToastProvider />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
