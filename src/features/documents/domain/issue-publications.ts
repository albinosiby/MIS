import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { certificateBulkSchema } from "../schemas/certificate-issue.schema.ts";
import { scope } from "../../workspace/domain/operations.ts";
import { publicationSchema } from "../../reports/schemas/publication.schema.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("Certificate issue permission required.");
}
export function issueBulkCertificates(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = certificateBulkSchema.parse(input),
    template = y.extensions.find(
      (t) =>
        t.id === r.templateId &&
        t.kind === "certificate-templates" &&
        t.status === "published",
    );
  if (
    !template ||
    new Set(r.studentIds).size !== r.studentIds.length ||
    r.studentIds.some((id) => !y.setup.students.some((s) => s.id === id))
  )
    throw new Error(
      "Choose unique students and a published template in this year.",
    );
  if (
    r.issuedOn < y.setup.calendar.year.startDate ||
    r.issuedOn > y.setup.calendar.year.endDate
  )
    throw new Error("Issue date is outside this academic year.");
  const placeholderNames = [
    ...String(template.values.body).matchAll(/\{\{([^{}]+)\}\}/g),
  ].map((m) => m[1].trim());
  if (
    placeholderNames.some(
      (k) =>
        ![
          "school",
          "student",
          "admissionNumber",
          "year",
          "issuedOn",
          "classSection",
        ].includes(k),
    )
  )
    throw new Error("Template contains an unsupported placeholder.");
  let next = y;
  for (const studentId of r.studentIds) {
    const certificate = {
      ...scope(y),
      id: crypto.randomUUID(),
      studentId,
      type: r.type,
      issuedOn: r.issuedOn,
      status: "issued" as const,
      reference: "pending",
    };
    next = {
      ...next,
      records: {
        ...next.records,
        certificates: [...next.records.certificates, certificate],
      },
    };
    next = publishCertificate(next, a, certificate.id, template.id);
  }
  return next;
}
export function publishCertificate(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
  templateId?: string,
  preserveReference = false,
) {
  permit(y, a);
  const cert = y.records.certificates.find(
    (c) => c.id === id && c.status === "issued",
  );
  if (!cert) throw new Error("Issued certificate unavailable.");
  if (
    y.workflows.publications.some(
      (p) => p.kind === "certificate" && p.sourceId === id,
    )
  )
    return y;
  const student = y.setup.students.find((s) => s.id === cert.studentId)!;
  const klass = y.setup.classes.find((c) => c.id === student.classSectionId)!;
  const template = templateId
    ? y.extensions.find(
        (t) =>
          t.id === templateId &&
          t.kind === "certificate-templates" &&
          t.status === "published",
      )
    : undefined;
  const serial = (y.workflows.counters.certificate ?? 0) + 1,
    prefix = String(template?.values.prefix ?? "CERT").trim();
  if (!/^[A-Za-z0-9_-]{1,12}$/.test(prefix))
    throw new Error(
      "Template prefix must contain up to 12 letters, digits, hyphens or underscores.",
    );
  const reference = preserveReference
    ? cert.reference
    : `${prefix}-${y.setup.calendar.year.id.slice(0, 60)}-${String(serial).padStart(6, "0")}`;
  const values = {
    school: y.setup.school.name,
    student: student.displayName,
    admissionNumber: student.admissionNumber,
    year: y.setup.calendar.year.name,
    issuedOn: cert.issuedOn,
    classSection: `${klass.grade} ${klass.section}`,
  };
  const body = String(
    template?.values.body ??
      "This certifies that {{student}}, admission number {{admissionNumber}}, is recorded at {{school}} for {{year}}.",
  ).replace(
    /\{\{([^{}]+)\}\}/g,
    (_match, key: string) => values[key.trim() as keyof typeof values] ?? "",
  );
  const pub = publicationSchema.parse({
    id: crypto.randomUUID(),
    kind: "certificate",
    sourceId: id,
    ownerType: "student",
    ownerId: student.id,
    version: 1,
    reference,
    title: cert.type,
    issuedBy: a.id,
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: "",
    snapshot: {
      ...values,
      type: cert.type,
      body,
      templateId: template?.id ?? null,
      templateVersion: template?.history.at(-1)?.at ?? null,
      issuer: a.name,
    },
  });
  const transferring = cert.type === "Transfer Certificate";
  return {
    ...y,
    records: {
      ...y.records,
      certificates: y.records.certificates.map((c) =>
        c.id === id ? { ...c, reference } : c,
      ),
      studentProfiles: y.records.studentProfiles.map((p) =>
        p.studentId === cert.studentId && transferring
          ? { ...p, status: "transferred" as const }
          : p,
      ),
    },
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, certificate: serial },
      publications: [...y.workflows.publications, pub],
      studentEvents: [
        ...y.workflows.studentEvents,
        {
          id: crypto.randomUUID(),
          studentId: student.id,
          kind: "document-issued" as const,
          date: cert.issuedOn,
          note: `${cert.type} ${reference}`,
          actorId: a.id,
        },
      ],
    },
  };
}
export function applyCertificateEffects(
  previous: SchoolYearWorkspace,
  next: SchoolYearWorkspace,
  a: AccountIdentity,
) {
  let y = next;
  for (const cert of next.records.certificates.filter(
    (c) =>
      c.status === "issued" &&
      previous.records.certificates.find((o) => o.id === c.id)?.status !==
        "issued",
  ))
    y = publishCertificate(y, a, cert.id);
  return y;
}
