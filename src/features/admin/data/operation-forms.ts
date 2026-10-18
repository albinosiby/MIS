import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "support-tickets",
    area: "platform",
    title: "Support tickets",
    description:
      "Review support requests and time-limited school access requests.",
    fields: [
      {
        name: "requester",
        label: "Requester",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Issue",
        type: "textarea",
        required: true,
      },
    ],
    states: ["open", "in-progress", "resolved"],
  },
  {
    kind: "tenant-requests",
    area: "platform",
    title: "School provisioning",
    description:
      "Review proposed schools before a future live provisioning operation.",
    fields: [
      {
        name: "schoolName",
        label: "School name",
        type: "text",
        required: true,
      },
      {
        name: "country",
        label: "Country",
        type: "text",
        required: true,
      },
      {
        name: "email",
        label: "Administrator email",
        type: "text",
        required: true,
      },
    ],
    states: ["requested", "reviewed", "approved"],
  },
  {
    kind: "plans",
    area: "platform",
    title: "Plans & feature flags",
    description: "Manage plan descriptions and capacity limits.",
    fields: [
      {
        name: "priceMinor",
        label: "Monthly amount in minor units",
        type: "number",
        required: true,
        min: 0,
        max: 100000000,
      },
      {
        name: "studentLimit",
        label: "Student limit",
        type: "number",
        required: true,
        min: 1,
        max: 100000,
      },
      {
        name: "features",
        label: "Included modules",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "support-grants",
    area: "platform",
    title: "Support access requests",
    description:
      "Review a scoped support request. approval never creates live impersonation.",
    fields: [
      {
        name: "schoolName",
        label: "School",
        type: "text",
        required: true,
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
      {
        name: "minutes",
        label: "Requested duration",
        type: "number",
        required: true,
        min: 5,
        max: 60,
      },
    ],
    states: ["requested", "approved", "expired"],
  },
];
