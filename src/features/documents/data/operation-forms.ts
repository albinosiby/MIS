import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "document-requests",
    area: "documents",
    title: "Document requests",
    description: "Request and review a student certificate or document.",
    fields: [
      {
        name: "type",
        label: "Document type",
        type: "select",
        required: true,
        options: [
          "Bona fide",
          "Transfer certificate",
          "Fee certificate",
          "Transcript",
          "Other",
        ],
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
    ],
    states: ["requested", "approved", "issued"],
    student: true,
  },
  {
    kind: "document-register",
    area: "documents",
    title: "Document review register",
    description:
      "Review legacy document records. Upload actual files in the private file register.",
    fields: [
      {
        name: "filename",
        label: "File name",
        type: "text",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: ["Identity", "Academic", "Consent", "Other"],
      },
      {
        name: "review",
        label: "Review note",
        type: "textarea",
        required: true,
      },
    ],
    states: ["pending", "verified", "rejected"],
    student: true,
  },
  {
    kind: "certificate-templates",
    area: "documents",
    title: "Certificate templates",
    description: "Prepare serial prefixes and certificate wording.",
    fields: [
      {
        name: "prefix",
        label: "Serial prefix",
        type: "text",
        required: true,
      },
      {
        name: "body",
        label: "Certificate text",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
];
