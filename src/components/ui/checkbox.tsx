"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root className={cn("peer inline-flex size-5 shrink-0 items-center justify-center rounded border border-input bg-card text-primary-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary disabled:cursor-not-allowed disabled:opacity-50", className)} {...props}>
      <CheckboxPrimitive.Indicator className="group">
        <Check className="size-3.5 group-data-[state=indeterminate]:hidden" aria-hidden="true" />
        <Minus className="hidden size-3.5 group-data-[state=indeterminate]:block" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
