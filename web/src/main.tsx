// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { initializeTheme } from './stores/uiStore';
import './index.css';
import './App.css';

// Initialize theme on load
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <ToastProvider />
    </BrowserRouter>
  </React.StrictMode>
);
