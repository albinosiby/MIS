"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  Building2,
  Users,
  LifeBuoy,
  LayoutDashboard,
  ShieldCheck,
  Search,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SchoolLogo } from "@/components/branding/school-logo";
import { AccountCreateForm as AccountForm } from "./account-create-form";
import { api, message, PlatformField, Status, Pagination } from "./platform-ui";
export { api, PlatformField, Status } from "./platform-ui";
import type { AccountIdentity } from "../../identity/models";
import { signOut } from "../../identity/server/actions";
import {
  institutionCreateSchema,
  institutionCreateResponseSchema,
  accountCreateSchema,
  platformCommandSchema,
  platformListSchema,
  inspectionSchema,
  platformFilesSchema,
  ticketDetailSchema,
  schoolAccountRoleSchema,
  pendingRequestsSchema,
} from "../schemas/platform.schema";
import type { PlatformList, SupportDetail } from "../models";
import { manualEmailHref } from "../domain/policy";
const nav = [
  { label: "Overview", path: "", icon: LayoutDashboard },
  { label: "Institutions", path: "institutions", icon: Building2 },
  { label: "Users", path: "users", icon: Users },
  { label: "Support", path: "support", icon: LifeBuoy },
  { label: "Audit log", path: "audit", icon: ShieldCheck },
];
export function PlatformPanel({
  actor,
  screen,
}: {
  actor: AccountIdentity;
  screen: string[];
}) {
  const view = screen[0] || "overview",
    detail = screen[1] && screen[1] !== "new",
    title =
      view === "overview"
        ? "Platform overview"
        : view === "institutions"
          ? screen[1] === "new"
            ? "Add institution"
            : detail
              ? "Institution workspace"
              : "Institutions"
          : view === "users"
            ? "User management"
            : view === "support"
              ? "Support requests"
              : "Audit log";
  return (
    <div className="platform-app">
      <aside className="platform-sidebar">
        <Link href="/platform" className="platform-brand">
          <SchoolLogo size={38} />
          <span>
            School workspace<small>PLATFORM ADMINISTRATION</small>
          </span>
        </Link>
        <span className="platform-nav-label">WORKSPACE</span>
        <nav aria-label="Platform navigation">
          {nav.map((n) => (
            <Link
              key={n.label}
              href={`/platform${n.path ? `/${n.path}` : ""}`}
              className={view === (n.path || "overview") ? "active" : ""}
            >
              <n.icon size={19} />
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/mfa/enroll" className="platform-muted">
          Set up account MFA →
        </Link>
        <div className="platform-sidebar-footer">
          <ShieldCheck size={18} />
          <p>
            Platform administrator
            <small>Access across institutions is audited.</small>
          </p>
        </div>
      </aside>
      <div className="platform-main">
        <header className="platform-topbar">
          <span>
            Administration <span className="platform-muted">/ {title}</span>
          </span>
          <div>
            <span className="platform-avatar">{actor.name.slice(0, 1)}</span>
            <span>{actor.name}</span>
            <form action={signOut}>
              <Button variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main id="main-content" className="platform-content">
          <div className="platform-heading">
            <div>
              <span className="platform-eyebrow">CONNECTED INSTITUTIONS</span>
              <h1>{title}</h1>
              <p>Manage your institutions, people and support in one place.</p>
            </div>
            {view !== "institutions" || !screen[1] ? (
              <Link
                className="platform-primary-link"
                href="/platform/institutions/new"
              >
                <Plus size={17} /> Add institution
              </Link>
            ) : (
              <Link href="/platform/institutions">← All institutions</Link>
            )}
          </div>
          {view === "institutions" && screen[1] === "new" ? (
            <InstitutionForm />
          ) : view === "institutions" && detail ? (
            <InstitutionDetail id={screen[1]} />
          ) : view === "support" && detail ? (
            <TicketPanel id={screen[1]} />
          ) : (
            <PlatformDirectory key={view} view={view} />
          )}
        </main>
      </div>
    </div>
  );
}
function InstitutionForm() {
  const router = useRouter(),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = new FormData(form),
      v = (key: string) => String(f.get(key) ?? "").trim();
    try {
      const input = institutionCreateSchema.parse({
        requestId,
        institutionType: v("institutionType"),
        school: {
          name: v("name"),
          shortName: v("shortName"),
          curriculum: v("curriculum"),
          address: {
            line1: v("line1"),
            city: v("city"),
            region: v("region"),
            postalCode: v("postalCode"),
            countryCode: v("countryCode"),
          },
          email: v("email"),
          phone: v("phone"),
          timezone: v("timezone"),
          locale: v("locale"),
          currency: v("currency"),
        },
        year: {
          name: v("yearName"),
          startDate: v("startDate"),
          endDate: v("endDate"),
        },
        administratorName: v("administratorName"),
        administratorEmail: v("administratorEmail"),
        temporaryPassword: String(f.get("temporaryPassword") ?? ""),
      });
      const result = institutionCreateResponseSchema.parse(
        await api("/api/platform", { type: "institution-create", input }),
      );
      form.reset();
      router.push(`/platform/institutions/${result.schoolId}`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="platform-card platform-form" onSubmit={save}>
      <div className="platform-card-heading">
        <Building2 />
        <div>
          <h2>Institution details</h2>
          <p>
            Create a clean workspace. No sample people or transactions are
            added.
          </p>
        </div>
      </div>
      <div className="platform-grid">
        <PlatformField label="Institution name" name="name" />
        <PlatformField label="Short name" name="shortName" />
        <PlatformField label="Institution type" name="institutionType">
          <Select name="institutionType">
            <option value="school">School</option>
            <option value="college">College</option>
          </Select>
        </PlatformField>
        <PlatformField
          label="Board / curriculum"
          name="curriculum"
          value="CBSE"
        />
        <PlatformField label="Institution email" name="email" type="email" />
        <PlatformField label="Contact phone" name="phone" type="tel" />
        <PlatformField label="Street address" name="line1" />
        <PlatformField label="City" name="city" />
        <PlatformField label="State / region" name="region" />
        <PlatformField label="Postal code" name="postalCode" />
        <PlatformField label="Country code" name="countryCode" value="IN" />
        <PlatformField label="Timezone" name="timezone" value="Asia/Kolkata" />
        <PlatformField label="Locale" name="locale" value="en-IN" />
        <PlatformField label="Currency" name="currency" value="INR" />
      </div>
      <h2>Initial academic year</h2>
      <div className="platform-grid">
        <PlatformField label="Academic year name" name="yearName" />
        <PlatformField label="Starts on" name="startDate" type="date" />
        <PlatformField label="Ends on" name="endDate" type="date" />
      </div>
      <h2>First administrator</h2>
      <p className="platform-muted">
        Email is the login username. Share the temporary password privately; the
        recipient must change it on first sign-in. No email is sent
        automatically.
      </p>
      <div className="platform-grid">
        <PlatformField label="Administrator name" name="administratorName" />
        <PlatformField
          label="Administrator email"
          name="administratorEmail"
          type="email"
        />
        <PlatformField
          label="Temporary password"
          name="temporaryPassword"
          type="password"
        />
      </div>
      <p className="platform-muted">
        Password: 12+ characters with uppercase, lowercase, a number and a
        symbol.
      </p>
      {error && (
        <>
          <p role="alert" className="platform-error">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setRequestId(crypto.randomUUID());
              setError("");
            }}
          >
            Start a new registration request
          </Button>
        </>
      )}
      <div className="platform-form-footer">
        <Link href="/platform/institutions">Cancel</Link>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating workspace…" : "Create institution"}
        </Button>
      </div>
    </form>
  );
}
function PlatformDirectory({ view }: { view: string }) {
  const params = useSearchParams(),
    schoolId = params.get("schoolId") || "",
    [data, setData] = useState<PlatformList | null>(null),
    [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void api(
      `/api/platform?${new URLSearchParams({ view, page: String(page), q, ...(schoolId ? { schoolId } : {}) })}`,
    )
      .then((v) => {
        if (active) setData(platformListSchema.parse(v));
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [view, page, q, schoolId, refresh]);
  return (
    <>
      {view === "overview" && (
        <div className="platform-metrics">
          {[
            [
              Building2,
              "Institution directory",
              "Manage schools and colleges",
              "institutions",
            ],
            [Users, "People & access", "Create and manage accounts", "users"],
            [
              LifeBuoy,
              "Support inbox",
              "Review requests and follow up",
              "support",
            ],
          ].map(([Icon, title, note, path]) => {
            const Symbol = Icon as typeof Building2;
            return (
              <Link
                key={String(path)}
                href={`/platform/${String(path)}`}
                className="platform-metric"
              >
                <Symbol size={23} />
                <h2>{String(title)}</h2>
                <p>{String(note)}</p>
                <ArrowUpRight size={18} />
              </Link>
            );
          })}
        </div>
      )}
      {(view === "overview" || view === "institutions" || view === "users") && (
        <PendingProvisioning />
      )}
      {view === "users" && (
        <AccountForm
          key={schoolId}
          schoolId={schoolId}
          onSaved={() => setRefresh((r) => r + 1)}
        />
      )}
      <section className="platform-card">
        <div className="platform-list-heading">
          <div>
            <h2>
              {view === "overview"
                ? "Recently added institutions"
                : view === "audit"
                  ? "Platform activity"
                  : view === "support"
                    ? "Support inbox"
                    : view === "users"
                      ? "Institution accounts"
                      : "All institutions"}
            </h2>
            <p>
              {schoolId
                ? `Institution: ${schoolId}`
                : "Records are paginated and scoped by your platform permissions."}
            </p>
          </div>
          <Button variant="outline" onClick={() => setRefresh((r) => r + 1)}>
            Refresh
          </Button>
        </div>
        {view !== "audit" && (
          <form
            className="platform-search"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(query);
            }}
          >
            <Search size={18} />
            <Input
              aria-label="Search records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${view === "users" ? "by name" : view === "support" ? "by subject" : "institutions"}…`}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="platform-error">
            {error}
          </p>
        )}
        {!data && !error && (
          <p role="status" className="platform-empty">
            Loading records…
          </p>
        )}
        {data && (
          <>
            <div className="platform-table-wrap">
              <table className="platform-table">
                <thead>
                  <tr>
                    {(view === "users"
                      ? [
                          "Name / email",
                          "Institution",
                          "Role",
                          "Access",
                          "Manage",
                        ]
                      : view === "support"
                        ? [
                            "Request",
                            "Institution",
                            "Requester",
                            "Status",
                            "Open",
                          ]
                        : view === "audit"
                          ? ["Action", "Institution", "Operator", "Time"]
                          : ["Institution", "Type", "Contact", "Status", "Open"]
                    ).map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.institutions.map((i) => (
                    <tr key={i.school_id}>
                      <td>
                        <strong>{i.name}</strong>
                        <small>{i.school_id}</small>
                      </td>
                      <td>{i.institution_type}</td>
                      <td>{i.contact_email}</td>
                      <td>
                        <Status value={i.status} />
                      </td>
                      <td>
                        <Link href={`/platform/institutions/${i.school_id}`}>
                          View institution →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.users.map((u) => (
                    <UserRow
                      key={u.user_id}
                      user={u}
                      onSaved={() => setRefresh((r) => r + 1)}
                    />
                  ))}
                  {data.tickets.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.subject}</strong>
                        <small>{new Date(t.created_at).toLocaleString()}</small>
                      </td>
                      <td>
                        <Link href={`/platform/institutions/${t.school_id}`}>
                          {t.school_id}
                        </Link>
                      </td>
                      <td>
                        {t.requester_name}
                        <small>{t.reply_email}</small>
                      </td>
                      <td>
                        <Status value={t.status} />
                      </td>
                      <td>
                        <Link href={`/platform/support/${t.id}`}>Review →</Link>
                      </td>
                    </tr>
                  ))}
                  {data.audit.map((a) => (
                    <tr key={a.id}>
                      <td>{a.action}</td>
                      <td>{a.school_id ?? "Platform"}</td>
                      <td>{a.actor_id}</td>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.institutions.length &&
              !data.users.length &&
              !data.tickets.length &&
              !data.audit.length && (
                <div className="platform-empty">
                  <CheckCircle2 size={28} />
                  <h3>No records yet</h3>
                  <p>
                    {view === "support"
                      ? "Requests submitted from the school Support page will appear here."
                      : "Add an institution to begin, or change your search."}
                  </p>
                </div>
              )}
            <Pagination page={page} hasMore={data.hasMore} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
function UserRow({
  user: u,
  onSaved,
}: {
  user: PlatformList["users"][number];
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>, reset = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const command = platformCommandSchema.parse(
        reset
          ? {
              type: "account-reset",
              schoolId: u.school_id,
              userId: u.user_id,
              temporaryPassword: f.get("temporaryPassword"),
            }
          : {
              type: "account-update",
              schoolId: u.school_id,
              userId: u.user_id,
              role: f.get("role"),
              active: f.get("active") === "on",
            },
      );
      await api("/api/platform", command);
      form.reset();
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr>
      <td>
        <strong>{u.display_name}</strong>
        <small>{u.email}</small>
      </td>
      <td>
        <Link href={`/platform/institutions/${u.school_id}`}>
          {u.school_id}
        </Link>
      </td>
      <td>{u.role}</td>
      <td>
        <Status value={u.active ? "active" : "disabled"} />
        {u.must_change_password && <small>Password change required</small>}
      </td>
      <td>
        <details>
          <summary>Manage account</summary>
          <form className="platform-inline-form" onSubmit={(e) => save(e)}>
            <label>
              Role
              <Select name="role" defaultValue={u.role}>
                {schoolAccountRoleSchema.options.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </label>
            <label>
              <input type="checkbox" name="active" defaultChecked={u.active} />{" "}
              Active access
            </label>
            <Button type="submit" disabled={busy}>
              Save access
            </Button>
          </form>
          <form
            className="platform-inline-form"
            onSubmit={(e) => save(e, true)}
          >
            <label>
              New temporary password
              <Input
                name="temporaryPassword"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <Button type="submit" variant="outline" disabled={busy}>
              Reset password
            </Button>
          </form>
          <small>
            Reset signs out current sessions and requires a new password.
          </small>
          {error && (
            <p role="alert" className="platform-error">
              {error}
            </p>
          )}
        </details>
      </td>
    </tr>
  );
}
function InstitutionDetail({ id }: { id: string }) {
  const [data, setData] = useState<z.infer<typeof inspectionSchema> | null>(
      null,
    ),
    [files, setFiles] = useState<z.infer<typeof platformFilesSchema> | null>(
      null,
    ),
    [section, setSection] = useState("setup.school"),
    [yearId, setYearId] = useState(""),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    setFiles(null);
    const params = new URLSearchParams({
      schoolId: id,
      page: String(page),
      q,
      section,
      ...(yearId ? { yearId } : {}),
    });
    void api(`/api/platform?view=inspect&${params}`)
      .then((v) => {
        if (active) setData(inspectionSchema.parse(v));
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [id, section, yearId, page, q, refresh]);
  async function loadFiles(n = 1) {
    try {
      setError("");
      const result = platformFilesSchema.parse(
        await api(
          `/api/platform?${new URLSearchParams({ view: "files", schoolId: id, page: String(n), ...(yearId ? { yearId } : {}) })}`,
        ),
      );
      setFiles(result);
    } catch (e) {
      setError(message(e));
    }
  }
  async function status(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(
        "/api/platform",
        platformCommandSchema.parse({
          type: "institution-status",
          schoolId: id,
          status: f.get("status"),
        }),
      );
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="platform-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading institution…</p>}
      {data && (
        <>
          <div className="platform-institution-banner">
            <Building2 size={32} />
            <div>
              <h2>{data.school.name}</h2>
              <p>
                {data.school.address.city} · {data.school.curriculum} ·{" "}
                {data.completed}/8 setup steps complete
              </p>
              <small>{id}</small>
            </div>
            <Status value={data.status} />
          </div>
          <div className="platform-notice">
            <ShieldCheck size={20} />
            <p>
              Read-only institution inspection. Your platform identity is
              retained and access is audited.
            </p>
          </div>
          <div className="platform-detail-links">
            <Link href={`/platform/users?schoolId=${encodeURIComponent(id)}`}>
              Manage institution users →
            </Link>
            <Link href={`/platform/support?schoolId=${encodeURIComponent(id)}`}>
              View support requests →
            </Link>
            <Button variant="outline" onClick={() => loadFiles()}>
              Private documents
            </Button>
          </div>
          <form
            className="platform-card platform-status-form"
            onSubmit={status}
          >
            <label>
              Institution access
              <Select
                key={data.status}
                name="status"
                defaultValue={data.status}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </label>
            <p>
              Suspension blocks institution logins and school operations while
              preserving records.
            </p>
            <Button type="submit" disabled={busy}>
              Save status
            </Button>
          </form>
          <section className="platform-card">
            <div className="platform-inspection-controls">
              <label>
                Academic year
                <Select
                  value={yearId || data.yearId}
                  onChange={(e) => {
                    setYearId(e.target.value);
                    setPage(1);
                  }}
                >
                  {data.years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Data section
                <Select
                  value={section}
                  onChange={(e) => {
                    setSection(e.target.value);
                    setPage(1);
                  }}
                >
                  {data.sections.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.count})
                    </option>
                  ))}
                </Select>
              </label>
              <form
                className="platform-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQ(draft);
                  setPage(1);
                }}
              >
                <Input
                  aria-label="Search institution records"
                  placeholder="Search records…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button variant="outline" type="submit">
                  Search
                </Button>
              </form>
            </div>
            <h2>{section.replaceAll(".", " / ")}</h2>
            {data.rows.length ? (
              <div className="platform-records">
                {data.rows.map((r, i) => (
                  <details key={String(r.id ?? i)}>
                    <summary>
                      {String(
                        r.displayName ??
                          r.name ??
                          r.title ??
                          r.subject ??
                          r.id ??
                          `Record ${(page - 1) * 30 + i + 1}`,
                      )}
                    </summary>
                    <dl>
                      {Object.entries(r).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>
                            {typeof v === "object" && v !== null ? (
                              <pre>{JSON.stringify(v, null, 2)}</pre>
                            ) : (
                              String(v ?? "—")
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </div>
            ) : (
              <p className="platform-empty">No records in this section.</p>
            )}
            <Pagination page={page} hasMore={data.hasMore} onPage={setPage} />
          </section>
          {files && (
            <section className="platform-card">
              <h2>Private document register</h2>
              <p>
                Only ready, current documents can be downloaded. Revoked and
                superseded records remain visible in history.
              </p>
              <div className="platform-table-wrap">
                <table className="platform-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.files.map((f) => (
                      <tr key={f.id}>
                        <td>
                          {f.filename}
                          <small>Version {f.version}</small>
                        </td>
                        <td>{f.category}</td>
                        <td>
                          <Status value={f.status} />
                        </td>
                        <td>
                          {f.status === "ready" ? (
                            <a
                              href={`/api/platform/institutions/${encodeURIComponent(id)}/documents/${f.id}`}
                            >
                              Download
                            </a>
                          ) : (
                            "Unavailable"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!files.files.length && (
                <p className="platform-empty">No documents uploaded yet.</p>
              )}
              <Pagination
                page={files.page}
                hasMore={files.hasMore}
                onPage={(n) => loadFiles(n)}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
export function TicketPanel({
  id,
  schoolView = false,
}: {
  id: string;
  schoolView?: boolean;
}) {
  const [data, setData] = useState<SupportDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void api(
      schoolView
        ? `/api/support?ticketId=${id}`
        : `/api/platform?view=ticket&ticketId=${id}`,
    )
      .then((v) => {
        if (active) setData(ticketDetailSchema.parse(v));
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [id, schoolView, refresh]);
  async function update(
    e: FormEvent<HTMLFormElement>,
    kind: "status" | "internal-note" | "manual-contact",
  ) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const command = platformCommandSchema.parse({
        type: "ticket-update",
        ticketId: id,
        expectedVersion: data.ticket.version,
        status: kind === "status" ? f.get("status") : data.ticket.status,
        note: String(f.get("note") ?? ""),
        kind,
      });
      await api("/api/platform", command);
      form.reset();
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="platform-card platform-ticket">
      {error && (
        <p role="alert" className="platform-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading request…</p>}
      {data && (
        <>
          <div className="platform-list-heading">
            <div>
              <span className="platform-eyebrow">
                {data.ticket.category} SUPPORT
              </span>
              <h2>{data.ticket.subject}</h2>
              <p>
                {data.ticket.requester_name} · {data.ticket.reply_email}
              </p>
              <small>Request {id}</small>
            </div>
            <Status value={data.ticket.status} />
          </div>
          <p className="platform-ticket-description">
            {data.ticket.description}
          </p>
          {!schoolView && (
            <>
              <a
                className="platform-primary-link"
                href={manualEmailHref(
                  data.ticket.reply_email,
                  data.ticket.subject,
                  id,
                )}
              >
                <Mail size={17} /> Email requester
              </a>
              <p className="platform-muted">
                Opens your email application. Review and send manually. Opening
                a draft does not mark an email as sent.
              </p>
              <form
                className="platform-status-form"
                onSubmit={(e) => update(e, "status")}
              >
                <label>
                  Status
                  <Select
                    name="status"
                    key={data.ticket.version}
                    defaultValue={data.ticket.status}
                  >
                    {["open", "in-progress", "resolved", "closed"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </label>
                <PlatformField
                  name="note"
                  label="Status note (visible to requester)"
                  required={false}
                />
                <Button type="submit" disabled={busy}>
                  Update status
                </Button>
              </form>
              <div className="platform-grid">
                {(["internal-note", "manual-contact"] as const).map((kind) => (
                  <form
                    className="platform-inline-form"
                    key={kind}
                    onSubmit={(e) => update(e, kind)}
                  >
                    <label>
                      {kind === "internal-note"
                        ? "Internal note"
                        : "Record manual email / contact"}
                      <textarea
                        name="note"
                        required
                        minLength={3}
                        maxLength={2000}
                      />
                    </label>
                    <Button type="submit" variant="outline" disabled={busy}>
                      {kind === "internal-note"
                        ? "Save private note"
                        : "Confirm manual contact"}
                    </Button>
                  </form>
                ))}
              </div>
            </>
          )}
          <h3>Request history</h3>
          <ol className="platform-timeline">
            {data.events.map((e) => (
              <li key={e.id}>
                <strong>{e.kind.replaceAll("-", " ")}</strong>
                <time>{new Date(e.created_at).toLocaleString()}</time>
                <p>{e.note}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
function PendingProvisioning() {
  const [data, setData] = useState<z.infer<
      typeof pendingRequestsSchema
    > | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void api(`/api/platform?view=pending&page=${page}`)
      .then((v) => {
        if (active) setData(pendingRequestsSchema.parse(v));
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [page, refresh]);
  async function retry(
    e: FormEvent<HTMLFormElement>,
    row: z.infer<typeof pendingRequestsSchema>["requests"][number],
  ) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const input = {
        ...row.payload,
        requestId: row.id,
        temporaryPassword: f.get("temporaryPassword"),
      };
      await api(
        "/api/platform",
        platformCommandSchema.parse({
          type:
            row.kind === "institution"
              ? "institution-create"
              : "account-create",
          input,
        }),
      );
      form.reset();
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data?.requests.length && !error) return null;
  return (
    <details className="platform-card">
      <summary>Unfinished registrations and account requests</summary>
      <p>
        Retry the saved request with its original temporary password. Existing
        accounts are never overwritten. A duplicate-email request needs a new
        email and a new submission.
      </p>
      {error && (
        <p role="alert" className="platform-error">
          {error}
        </p>
      )}
      {data?.requests.map((row) => (
        <form
          key={row.id}
          className="platform-inline-form"
          onSubmit={(e) => retry(e, row)}
        >
          <strong>
            {row.kind === "institution"
              ? String(
                  (row.payload.school as Record<string, unknown>)?.name ??
                    row.school_id,
                )
              : String(row.payload.email ?? row.school_id)}
          </strong>
          <small>{row.id}</small>
          <PlatformField
            name="temporaryPassword"
            label="Original temporary password"
            type="password"
          />
          <Button type="submit" disabled={busy}>
            Retry saved request
          </Button>
        </form>
      ))}
      <Pagination
        page={page}
        hasMore={data?.hasMore ?? false}
        onPage={setPage}
      />
    </details>
  );
}
