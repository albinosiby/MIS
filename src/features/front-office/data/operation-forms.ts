import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "visitors",
    area: "front-office",
    title: "Visitor desk",
    description:
      "Record arrival, host and departure; no identity verification is implied.",
    fields: [
      {
        name: "visitor",
        label: "Visitor name",
        type: "text",
        required: true,
      },
      {
        name: "host",
        label: "Host / department",
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
    states: ["checked-in", "checked-out"],
  },
  {
    kind: "gate-passes",
    area: "front-office",
    title: "Gate passes",
    description: "Review student pickup requests and departure status.",
    fields: [
      {
        name: "collector",
        label: "Collector name",
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
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
    ],
    states: ["requested", "approved", "used"],
    student: true,
  },
  {
    kind: "appointments",
    area: "front-office",
    title: "Office appointments",
    description: "Track school appointments and call follow-up.",
    fields: [
      {
        name: "contact",
        label: "Contact name",
        type: "text",
        required: true,
      },
      {
        name: "time",
        label: "Time (HH:MM)",
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
    states: ["requested", "confirmed", "completed"],
  },
];
