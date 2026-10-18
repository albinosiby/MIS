import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  advancedSettingsSchema,
  customValuesSchema,
  workflowApprovalSchema,
} from "../schemas/advanced.schema.ts";
export function saveAdvancedSettings(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("School administrator required.");
  const settings = advancedSettingsSchema.parse(input);
  for (const pending of y.workflows.approvals.filter(
    (r) => r.status === "pending",
  )) {
    const old = y.workflows.advanced.approvalPolicies.find(
        (p) => p.id === pending.policyId,
      ),
      next = settings.approvalPolicies.find((p) => p.id === pending.policyId);
    if (
      !next ||
      (old &&
        (old.kind !== next.kind ||
          old.enabled !== next.enabled ||
          JSON.stringify(old.roles) !== JSON.stringify(next.roles)))
    )
      throw new Error(
        "Complete pending approval chains before changing their assigned policy.",
      );
  }
  return { ...y, workflows: { ...y.workflows, advanced: settings } };
}
export function saveCustomValues(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  const request = customValuesSchema.parse(input);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    (!["admin", "principal"].includes(a.role) &&
      !(a.role === "hr" && request.entity === "staff"))
  )
    throw new Error("Custom record editing is not permitted.");
  const collection =
    request.entity === "student"
      ? y.setup.students
      : request.entity === "staff"
        ? y.setup.staff
        : y.records.inquiries;
  if (!collection.some((r) => r.id === request.ownerId))
    throw new Error("Record does not belong to this year.");
  const definitions = y.workflows.advanced.customFields.filter(
    (f) =>
      f.entity === request.entity &&
      (["admin", "principal"].includes(a.role) || f.readRoles.includes(a.role)),
  );
  for (const key of Object.keys(request.values))
    if (!definitions.some((f) => f.key === key))
      throw new Error("Unknown custom field.");
  for (const f of definitions) {
    const value = request.values[f.key];
    if (f.required && (value === undefined || value === ""))
      throw new Error(`${f.label} is required.`);
    if (value === undefined || value === "") continue;
    if (
      (f.type === "number" && typeof value !== "number") ||
      (f.type === "boolean" && typeof value !== "boolean") ||
      (["text", "date", "choice"].includes(f.type) && typeof value !== "string")
    )
      throw new Error(`${f.label} has the wrong type.`);
    if (
      (f.type === "date" && !z.iso.date().safeParse(value).success) ||
      (f.type === "choice" && !f.options.includes(String(value)))
    )
      throw new Error(`${f.label} has an invalid value.`);
  }
  const previous = y.workflows.customValues.find(
    (v) => v.entity === request.entity && v.ownerId === request.ownerId,
  );
  const hidden = Object.fromEntries(
    Object.entries(previous?.values ?? {}).filter(
      ([key]) => !definitions.some((f) => f.key === key),
    ),
  );
  return {
    ...y,
    workflows: {
      ...y.workflows,
      customValues: [
        ...y.workflows.customValues.filter(
          (v) => v.entity !== request.entity || v.ownerId !== request.ownerId,
        ),
        { ...request, values: { ...hidden, ...request.values } },
      ],
    },
  };
}
export function requestWorkflowApproval(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  kind: string,
  targetId: string,
) {
  const policy = y.workflows.advanced.approvalPolicies.find(
    (p) => p.enabled && p.kind === kind,
  );
  if (
    !policy ||
    y.workflows.approvals.some(
      (r) =>
        r.policyId === policy.id &&
        r.targetId === targetId &&
        r.status !== "rejected",
    )
  )
    return y;
  const approval = workflowApprovalSchema.parse({
    id: crypto.randomUUID(),
    policyId: policy.id,
    targetId,
    kind,
    requestedBy: a.id,
    createdAt: new Date().toISOString(),
    status: "pending",
    roles: policy.roles,
    decisions: [],
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      approvals: [...y.workflows.approvals, approval],
    },
  };
}
export function decideWorkflowApproval(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  const request = z
    .strictObject({
      id: z.string(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().trim().min(8).max(500),
    })
    .parse(input);
  const previous = y.workflows.approvals.find((r) => r.id === request.id);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !previous ||
    previous.status !== "pending" ||
    previous.requestedBy === a.id ||
    previous.decisions.some((d) => d.actorId === a.id) ||
    previous.roles[previous.decisions.length] !== a.role
  )
    throw new Error(
      "This approval step is not assigned to you, or you are its requester.",
    );
  const decisions = [
    ...previous.decisions,
    {
      role: a.role,
      actorId: a.id,
      decision: request.decision,
      note: request.note,
      at: new Date().toISOString(),
    },
  ];
  const saved = workflowApprovalSchema.parse({
    ...previous,
    decisions,
    status:
      request.decision === "rejected"
        ? "rejected"
        : decisions.length === previous.roles.length
          ? "approved"
          : "pending",
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      approvals: y.workflows.approvals.map((r) =>
        r.id === saved.id ? saved : r,
      ),
    },
  };
}
export function approvalSatisfied(
  y: SchoolYearWorkspace,
  kind: string,
  id: string,
) {
  const policy = y.workflows.advanced.approvalPolicies.find(
    (p) => p.enabled && p.kind === kind,
  );
  return (
    !policy ||
    y.workflows.approvals.some(
      (r) =>
        r.policyId === policy.id &&
        r.targetId === id &&
        r.status === "approved" &&
        JSON.stringify(r.roles) === JSON.stringify(policy.roles),
    )
  );
}
