import { definition } from "../../operations/data/module-definitions.ts";
import type { AccountIdentity } from "../models/index.ts";
import type { z } from "zod";
import type { mutationCapabilitySchema } from "../schemas/mutation-policy.schema.ts";
import type { cloudCommandSchema } from "../../cloud/schemas/cloud.schema.ts";
export function assertMutationPermission(
  a: AccountIdentity,
  capability: z.infer<typeof mutationCapabilitySchema>,
) {
  if (a.blockedMutations?.includes(capability))
    throw new Error(
      "Your school has restricted this action for the selected role.",
    );
}
export function commandCapability(
  c: z.infer<typeof cloudCommandSchema>,
): z.infer<typeof mutationCapabilitySchema> {
  if (
    ["admission-save", "admission-progress", "student-enrol"].includes(c.type)
  )
    return "operations";
  if (c.type === "year-rollover") return "configuration";
  if (c.type.startsWith("billing-")) return "billing";
  if (c.type.startsWith("hr-") || c.type.startsWith("staff-"))
    return "employment";
  if (c.type === "attendance-save") return "attendance";
  if (c.type === "operation-save") {
    const area = definition(c.input.kind).area;
    return area === "fees"
      ? "billing"
      : area === "hr"
        ? "employment"
        : area === "learning"
          ? "teaching"
          : area === "communication"
            ? "communication"
            : area === "reports"
              ? "publications"
              : area === "settings"
                ? "configuration"
                : "operations";
  }
  if (["operation-respond", "loan-renew"].includes(c.type)) return "operations";
  if (c.type === "leave") return "attendance";
  if (c.type === "notice-ack") return "communication";
  if (c.type === "workflow") {
    if (c.input.action.startsWith("admission-")) return "operations";
    if (c.input.action.startsWith("result-")) return "publications";
    if (
      [
        "late-fee-rules",
        "late-fee-assess",
        "ledger-statement",
        "bank-import",
        "bank-match",
        "bank-close",
        "bank-unmatch",
        "bank-void",
        "service-charge",
        "library-fine-bill",
      ].includes(c.input.action)
    )
      return "billing";
    if (
      [
        "payroll-policy",
        "salary-plan",
        "payroll-prepare",
        "payroll-progress",
        "employment",
      ].includes(c.input.action)
    )
      return "employment";
    if (
      [
        "certificate-bulk",
        "certificate-publish",
        "results-publish",
        "transcript-publish",
        "publication-revoke",
        "report-publish",
        "report-builder",
        "report-schedule",
      ].includes(c.input.action)
    )
      return "publications";
    if (["quiz-grade", "learning-progress"].includes(c.input.action))
      return "teaching";
    return "configuration";
  }
  return "teaching";
}
