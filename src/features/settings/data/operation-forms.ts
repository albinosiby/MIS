import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "integrations",
    area: "settings",
    title: "Integrations & API configuration",
    description: "Track requested connectors; no credentials are stored here.",
    fields: [
      {
        name: "provider",
        label: "Provider",
        type: "text",
        required: true,
      },
      {
        name: "purpose",
        label: "Purpose",
        type: "textarea",
        required: true,
      },
    ],
    states: ["unconfigured"],
  },
  {
    kind: "webhooks",
    area: "settings",
    title: "Webhook subscriptions",
    description:
      "Prepare HTTPS destination metadata; signing secrets are never shown.",
    fields: [
      {
        name: "url",
        label: "HTTPS endpoint",
        type: "text",
        required: true,
      },
      {
        name: "event",
        label: "Event",
        type: "select",
        required: true,
        options: ["student.created", "invoice.issued", "attendance.saved"],
      },
    ],
    states: ["draft", "paused"],
  },
  {
    kind: "modules",
    area: "settings",
    title: "Module configuration",
    description:
      "Review enablement requests. Configuration is not access permission.",
    fields: [
      {
        name: "module",
        label: "Module",
        type: "text",
        required: true,
      },
      {
        name: "enabled",
        label: "Requested state",
        type: "select",
        required: true,
        options: ["Enabled", "Disabled"],
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
    ],
    states: ["requested", "approved"],
  },
  {
    kind: "billing",
    area: "settings",
    title: "Subscription & usage",
    description:
      "Review plan requests and simulated billing; no provider is connected.",
    fields: [
      {
        name: "plan",
        label: "Plan",
        type: "select",
        required: true,
        options: ["Pilot", "School", "Group"],
      },
      {
        name: "seats",
        label: "Requested seats",
        type: "number",
        required: true,
        min: 1,
        max: 100000,
      },
    ],
    states: ["requested", "reviewed"],
  },
];
