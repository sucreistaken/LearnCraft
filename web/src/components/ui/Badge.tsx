import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "soft";
  size?: "sm" | "md" | "lg";
  rounded?: boolean;
}

export function Badge({
  variant = "default",
  size = "md",
  rounded = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    "lc-badge",
    `lc-badge--${variant}`,
    `lc-badge--${size}`,
    rounded && "lc-badge--rounded",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
