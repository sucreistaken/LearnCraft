// src/components/ui/EmptyState.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon = '📭',
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <motion.div
            className={`empty-state ${className}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                textAlign: 'center',
            }}
        >
            <motion.div
                className="empty-state__icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    filter: 'grayscale(0.2)',
                }}
                aria-hidden="true"
            >
                {icon}
            </motion.div>

            <h3
                className="empty-state__title"
                style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: '0 0 8px',
                    color: 'var(--text)',
                }}
            >
                {title}
            </h3>

            {description && (
                <p
                    className="empty-state__description"
                    style={{
                        fontSize: '14px',
                        color: 'var(--muted)',
                        margin: '0 0 20px',
                        maxWidth: '320px',
                    }}
                >
                    {description}
                </p>
            )}

            {action && (
                <motion.button
                    className="btn btn-primary"
                    onClick={action.onClick}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {action.label}
                </motion.button>
            )}
        </motion.div>
    );
}

// Preset empty states
export function NoPlanEmpty({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon="📋"
            title="No plan created yet"
            description="Enter lesson content from the left panel and click 'Plan & Analyze'."
            action={onAction ? { label: 'Get Started', onClick: onAction } : undefined}
        />
    );
}

export function NoQuizEmpty({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon="❓"
            title="No quiz yet"
            description="Create a lesson plan first, then you can generate a quiz."
            action={onAction ? { label: 'Create Quiz', onClick: onAction } : undefined}
        />
    );
}

export function NoLessonsEmpty({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon="📚"
            title="No lessons yet"
            description="Get started by creating a new lesson."
            action={onAction ? { label: 'Create New Lesson', onClick: onAction } : undefined}
        />
    );
}

export function NoCheatSheetEmpty({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon="📝"
            title="Cheat Sheet not created"
            description="Generate a summary cheat sheet based on your lesson content."
            action={onAction ? { label: 'Generate', onClick: onAction } : undefined}
        />
    );
}
