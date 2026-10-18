import type { AuditActor } from "../../../shared/models/index.ts";
import type { SetupConfig, SetupStepId } from "../models/index.ts";
import { setupConfigSchemaFor } from "../schemas/setup-config.schema.ts";
import { setupPhaseIds } from "../schemas/setup-wizard.schema.ts";

const ownedFields = {
  "school-profile": ["school", "branding"],
  "academic-terms": ["calendar"],
  "classes-sections": ["classes"],
  "bell-schedule": ["bells"],
  "fee-structure": ["fees", "concessionPercent"],
  "staff-allocations": ["staff", "allocations"],
  "data-ingestion": [
    "students",
    "guardians",
    "relationships",
    "exceptions",
    "reviews",
  ],
  "portal-gateway": ["portal"],
} as const;
export function completeSetupStep(
  current: SetupConfig,
  step: SetupStepId,
  input: unknown,
  inactiveStudentIds: readonly string[] = [],
): SetupConfig {
  const setupConfigSchema=setupConfigSchemaFor(new Set(inactiveStudentIds));
  const index = setupPhaseIds.indexOf(step);
  if (index > current.completed.length)
    throw new Error("Complete the preceding setup steps first.");
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error("Invalid setup input.");
  const incoming = setupConfigSchema.parse({
    ...input,
    completed: current.completed.slice(0, index),
  });
  const next = structuredClone(current);
  for (const key of ownedFields[step])
    Object.assign(next, { [key]: incoming[key] });
  const changed = ownedFields[step].some(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]),
  );
  if (changed) {
    next.completed = current.completed.slice(0, index);
    if (step !== "portal-gateway") next.portal.invitationsPrepared = false;
  }
  if (!next.completed.includes(step))
    next.completed = setupPhaseIds.slice(0, index + 1);
  if (
    step === "portal-gateway" &&
    next.portal.invitationsPrepared &&
    !current.portal.invitationsPrepared
  ) {
    const recipients = [
      ...new Set(
        next.relationships
          .filter((link) => link.canReceiveNotices)
          .map((link) => link.guardianId),
      ),
    ];
    if (!recipients.length)
      throw new Error(
        "Link at least one guardian before preparing invitations.",
      );
    next.notifications = [
      ...next.notifications,
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        recipients,
        status: "simulated" as const,
      },
    ].slice(-200);
  }
  return setupConfigSchema.parse(next);
}
export function appendAudit(
  config: SetupConfig,
  action: string,
  actor: AuditActor | null = null,
): SetupConfig {
  return {
    ...config,
    audit: [
      ...config.audit,
      { id: crypto.randomUUID(), at: new Date().toISOString(), action, actor },
    ].slice(-200),
  };
}
export function annualFeeMinor(config: SetupConfig) {
  return Math.round(
    config.fees.reduce(
      (n, f) =>
        n +
        f.amountMinor * { annual: 1, quarterly: 4, monthly: 12 }[f.frequency],
      0,
    ) *
      (1 - config.concessionPercent / 100),
  );
}
export function setupPhases(config: SetupConfig) {
  const descriptions = [
    `${config.school.name} · ${config.school.address.city}`,
    `${config.calendar.terms.length} terms · ${config.calendar.year.name}`,
    `${config.classes.length} sections · ${config.classes.reduce((n, c) => n + c.capacity, 0)} seats`,
    `${config.bells.filter((b) => b.kind === "period").length} periods · ${config.bells.filter((b) => b.kind === "break").length} breaks`,
    `${config.fees.length} fee heads · ${config.concessionPercent}% concession`,
    `${config.staff.length} staff · ${config.allocations.length} allocations`,
    `${config.students.length} students · ${config.exceptions.length} exceptions`,
    config.completed.length === 8
      ? "portal configuration completed."
      : "Enable portals after ingestion sign-off.",
  ];
  const titles = [
    "School Profile",
    "Terms & Semesters",
    "Classes & Sections",
    "Bell Schedule",
    "Fee Structure",
    "Staff Allocations",
    "Data Sync & Ingestion",
    "Portal & App Gateway",
  ];
  return setupPhaseIds.map((id, i) => ({
    id,
    title: titles[i],
    description: descriptions[i],
    status:
      i < config.completed.length
        ? ("completed" as const)
        : i === config.completed.length
          ? ("in_progress" as const)
          : ("locked" as const),
  }));
}

/** Screen projections always read current canonical names, guardian links and section labels. */
export function projectExceptions(config: SetupConfig) {
  return config.exceptions.map((record) => {
    const student = config.students.find(
      (s) => s.admissionNumber === record.id,
    );
    if (!student) return record;
    const section = config.classes.find((c) => c.id === student.classSectionId);
    const link = config.relationships.find((r) => r.studentId === student.id);
    const guardian = config.guardians.find((g) => g.id === link?.guardianId);
    return {
      ...record,
      name: student.displayName,
      guardian: guardian?.displayName ?? record.guardian,
      grade: section ? `${section.grade}-${section.section}` : record.grade,
    };
  });
}
