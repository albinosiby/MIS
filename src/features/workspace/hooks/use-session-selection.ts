"use client";
import { useState, useEffect } from "react";
/** Transient UI selection survives module navigation; it is not a domain entity or part of backups. */
export function useSessionSelection(key: string, allowedIds: string[]) {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      return Array.isArray(value)
        ? value
            .filter(
              (id): id is string =>
                typeof id === "string" && allowedIds.includes(id),
            )
            .slice(0, 2000)
        : [];
    } catch {
      return [];
    }
  });
  const selected = ids.filter((id) => allowedIds.includes(id));
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(ids));
    } catch {}
  }, [key, ids]);
  function update(next: string[] | ((ids: string[]) => string[])) {
    setIds((previous) => (typeof next === "function" ? next(previous) : next));
  }
  return [selected, update] as const;
}
