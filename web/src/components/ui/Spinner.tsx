import React from "react";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "current" | "primary" | "muted";
}

export function Spinner({
  size = "md",
  color = "primary",
  className = "",
  ...rest
}: SpinnerProps) {
  const classes = [
    "lc-spinner",
    `lc-spinner--${size}`,
    `lc-spinner--${color}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} role="status" aria-label="Loading" {...rest} />;
}
