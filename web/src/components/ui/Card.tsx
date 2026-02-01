import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "outlined" | "filled";
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
}

export function Card({
  variant = "elevated",
  padding = "md",
  hoverable = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const classes = [
    "lc-card",
    `lc-card--${variant}`,
    `lc-card--pad-${padding}`,
    hoverable && "lc-card--hoverable",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`lc-card__header ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`lc-card__body ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`lc-card__footer ${className}`} {...rest}>
      {children}
    </div>
  );
}
