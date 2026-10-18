import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "clinic",
    area: "health",
    title: "Clinic visits",
    description: "Record synthetic clinic visits and permitted follow-up.",
    fields: [
      {
        name: "complaint",
        label: "Presenting complaint",
        type: "textarea",
        required: true,
      },
      {
        name: "care",
        label: "Care provided",
        type: "textarea",
        required: true,
      },
      {
        name: "guardianNotified",
        label: "Guardian notified",
        type: "select",
        required: true,
        options: ["Pending", "Yes", "Not required"],
      },
    ],
    states: ["open", "reviewed", "closed"],
    student: true,
    restricted: true,
  },
  {
    kind: "medication",
    area: "health",
    title: "Medication log",
    description:
      "Record authorised medication administration without clinical recommendations.",
    fields: [
      {
        name: "medication",
        label: "Medication / existing instruction",
        type: "text",
        required: true,
      },
      {
        name: "authorisation",
        label: "Authorisation reference",
        type: "text",
        required: true,
      },
      {
        name: "administration",
        label: "Administration note",
        type: "textarea",
        required: true,
      },
    ],
    states: ["scheduled", "administered", "missed"],
    student: true,
    restricted: true,
  },
  {
    kind: "immunisations",
    area: "health",
    title: "Immunisations & checks",
    description:
      "Store reviewed health-check metadata from authorised sources.",
    fields: [
      {
        name: "recordType",
        label: "Record type",
        type: "select",
        required: true,
        options: ["Immunisation", "Health check"],
      },
      {
        name: "provider",
        label: "Provider",
        type: "text",
        required: true,
      },
      {
        name: "note",
        label: "Source / outcome",
        type: "textarea",
        required: true,
      },
    ],
    states: ["pending", "verified"],
    student: true,
    restricted: true,
  },
];
