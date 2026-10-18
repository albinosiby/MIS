"use client";
import type { ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export async function api(path: string, input?: unknown): Promise<unknown> {
  const response = await fetch(
    path,
    input === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new Error(
      error.success ? error.data.error : "Request could not be completed.",
    );
  }
  return data;
}
export function message(e: unknown) {
  return e instanceof z.ZodError
    ? e.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(" · ")}: ${i.message}`)
        .join(". ")
    : e instanceof Error
      ? e.message
      : "Please retry.";
}
export function PlatformField({
  label,
  name,
  type = "text",
  value,
  required = true,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className="platform-field">
      <span>{label}</span>
      {children ?? (
        <Input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          autoComplete={type === "password" ? "new-password" : undefined}
        />
      )}
    </label>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`platform-status ${["active", "resolved", "complete"].includes(value) ? "positive" : ""}`}
    >
      {value.replaceAll("-", " ")}
    </span>
  );
}
export function Pagination({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (n: number) => void;
}) {
  return (
    <div className="platform-pagination">
      <Button
        variant="outline"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>Page {page}</span>
      <Button
        variant="outline"
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
