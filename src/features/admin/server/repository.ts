import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { platformActor } from "./auth";
import { provisionWorkspace } from "../domain/provision-workspace";
import { assertTicketTransition } from "../domain/policy";
import {
  platformCommandSchema,
  platformListSchema,
  inspectionSchema,
  platformFilesSchema,
  ticketDetailSchema,
  listQuerySchema,
  pendingRequestsSchema,
} from "../schemas/platform.schema";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema";
import { privateDocumentSchema } from "../../documents/schemas/private-document.schema";
import { identifierSchema } from "../../../shared/schemas/primitives";
const SIZE = 30;
function failure(error: { code?: string; message?: string } | null) {
  if (error) {
    console.error("Platform repository failure", { code: error.code });
    throw new Error(
      error.code === "PT409"
        ? "Data changed. Refresh and retry."
        : "This operation could not be completed. Verify the institution, account and current permissions.",
    );
  }
}
export async function platformAudit(
  actorId: string,
  schoolId: string | null,
  action: string,
) {
  const { error } = await createSupabaseAdminClient()
    .from("mis_platform_audit_events")
    .insert({
      actor_id: actorId,
      school_id: schoolId,
      action: action.slice(0, 500),
    });
  failure(error);
}
async function rpc(actorId: string, action: string, input: unknown) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_platform_command",
    { p_actor: actorId, p_action: action, p_input: input },
  );
  failure(error);
  return data;
}
export async function platformList(
  view: string,
  query: unknown,
  schoolId?: string,
) {
  await platformActor();
  const { page, q } = listQuerySchema.parse(query),
    db = createSupabaseAdminClient(),
    start = (page - 1) * SIZE;
  const result = {
    institutions: [],
    users: [],
    tickets: [],
    audit: [],
    page,
    hasMore: false,
  } as z.input<typeof platformListSchema>;
  const pattern = `%${q.replace(/[%_\\]/g, "")}%`;
  if (view === "institutions" || view === "overview") {
    let request = db
      .from("mis_institution_registry")
      .select("*")
      .order("created_at", { ascending: false })
      .order("school_id")
      .range(start, start + SIZE);
    if (q) request = request.ilike("name", pattern);
    const { data, error } = await request;
    failure(error);
    result.institutions = data ?? [];
  } else if (view === "users") {
    let request = db
      .from("mis_memberships")
      .select("user_id,school_id,display_name,role,active,person_id")
      .not("role", "in", "(platform,group)")
      .order("created_at", { ascending: false })
      .order("user_id")
      .range(start, start + SIZE);
    if (schoolId)
      request = request.eq("school_id", identifierSchema.parse(schoolId));
    if (q) request = request.ilike("display_name", pattern);
    const { data, error } = await request;
    failure(error);
    result.users = await Promise.all(
      (data ?? []).map(async (m) => {
        const [{ data: user, error: e }, { data: gate, error: g }] =
          await Promise.all([
            db.auth.admin.getUserById(m.user_id),
            db
              .from("mis_account_activation")
              .select("must_change_password")
              .eq("user_id", m.user_id)
              .maybeSingle(),
          ]);
        failure(e);
        failure(g);
        if (!user.user?.email) throw new Error("Account email unavailable.");
        return {
          ...m,
          email: user.user.email,
          must_change_password: gate?.must_change_password ?? false,
        };
      }),
    );
  } else if (view === "support") {
    let request = db
      .from("mis_support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(start, start + SIZE);
    if (q) request = request.ilike("subject", pattern);
    if (schoolId)
      request = request.eq("school_id", identifierSchema.parse(schoolId));
    const { data, error } = await request;
    failure(error);
    result.tickets = data ?? [];
  } else if (view === "audit") {
    let request = db
      .from("mis_platform_audit_events")
      .select("*")
      .order("id", { ascending: false })
      .range(start, start + SIZE);
    if (schoolId)
      request = request.eq("school_id", identifierSchema.parse(schoolId));
    const { data, error } = await request;
    failure(error);
    result.audit = data ?? [];
  } else throw new Error("Unknown platform view.");
  for (const key of ["institutions", "users", "tickets", "audit"] as const) {
    if (result[key].length > SIZE) {
      result.hasMore = true;
      result[key].pop();
    }
  }
  return platformListSchema.parse(result);
}
export async function platformCommand(input: unknown) {
  const actor = await platformActor(),
    command = platformCommandSchema.parse(input),
    db = createSupabaseAdminClient();
  if (command.type === "account-create") {
    const v = command.input;
    const { data: school, error: schoolError } = await db
      .from("mis_institution_registry")
      .select("status")
      .eq("school_id", v.schoolId)
      .maybeSingle();
    failure(schoolError);
    if (school?.status !== "active")
      throw new Error(
        "Choose an active institution before creating an account.",
      );
    if (v.personId) {
      const kind =
        v.role === "parent"
          ? "guardian"
          : v.role === "student"
            ? "student"
            : "staff";
      const { data: person, error: personError } = await db
        .from("mis_people")
        .select("id")
        .eq("school_id", v.schoolId)
        .eq("id", v.personId)
        .eq("kind", kind)
        .maybeSingle();
      failure(personError);
      if (!person)
        throw new Error(
          "Choose a person of the correct type in this institution before creating an account.",
        );
    }
  }
  if (
    command.type === "account-update" &&
    ["parent", "student"].includes(command.role)
  ) {
    const { data: member, error } = await db
      .from("mis_memberships")
      .select("person_id,role")
      .eq("school_id", command.schoolId)
      .eq("user_id", command.userId)
      .maybeSingle();
    failure(error);
    if (!member?.person_id || member.role !== command.role)
      throw new Error(
        "Link this account to the correct person through the school account settings first.",
      );
  }
  if (
    command.type === "institution-create" ||
    command.type === "account-create"
  ) {
    const v = command.input,
      { temporaryPassword, ...payload } = v;
    const schoolId =
      command.type === "institution-create"
        ? `school-${v.requestId}`
        : (
            command.input as Extract<
              typeof command,
              { type: "account-create" }
            >["input"]
          ).schoolId;
    const req = await rpc(actor.id, "reserve", {
      requestId: v.requestId,
      kind: command.type === "institution-create" ? "institution" : "account",
      payload,
      schoolId,
    });
    const reserved = z
      .object({
        status: z.enum(["pending", "complete"]),
        user_id: z.uuid().nullable(),
        school_id: identifierSchema,
      })
      .parse(req);
    if (reserved.status === "complete")
      return { schoolId: reserved.school_id, userId: reserved.user_id };
    const email =
      command.type === "institution-create"
        ? command.input.administratorEmail
        : command.input.email;
    const name =
      command.type === "institution-create"
        ? command.input.administratorName
        : command.input.name;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { platform_request: v.requestId },
    });
    let user = data.user;
    if (error || !user) {
      // Recover only our own unfinished Auth creation; never alter an existing person's password.
      for (let page = 1; page <= 100 && !user; page++) {
        const { data: users, error: e } = await db.auth.admin.listUsers({
          page,
          perPage: 100,
        });
        failure(e);
        user =
          users.users.find(
            (u) =>
              u.email?.toLowerCase() === email.toLowerCase() &&
              u.app_metadata.platform_request === v.requestId,
          ) ?? null;
        if (users.users.length < 100) break;
      }
      if (!user)
        throw new Error(
          "This email already exists or account creation failed. Use a different email; existing passwords were not changed.",
        );
    }
    const document =
      command.type === "institution-create"
        ? provisionWorkspace(command.input, schoolId)
        : undefined;
    await rpc(actor.id, "provision", {
      requestId: v.requestId,
      userId: user.id,
      ...(document ? { document } : {}),
    });
    return { schoolId, userId: user.id };
  }
  if (command.type === "ticket-update") {
    const { data, error } = await db
      .from("mis_support_tickets")
      .select("status")
      .eq("id", command.ticketId)
      .single();
    failure(error);
    if (!data) throw new Error("Support request unavailable.");
    assertTicketTransition(data.status, command.status);
  }
  if (command.type === "account-reset") {
    const { temporaryPassword, ...safe } = command;
    await rpc(actor.id, command.type, safe);
    const { error } = await db.auth.admin.updateUserById(command.userId, {
      password: temporaryPassword,
    });
    failure(error);
    return { userId: command.userId };
  }
  await rpc(actor.id, command.type, command);
  return { saved: true };
}
export async function inspectInstitution(
  schoolInput: unknown,
  query: URLSearchParams,
) {
  const actor = await platformActor(),
    schoolId = identifierSchema.parse(schoolInput),
    { page, q } = listQuerySchema.parse(Object.fromEntries(query)),
    db = createSupabaseAdminClient();
  const { data: registry, error: e } = await db
    .from("mis_institution_registry")
    .select("school_id,status,institution_type")
    .eq("school_id", schoolId)
    .single();
  failure(e);
  if (!registry) throw new Error("Institution unavailable.");
  const { data, error } = await db.rpc("mis_read_workspace", {
    p_school_id: schoolId,
  });
  failure(error);
  const root = workspaceSchema.parse(data);
  if (root.years.some((y) => y.setup.school.id !== schoolId))
    throw new Error("Institution scope mismatch.");
  const y = root.years.find(
    (y) =>
      y.setup.calendar.year.id === (query.get("yearId") || root.activeYearId),
  );
  if (!y) throw new Error("Academic year unavailable.");
  const parts: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(y.setup))
    parts[`setup.${k}`] = Array.isArray(v) ? v : [v];
  for (const [k, v] of Object.entries(y.records))
    parts[`records.${k}`] = Array.isArray(v) ? v : [v];
  for (const [k, v] of Object.entries(y.workflows))
    parts[`workflows.${k}`] = Array.isArray(v) ? v : [v];
  parts.extensions = y.extensions;
  const section = query.get("section") || "setup.school";
  if (!Object.hasOwn(parts, section)) throw new Error("Section unavailable.");
  const filtered = parts[section]
    .map((v) =>
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : { value: v },
    )
    .filter(
      (v) => !q || JSON.stringify(v).toLowerCase().includes(q.toLowerCase()),
    );
  await platformAudit(
    actor.id,
    schoolId,
    `Read institution ${y.setup.calendar.year.id} ${section}, page ${page}`,
  );
  return inspectionSchema.parse({
    status: registry.status,
    institutionType: registry.institution_type,
    school: y.setup.school,
    yearId: y.setup.calendar.year.id,
    years: root.years.map((y) => y.setup.calendar.year),
    completed: y.setup.completed.length,
    section,
    sections: Object.entries(parts).map(([key, rows]) => ({
      key,
      label: key.replaceAll(".", " / "),
      count: rows.length,
    })),
    rows: filtered.slice((page - 1) * SIZE, page * SIZE),
    people: [
      ...y.setup.staff.map((p) => ({
        id: p.id,
        name: p.displayName,
        kind: "staff",
      })),
      ...y.setup.students.map((p) => ({
        id: p.id,
        name: p.displayName,
        kind: "student",
      })),
      ...y.setup.guardians.map((p) => ({
        id: p.id,
        name: p.displayName,
        kind: "guardian",
      })),
    ],
    page,
    hasMore: filtered.length > page * SIZE,
  });
}
export async function institutionFiles(
  schoolInput: unknown,
  query: URLSearchParams,
) {
  const actor = await platformActor(),
    schoolId = identifierSchema.parse(schoolInput),
    { page } = listQuerySchema.parse(Object.fromEntries(query));
  let req = createSupabaseAdminClient()
    .from("mis_documents")
    .select("id,filename,category,status,academic_year_id,version")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * SIZE, page * SIZE);
  if (query.get("yearId"))
    req = req.eq(
      "academic_year_id",
      identifierSchema.parse(query.get("yearId")),
    );
  const { data, error } = await req;
  failure(error);
  await platformAudit(actor.id, schoolId, "Read private document register");
  return platformFilesSchema.parse({
    files: (data ?? []).slice(0, SIZE),
    page,
    hasMore: (data ?? []).length > SIZE,
  });
}
export async function platformDownload(
  schoolInput: unknown,
  fileInput: unknown,
) {
  const actor = await platformActor(),
    schoolId = identifierSchema.parse(schoolInput),
    id = z.uuid().parse(fileInput),
    db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("mis_documents")
    .select("*")
    .eq("id", id)
    .eq("school_id", schoolId)
    .single();
  failure(error);
  const d = privateDocumentSchema.parse(data);
  if (d.status !== "ready")
    throw new Error("Only current ready documents can be downloaded.");
  await platformAudit(actor.id, schoolId, `Download private document ${id}`);
  const { data: bytes, error: e } = await db.storage
    .from("mis-private-documents")
    .download(d.object_path);
  failure(e);
  if (!bytes) throw new Error("Document unavailable.");
  // Recheck revocation after the storage read, as in school document downloads.
  const { data: current, error: ce } = await db
    .from("mis_documents")
    .select("status")
    .eq("id", id)
    .eq("school_id", schoolId)
    .single();
  failure(ce);
  if (current?.status !== "ready") throw new Error("Document changed.");
  return new Response(bytes, {
    headers: {
      "Content-Type": d.mime_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function platformTicket(id: unknown) {
  await platformActor();
  const db = createSupabaseAdminClient(),
    tid = z.uuid().parse(id);
  const [{ data: ticket, error: t }, { data: events, error: e }] =
    await Promise.all([
      db.from("mis_support_tickets").select("*").eq("id", tid).single(),
      db
        .from("mis_support_events")
        .select("*")
        .eq("ticket_id", tid)
        .order("created_at")
        .limit(500),
    ]);
  failure(t);
  failure(e);
  return ticketDetailSchema.parse({ ticket, events });
}
export async function pendingProvisioning(query: unknown) {
  const actor = await platformActor(),
    { page } = listQuerySchema.parse(query),
    { data, error } = await createSupabaseAdminClient()
      .from("mis_platform_requests")
      .select("id,kind,school_id,payload,created_at")
      .eq("actor_id", actor.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30);
  failure(error);
  return pendingRequestsSchema.parse({
    requests: (data ?? []).slice(0, 30),
    page,
    hasMore: (data ?? []).length > 30,
  });
}
