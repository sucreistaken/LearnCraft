import React, { forwardRef } from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  inputSize?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      inputSize = "md",
      className = "",
      id,
      ...rest
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    const fieldClasses = [
      "lc-input-field",
      `lc-input-field--${inputSize}`,
      error && "lc-input-field--error",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const hasIcons = leftIcon || rightIcon;

    const inputEl = (
      <input ref={ref} id={inputId} className={fieldClasses} {...rest} />
    );

    return (
      <div
        className={`lc-input-wrapper${fullWidth ? " lc-input-wrapper--full" : ""}`}
      >
        {label && (
          <label htmlFor={inputId} className="lc-input-label">
            {label}
          </label>
        )}
        {hasIcons ? (
          <div
            className={`lc-input-icon-wrap${leftIcon ? " lc-input-icon-wrap--left" : ""}${rightIcon ? " lc-input-icon-wrap--right" : ""}`}
          >
            {leftIcon && (
              <span className="lc-input-icon lc-input-icon--left">
                {leftIcon}
              </span>
            )}
            {inputEl}
            {rightIcon && (
              <span className="lc-input-icon lc-input-icon--right">
                {rightIcon}
              </span>
            )}
          </div>
        ) : (
          inputEl
        )}
        {error && <span className="lc-input-error">{error}</span>}
        {!error && helperText && (
          <span className="lc-input-helper">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  textareaSize?: "sm" | "md" | "lg";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      textareaSize = "md",
      className = "",
      id,
      ...rest
    },
    ref
  ) => {
    const inputId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    const fieldClasses = [
      "lc-input-field lc-textarea-field",
      `lc-input-field--${textareaSize}`,
      error && "lc-input-field--error",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={`lc-input-wrapper${fullWidth ? " lc-input-wrapper--full" : ""}`}
      >
        {label && (
          <label htmlFor={inputId} className="lc-input-label">
            {label}
          </label>
        )}
        <textarea ref={ref} id={inputId} className={fieldClasses} {...rest} />
        {error && <span className="lc-input-error">{error}</span>}
        {!error && helperText && (
          <span className="lc-input-helper">{helperText}</span>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
