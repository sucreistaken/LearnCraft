import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { motion } from "framer-motion";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  children,
  className = "",
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const handleChange = useCallback(
    (val: string) => {
      if (!isControlled) setInternalValue(val);
      onValueChange?.(val);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{ value: currentValue, onValueChange: handleChange }}
    >
      <div className={`lc-tabs ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "underline" | "pill";
}

export function TabsList({
  variant = "underline",
  className = "",
  children,
  ...rest
}: TabsListProps) {
  const variantClass =
    variant === "pill" ? "lc-tabs-list--pill" : "";

  return (
    <div
      className={`lc-tabs-list ${variantClass} ${className}`}
      role="tablist"
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className = "",
  children,
  ...rest
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext();
  const isActive = selectedValue === value;

  return (
    <button
      className={`lc-tabs-trigger${isActive ? " lc-tabs-trigger--active" : ""} ${className}`}
      role="tab"
      aria-selected={isActive}
      onClick={() => onValueChange(value)}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function TabsContent({
  value,
  className = "",
  children,
  id,
}: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();

  if (selectedValue !== value) return null;

  return (
    <motion.div
      className={`lc-tabs-content ${className}`}
      role="tabpanel"
      id={id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
