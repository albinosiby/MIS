"use client";
import { ConversationInbox } from "../../communication/components/conversation-inbox";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AccountIdentity } from "../../identity/models";
import { canAccess } from "../../identity/domain/access";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { moduleDefinitions } from "../data/module-definitions";
import { createOperationsSeed } from "../data/operations-seed";
import { areaTitles, operationRoute } from "../data/routes";
import { canUseCollection, visibleOperations } from "../domain/operations";
import { CollectionScreen } from "./collection-screen";
import { OperationsShell } from "./operations-shell";
import { PortalScreen } from "../../portals/components/portal-screen";
export function OperationsScreen({
  actor,
  route,
}: {
  actor: AccountIdentity;
  route: string;
}) {
  const { year: y, mutate, busy } = useWorkspace();
  const [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const selected =
    route === "/workspace"
      ? { area: "workspace", kind: null, section: null }
      : operationRoute(route);
  if (!selected) return null;
  const all = moduleDefinitions.filter((d) => canUseCollection(actor, d.kind));
  const modules = all.filter(
    (d) =>
      (selected.area === "workspace" || d.area === selected.area) &&
      `${d.title} ${d.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <OperationsShell actor={actor} route={route}>
      {selected.area === "website" && (
        <div className="op-links mb-5">
          <Link href="/school-site">Open school website preview →</Link>
          <Link href="/welcome">Product website preview →</Link>
        </div>
      )}
      {selected.area === "documents" && (
        <div className="op-links mb-5">
          <Link href="/documents/files">Private file register →</Link>
          <Link href="/verify-certificate">Verify issued certificate →</Link>
          <Link href="/students/certificates">
            Certificate issue register →
          </Link>
        </div>
      )}
      {selected.section ? (
        <PortalScreen
          key={`${route}:${y.setup.calendar.year.id}`}
          actor={actor}
          section={selected.section}
        />
      ) : selected.kind ? (
        <>
          <div className="op-links mb-6">
            <Link href={`/${selected.area}`}>
              ← {areaTitles[selected.area]}
            </Link>
            <Link href="/workspace">All modules</Link>
          </div>
          {selected.kind === "messages" ? <ConversationInbox actor={actor} /> : <CollectionScreen actor={actor} kind={selected.kind} />}
        </>
      ) : (
        <>
          <div className="op-heading">
            <div>
              <span className="op-eyebrow">Greenfield / school operations</span>
              <h1>
                {selected.area === "workspace"
                  ? "Your school, connected"
                  : areaTitles[selected.area]}
              </h1>
              <p>
                Manage the people, processes and resources behind every school
                day. Open a workspace to review records, take action and follow
                progress.
              </p>
            </div>
            <span className="op-badge">{modules.length} workspaces</span>
          </div>
          <div className="op-metrics">
            {[
              ["Workspaces", modules.length],
              [
                "Saved records",
                modules.reduce(
                  (s, d) => s + visibleOperations(y, actor, d.kind).length,
                  0,
                ),
              ],
              ["Students", y.setup.students.length],
              ["Academic year", y.setup.calendar.year.name],
            ].map(([k, v]) => (
              <div className="op-card" key={k}>
                <small>{k}</small>
                <div className="op-stat">{v}</div>
                <small>Selected school scope</small>
              </div>
            ))}
          </div>
          {selected.area === "workspace" && (
            <div className="op-links mb-5">
              {[
                ["/dashboard", "School dashboard"],
                ["/settings/users", "Users & invitations"],
                ["/school-setup", "School setup"],
                ["/support", "Backup & recovery"],
                ["/account/security", "Account security"],
              ]
                .filter(([href]) => canAccess(actor.role, href))
                .map(([href, label]) => (
                  <Link href={href} key={href}>
                    {label} →
                  </Link>
                ))}
            </div>
          )}
          <div className="op-tools">
            <input
              aria-label="Search workspaces"
              placeholder="Find a module or workflow…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="op-error">
              {error}
            </p>
          )}
          <div className="op-cards">
            {modules.map((d) => (
              <Link
                href={`/${d.area}/${d.kind}`}
                className="op-card"
                key={d.kind}
              >
                <div className="flex justify-between gap-4 mb-4">
                  <span className="op-eyebrow">{areaTitles[d.area]}</span>
                  <span className="op-badge">
                    {visibleOperations(y, actor, d.kind).length} records
                  </span>
                </div>
                <h2>{d.title}</h2>
                <p>{d.description}</p>
                <div className="flex justify-between mt-5">
                  <span className="text-primary text-xs">Open workspace →</span>
                  {d.restricted && (
                    <span className="op-badge warning">Restricted</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {!modules.length && (
            <div className="op-empty">
              No workspaces match this search or account.
            </div>
          )}
        </>
      )}
    </OperationsShell>
  );
}
