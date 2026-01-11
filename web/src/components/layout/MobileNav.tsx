// src/components/layout/MobileNav.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/uiStore';
import { ModeId } from '../../types';

interface NavItem {
    id: ModeId;
    icon: string;
    label: string;
}

const navItems: NavItem[] = [
    { id: 'plan', icon: '📋', label: 'Plan' },
    { id: 'alignment', icon: '🎯', label: 'Eşleştir' },
    { id: 'quiz', icon: '❓', label: 'Quiz' },
    { id: 'cheat-sheet', icon: '📝', label: 'Cheat' },
    { id: 'history', icon: '📚', label: 'Dersler' },
];

export function MobileNav() {
    const { mode, setMode, showNewLessonModal, setShowNewLessonModal } = useUiStore();

    return (
        <>
            {/* Bottom Navigation Bar */}
            <nav
                className="mobile-nav"
                role="navigation"
                aria-label="Ana navigasyon"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    padding: '8px 0 env(safe-area-inset-bottom, 8px)',
                    background: 'var(--card)',
                    borderTop: '1px solid var(--border)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {navItems.map((item) => (
                    <motion.button
                        key={item.id}
                        onClick={() => setMode(item.id)}
                        className={`mobile-nav__item ${mode === item.id ? 'mobile-nav__item--active' : ''}`}
                        whileTap={{ scale: 0.9 }}
                        aria-label={item.label}
                        aria-current={mode === item.id ? 'page' : undefined}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            padding: '6px 12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: mode === item.id ? 'var(--accent-2)' : 'var(--muted)',
                            transition: 'color 0.2s',
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>{item.icon}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600 }}>{item.label}</span>
                        {mode === item.id && (
                            <motion.div
                                layoutId="activeTab"
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    width: '24px',
                                    height: '3px',
                                    background: 'var(--accent-2)',
                                    borderRadius: '2px',
                                }}
                            />
                        )}
                    </motion.button>
                ))}
            </nav>

            {/* Floating Action Button */}
            <motion.button
                className="fab"
                onClick={() => setShowNewLessonModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Yeni ders oluştur"
                style={{
                    position: 'fixed',
                    bottom: '80px',
                    right: '16px',
                    zIndex: 101,
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <motion.span
                    animate={{ rotate: showNewLessonModal ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    +
                </motion.span>
            </motion.button>
        </>
    );
}

export default MobileNav;
