// src/components/ui/Toast.tsx
import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
    return (
        <Toaster
            position="bottom-center"
            reverseOrder={false}
            gutter={8}
            containerStyle={{
                bottom: 100, // Above mobile nav
            }}
            toastOptions={{
                duration: 3000,
                style: {
                    background: 'var(--card)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    boxShadow: 'var(--shadow-2)',
                },
                success: {
                    iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                    },
                },
            }}
        />
    );
}

export default ToastProvider;
