// UI Component Library – barrel export
export { Button } from "./Button";
export type { ButtonProps } from "./Button";

export { Card, CardHeader, CardBody, CardFooter } from "./Card";
export type { CardProps } from "./Card";

export { Input, Textarea } from "./Input";
export type { InputProps, TextareaProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
export type { ModalProps } from "./Modal";

export { Badge } from "./Badge";
export type { BadgeProps } from "./Badge";

export { Spinner } from "./Spinner";
export type { SpinnerProps } from "./Spinner";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from "./Tabs";

// Existing components (re-export for convenience)
export { Skeleton, CardSkeleton, ListSkeleton, TableSkeleton } from "./Skeleton";
export { EmptyState, NoPlanEmpty, NoQuizEmpty, NoLessonsEmpty, NoCheatSheetEmpty } from "./EmptyState";
export { ThemeToggle } from "./ThemeToggle";
export { ToastProvider } from "./Toast";
export { ErrorBoundary } from "./ErrorBoundary";
