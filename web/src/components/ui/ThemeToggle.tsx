// src/components/ui/ThemeToggle.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useUiStore } from '../../stores/uiStore';

export function ThemeToggle() {
    const { theme, toggleTheme } = useUiStore();

    const getIcon = () => {
        switch (theme) {
            case 'light':
                return '☀️';
            case 'dark':
                return '🌙';
            case 'system':
                return '💻';
            default:
                return '☀️';
        }
    };

    const getLabel = () => {
        switch (theme) {
            case 'light':
                return 'Açık tema';
            case 'dark':
                return 'Koyu tema';
            case 'system':
                return 'Sistem';
            default:
                return 'Tema';
        }
    };

    return (
        <motion.button
            className="theme-toggle"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Tema değiştir: ${getLabel()}`}
            title={getLabel()}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                fontSize: '18px',
                transition: 'background 0.2s, border-color 0.2s',
            }}
        >
            <motion.span
                key={theme}
                initial={{ rotate: -180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 180, opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {getIcon()}
            </motion.span>
        </motion.button>
    );
}

export default ThemeToggle;
