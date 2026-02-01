import React, { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  selectSize?: "sm" | "md" | "lg";
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      selectSize = "md",
      options,
      placeholder,
      className = "",
      id,
      children,
      ...rest
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    const selectClasses = [
      "lc-select-native",
      `lc-select-native--${selectSize}`,
      error && "lc-select-native--error",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={`lc-select-wrapper${fullWidth ? " lc-select-wrapper--full" : ""}`}
      >
        {label && (
          <label htmlFor={selectId} className="lc-select-label">
            {label}
          </label>
        )}
        <div className="lc-select-container">
          <select ref={ref} id={selectId} className={selectClasses} {...rest}>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <span className="lc-select-chevron" aria-hidden="true">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </span>
        </div>
        {error && <span className="lc-select-error">{error}</span>}
        {!error && helperText && (
          <span className="lc-select-helper">{helperText}</span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
