import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "group-policies",
    area: "group",
    title: "Group policy masters",
    description: "Review shared school policy proposals and overrides.",
    fields: [
      {
        name: "scope",
        label: "Policy scope",
        type: "select",
        required: true,
        options: ["Academic", "Finance", "HR", "Communication"],
      },
      {
        name: "policy",
        label: "Policy text",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "approved"],
  },
];
