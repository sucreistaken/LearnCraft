import React, { forwardRef } from "react";
import { motion } from "framer-motion";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className = "",
      onClick,
      type,
      style,
      id,
      title,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const classes = [
      "lc-button",
      `lc-button--${variant}`,
      `lc-button--${size}`,
      fullWidth && "lc-button--full",
      (disabled || loading) && "lc-button--disabled",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        onClick={onClick}
        type={type}
        style={style}
        id={id}
        title={title}
        aria-label={ariaLabel}
        whileHover={isDisabled ? undefined : { y: -2 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
      >
        {loading && <span className="lc-button__spinner" />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
