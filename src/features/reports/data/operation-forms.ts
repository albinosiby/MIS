import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "saved-reports",
    area: "reports",
    title: "Report builder & saved views",
    description:
      "Save bounded module reporting selections; preview current linked records.",
    fields: [
      {
        name: "source",
        label: "Data source",
        type: "select",
        required: true,
        options: ["Students", "Attendance", "Invoices", "Staff"],
      },
      {
        name: "filter",
        label: "Filter text",
        type: "text",
        required: true,
      },
      {
        name: "columns",
        label: "Requested columns",
        type: "text",
        required: true,
      },
    ],
    states: ["draft", "saved"],
  },
  {
    kind: "statutory",
    area: "reports",
    title: "Statutory export requests",
    description:
      "Prepare export requests. No certified country-pack connection is configured.",
    fields: [
      {
        name: "pack",
        label: "Pack",
        type: "select",
        required: true,
        options: ["UDISE+", "CBSE", "Other"],
      },
      {
        name: "period",
        label: "Reporting period",
        type: "text",
        required: true,
      },
      {
        name: "note",
        label: "Required format / sample",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "reviewed"],
  },
];
