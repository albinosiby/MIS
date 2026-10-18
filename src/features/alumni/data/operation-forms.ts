import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "alumni",
    area: "alumni",
    title: "Alumni & transcript requests",
    description: "Review former-student events and document requests.",
    fields: [
      {
        name: "email",
        label: "Contact email",
        type: "text",
        required: true,
      },
      {
        name: "graduationYear",
        label: "Graduation year",
        type: "number",
        required: true,
        min: 1950,
        max: 2100,
      },
      {
        name: "request",
        label: "Request",
        type: "textarea",
        required: true,
      },
    ],
    states: ["requested", "reviewed", "completed"],
  },
];
