import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { roleSchema } from "../../identity/schemas/identity.schema.ts";
export const customFieldSchema = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    label: z.string().trim().min(2).max(100),
    entity: z.enum(["student", "staff", "admission"]),
    type: z.enum(["text", "number", "date", "choice", "boolean"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    readRoles: z.array(roleSchema).min(1).max(15),
  })
  .refine((v) => v.type !== "choice" || v.options.length > 0, {
    message: "Choice fields require options.",
  });
export const approvalPolicySchema = z.strictObject({
  id: identifierSchema,
  name: z.string().trim().min(2).max(100),
  kind: z.enum([
    "purchase-orders",
    "expenses",
    "outpasses",
    "training",
    "refunds",
    "payment-plans",
    "contracts",
    "moderation",
    "publication",
    "leave",
  ]),
  roles: z.array(roleSchema).min(1).max(5),
  slaHours: z.number().int().min(1).max(720),
  enabled: z.boolean(),
});
export const advancedSettingsSchema = z
  .strictObject({
    curricula: z
      .array(z.enum(["CBSE", "ICSE", "State", "IB", "IGCSE"]))
      .min(1)
      .max(5)
      .default(["CBSE"]),
    locale: z.enum(["en-IN", "hi-IN"]).default("en-IN"),
    timezone: z.string().max(80).default("Asia/Kolkata"),
    customFields: z.array(customFieldSchema).max(100).default([]),
    approvalPolicies: z.array(approvalPolicySchema).max(30).default([]),
    absenceEscalationDays: z.number().int().min(1).max(30).default(3),
    instructionalWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .default([1, 2, 3, 4, 5, 6]),
    examEligibilityEnforced: z.boolean().default(false),
    examEligibilityPercent: z.number().min(0).max(100).default(75),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.instructionalWeekdays).size !== v.instructionalWeekdays.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["instructionalWeekdays"],
        message: "Choose unique weekdays.",
      });
    if (
      new Set(v.approvalPolicies.filter((p) => p.enabled).map((p) => p.kind))
        .size !== v.approvalPolicies.filter((p) => p.enabled).length
    )
      ctx.addIssue({
        code: "custom",
        path: ["approvalPolicies"],
        message: "Use one enabled approval policy per workflow.",
      });
    for (const name of ["customFields", "approvalPolicies"] as const) {
      const keys = v[name].map((r) =>
        "key" in r ? `${r.entity}:${r.key}` : r.id,
      );
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "Definitions must be unique.",
        });
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone }).format(
        new Date(),
      );
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["timezone"],
        message: "Use a valid timezone.",
      });
    }
  });
export const customValuesSchema = z.strictObject({
  entity: z.enum(["student", "staff", "admission"]),
  ownerId: identifierSchema,
  values: z.record(
    z.string(),
    z.union([z.string().max(1000), z.number().finite(), z.boolean()]),
  ),
});
export const workflowApprovalSchema = z.strictObject({
  id: identifierSchema,
  policyId: identifierSchema,
  targetId: identifierSchema,
  kind: approvalPolicySchema.shape.kind,
  requestedBy: identifierSchema,
  createdAt: z.iso.datetime(),
  status: z.enum(["pending", "approved", "rejected"]),
  roles: z.array(roleSchema).min(1).max(5),
  decisions: z
    .array(
      z.strictObject({
        role: roleSchema,
        actorId: identifierSchema,
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().min(8).max(500),
        at: z.iso.datetime(),
      }),
    )
    .max(5),
});
