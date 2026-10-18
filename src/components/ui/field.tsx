import type { ReactNode } from "react";

export function Field({ id, label, description, children }: {
  id: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {description ? <p id={`${id}-description`} className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
