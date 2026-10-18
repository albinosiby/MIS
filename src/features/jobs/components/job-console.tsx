"use client";
import { useEffect, useState } from "react";
import type {JobConsoleResponse} from "../models";
import { Button } from "@/components/ui/button";
import {jobConsoleResponseSchema as responseSchema} from "../schemas/job.schema";
export function JobConsole() {
  const [data, setData] = useState<JobConsoleResponse | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      if (!r.ok) throw new Error("Jobs unavailable to this account.");
      setData(responseSchema.parse(await r.json()));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jobs unavailable.");
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, []);
  async function change(id: string, action: "retry" | "cancel") {
    setBusy(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!r.ok)
        throw new Error(
          "A running/completed job cannot be changed. Refresh and retry.",
        );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Job change failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">Communication / background work</span>
          <h1>Scheduled work & delivery</h1>
          <p>
            Durable jobs retain leases, attempts and retry states independently
            of your browser.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh jobs
        </Button>
      </div>
      {error && (
        <p role="alert" className="op-error">
          {error}
        </p>
      )}
      <div className="op-metrics">
        {Object.entries(data?.providers ?? {}).map(([provider, state]) => (
          <div className="op-card" key={provider}>
            <strong>{provider}</strong>
            <p>{state}</p>
          </div>
        ))}
      </div>
      <div className="op-table-wrap">
        <table className="op-table">
          <thead>
            <tr>
              <th>JOB</th>
              <th>RUN AT</th>
              <th>STATE</th>
              <th>ATTEMPTS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {data?.jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.kind}
                  <br />
                  <small>{j.dedupe_key}</small>
                </td>
                <td>{new Date(j.run_at).toLocaleString()}</td>
                <td>
                  {j.status}
                  {j.last_error && <p>{j.last_error}</p>}
                </td>
                <td>
                  {j.attempts}/{j.max_attempts}
                </td>
                <td>
                  {!["running", "completed"].includes(j.status) && (
                    <div className="flex gap-3">
                      {["failed", "blocked", "retry"].includes(j.status) && (
                        <button
                          disabled={busy}
                          onClick={() => void change(j.id, "retry")}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        disabled={busy || j.status === "cancelled"}
                        onClick={() => void change(j.id, "cancel")}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.jobs.length && (
          <p className="op-empty">
            {data ? "No scheduled jobs yet." : "Loading jobs…"}
          </p>
        )}
      </div>
      <section className="op-card mt-6">
        <h2>Recent delivery attempts</h2>
        {data?.attempts.slice(0, 30).map((a) => (
          <p key={a.id}>
            {new Date(a.created_at).toLocaleString()} · Attempt {a.attempt} ·{" "}
            {a.outcome} · {a.detail}
          </p>
        ))}
      </section>
    </>
  );
}
