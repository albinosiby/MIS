import type { ComponentProps } from "react";
import { fieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Native select retains built-in keyboard and mobile picker behaviour.
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClassName, "pr-8", className)} {...props}>{children}</select>;
}
