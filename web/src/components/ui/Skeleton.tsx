// src/components/ui/Skeleton.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    lines?: number;
}

const shimmer = {
    animate: {
        backgroundPosition: ['200% 0', '-200% 0'],
    },
    transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear' as const,
    },
};

export function Skeleton({
    width = '100%',
    height = '1rem',
    className = '',
    variant = 'rectangular',
    lines = 1,
}: SkeletonProps) {
    const baseStyles: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        background: 'linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-shine) 50%, var(--skeleton-base) 100%)',
        backgroundSize: '200% 100%',
        borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px',
    };

    if (lines > 1) {
        return (
            <div className={`skeleton-lines ${className}`} style={{ display: 'grid', gap: '8px' }}>
                {Array.from({ length: lines }).map((_, i) => (
                    <motion.div
                        key={i}
                        style={{
                            ...baseStyles,
                            width: i === lines - 1 ? '60%' : '100%',
                        }}
                        animate={shimmer.animate}
                        transition={shimmer.transition}
                        aria-hidden="true"
                    />
                ))}
            </div>
        );
    }

    return (
        <motion.div
            className={`skeleton ${className}`}
            style={baseStyles}
            animate={shimmer.animate}
            transition={shimmer.transition}
            aria-hidden="true"
        />
    );
}

// Card Skeleton
export function CardSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`card skeleton-card ${className}`} style={{ padding: '16px' }}>
            <Skeleton height={20} width="60%" />
            <div style={{ marginTop: '12px' }}>
                <Skeleton lines={3} />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <Skeleton width={80} height={28} />
                <Skeleton width={80} height={28} />
            </div>
        </div>
    );
}

// List Skeleton
export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gap: '12px' }}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}

// Table Skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="skeleton-table" style={{ display: 'grid', gap: '8px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}>
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} height={24} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}>
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <Skeleton key={colIdx} height={20} />
                    ))}
                </div>
            ))}
        </div>
    );
}
