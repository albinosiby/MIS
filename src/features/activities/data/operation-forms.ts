import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "clubs",
    area: "activities",
    title: "Clubs & teams",
    description: "Manage activity capacity and faculty lead.",
    fields: [
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: ["Sport", "Arts", "Science", "Service"],
      },
      {
        name: "capacity",
        label: "Capacity",
        type: "number",
        required: true,
        min: 1,
        max: 500,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "open", "closed"],
    staff: true,
  },
  {
    kind: "activity-enrolments",
    area: "activities",
    title: "Activity enrolment",
    description: "Register students within club capacity.",
    fields: [
      {
        name: "clubId",
        label: "Club / team",
        type: "text",
        required: true,
        relation: "clubs",
      },
    ],
    states: ["requested", "approved", "completed"],
    student: true,
  },
  {
    kind: "trips-events",
    area: "activities",
    title: "Events & trips",
    description: "Review destination, capacity and activity charges.",
    fields: [
      {
        name: "destination",
        label: "Location",
        type: "text",
        required: true,
      },
      {
        name: "capacity",
        label: "Capacity",
        type: "number",
        required: true,
        min: 1,
        max: 2000,
      },
      {
        name: "amountMinor",
        label: "Optional charge in minor units",
        type: "number",
        required: true,
        min: 0,
        max: 100000000,
      },
    ],
    states: ["draft", "open", "completed"],
  },
  {
    kind: "achievements",
    area: "activities",
    title: "Achievements",
    description: "Record student participation and recognised outcomes.",
    fields: [
      {
        name: "category",
        label: "Category",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Achievement",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "verified"],
    student: true,
  },
];
