"use client";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, message, PlatformField } from "./platform-ui";
import {
  accountCreateSchema,
  platformListSchema,
  inspectionSchema,
  schoolAccountRoleSchema,
} from "../schemas/platform.schema";
import type { InstitutionSummary } from "../models";
export function AccountCreateForm({
  schoolId,
  onSaved,
}: {
  schoolId: string;
  onSaved: () => void;
}) {
  const [selectedSchool, setSchool] = useState(schoolId),
    [institutions, setInstitutions] = useState<InstitutionSummary[]>([]),
    [query, setQuery] = useState(""),
    [lookup, setLookup] = useState(""),
    [people, setPeople] = useState<z.infer<typeof inspectionSchema>["people"]>(
      [],
    ),
    [schoolName, setSchoolName] = useState(""),
    [role, setRole] =
      useState<z.infer<typeof schoolAccountRoleSchema>>("admin"),
    [personId, setPerson] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    void api(
      `/api/platform?${new URLSearchParams({ view: "institutions", q: lookup })}`,
    )
      .then((v) => {
        if (active)
          setInstitutions(
            platformListSchema
              .parse(v)
              .institutions.filter((i) => i.status === "active"),
          );
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [lookup]);
  useEffect(() => {
    let active = true;
    setPeople([]);
    setSchoolName("");
    if (!selectedSchool) return;
    setLoading(true);
    void api(
      `/api/platform?${new URLSearchParams({ view: "inspect", schoolId: selectedSchool, section: "setup.staff" })}`,
    )
      .then((v) => {
        const parsed = inspectionSchema.parse(v);
        if (active) {
          setPeople(parsed.people);
          setSchoolName(parsed.school.name);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSchool]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setDone(false);
    setBusy(true);
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      const input = accountCreateSchema.parse({
        requestId,
        schoolId: selectedSchool,
        email: f.get("email"),
        name: f.get("name"),
        role,
        personId: personId || null,
        temporaryPassword: f.get("temporaryPassword"),
      });
      await api("/api/platform", { type: "account-create", input });
      form.reset();
      setPerson("");
      setDone(true);
      setRequestId(crypto.randomUUID());
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const kind =
      role === "parent" ? "guardian" : role === "student" ? "student" : "staff",
    family = ["parent", "student"].includes(role);
  return (
    <details className="platform-card platform-account-create">
      <summary>
        <Plus size={16} /> Create user account
      </summary>
      <form onSubmit={save} className="platform-form">
        <p>
          Choose an institution and role. Use a new email; existing accounts and
          passwords are never overwritten.
        </p>
        <div className="platform-search">
          <Input
            aria-label="Find an institution for account creation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setLookup(query);
              }
            }}
            placeholder="Find institution by name…"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setLookup(query)}
          >
            Find institution
          </Button>
        </div>
        <div className="platform-grid">
          <PlatformField name="schoolId" label="Institution">
            <Select
              name="schoolId"
              value={selectedSchool}
              required
              onChange={(e) => {
                setSchool(e.target.value);
                setPerson("");
                setError("");
              }}
            >
              <option value="">Choose an institution</option>
              {selectedSchool &&
                !institutions.some((i) => i.school_id === selectedSchool) && (
                  <option value={selectedSchool}>
                    {schoolName || "Selected institution"}
                  </option>
                )}
              {institutions.map((i) => (
                <option key={i.school_id} value={i.school_id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </PlatformField>
          <PlatformField name="role" label="Role">
            <Select
              name="role"
              value={role}
              onChange={(e) => {
                setRole(schoolAccountRoleSchema.parse(e.target.value));
                setPerson("");
              }}
            >
              {schoolAccountRoleSchema.options.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </PlatformField>
          <PlatformField
            name="personId"
            label={family ? `Linked ${kind}` : "Linked staff member (optional)"}
          >
            <Select
              name="personId"
              value={personId}
              required={family}
              disabled={!selectedSchool || loading}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">
                {loading
                  ? "Loading people…"
                  : family
                    ? `Choose a ${kind}`
                    : "No staff link"}
              </option>
              {people
                .filter((p) => p.kind === kind)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </PlatformField>
          <PlatformField name="name" label="Full name" />
          <PlatformField name="email" label="Login email" type="email" />
          <PlatformField
            name="temporaryPassword"
            label="Temporary password"
            type="password"
          />
        </div>
        <p className="platform-muted">
          Add student, guardian or staff records in the institution first when
          linking a portal account. Password: 12+ characters with uppercase,
          lowercase, a number and a symbol. The recipient must change it.
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
              Start a new account request
            </Button>
          </>
        )}
        {done && (
          <p role="status">
            Account created. Share credentials privately with the recipient.
          </p>
        )}
        <Button type="submit" disabled={busy || !selectedSchool || loading}>
          {busy ? "Creating…" : "Create user"}
        </Button>
      </form>
    </details>
  );
}
