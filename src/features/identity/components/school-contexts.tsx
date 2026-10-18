"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {schoolContextsResponseSchema as responseSchema,contextSelectionResponseSchema} from "../schemas/membership-context.schema";
import type {SchoolContextsResponse} from "../models";
export function SchoolContexts() {
  const [data, setData] = useState<SchoolContextsResponse | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/account/context", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("School memberships unavailable.");
        setData(responseSchema.parse(await r.json()));
      })
      .catch(() =>
        setError("Could not load school memberships. Sign in again and retry."),
      );
  }, []);
  return (
    <>
      <p>
        Choose one of your active school roles. Each request checks the selected
        membership and its record permissions.
      </p>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      <div className="op-cards">
        {data?.contexts.map((c) => (
          <section className="op-card" key={c.id}>
            <h2>{c.schoolName}</h2>
            <p>
              {c.role} · {c.current ? "Current context" : "Available"}
            </p>
            <Button
              disabled={busy || c.current}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/account/context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ membershipId: c.id }),
                  });
                  if (!r.ok)
                    throw new Error("Membership is no longer available.");
                  const result = contextSelectionResponseSchema
                    .parse(await r.json());
                  window.location.assign(result.href);
                } catch {
                  setError("Could not switch context. Refresh and retry.");
                  setBusy(false);
                }
              }}
            >
              Use this school role
            </Button>
          </section>
        ))}
      </div>
    </>
  );
}
