import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "incidents",
    area: "wellbeing",
    title: "Behaviour incidents",
    description: "Review incidents, actions and family follow-up.",
    fields: [
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        options: ["Positive", "Classroom", "Safety", "Attendance", "Other"],
      },
      {
        name: "details",
        label: "Incident details",
        type: "textarea",
        required: true,
      },
      {
        name: "action",
        label: "Action / follow-up",
        type: "textarea",
        required: true,
      },
    ],
    states: ["reported", "reviewed", "resolved"],
    student: true,
  },
  {
    kind: "house-points",
    area: "wellbeing",
    title: "House points & detentions",
    description: "Record reviewed positive points or detention outcomes.",
    fields: [
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: ["Positive points", "Detention"],
      },
      {
        name: "points",
        label: "Points / minutes",
        type: "number",
        required: true,
        min: 1,
        max: 100,
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "approved"],
    student: true,
  },
  {
    kind: "counselling",
    area: "wellbeing",
    title: "Counselling cases",
    description:
      "Restricted interventions and case notes. Synthetic records only.",
    fields: [
      {
        name: "concern",
        label: "Concern",
        type: "textarea",
        required: true,
      },
      {
        name: "intervention",
        label: "Intervention",
        type: "textarea",
        required: true,
      },
      {
        name: "reviewDate",
        label: "Review date",
        type: "date",
        required: true,
      },
    ],
    states: ["open", "review", "closed"],
    student: true,
    staff: true,
    restricted: true,
  },
  {
    kind: "iep",
    area: "wellbeing",
    title: "SEN / IEP plans",
    description: "Restricted learning goals and intervention review.",
    fields: [
      {
        name: "goals",
        label: "Goals",
        type: "textarea",
        required: true,
      },
      {
        name: "adjustments",
        label: "Adjustments",
        type: "textarea",
        required: true,
      },
      {
        name: "reviewDate",
        label: "Review date",
        type: "date",
        required: true,
      },
    ],
    states: ["draft", "active", "reviewed"],
    student: true,
    restricted: true,
  },
  {
    kind: "safeguarding",
    area: "wellbeing",
    title: "Safeguarding cases",
    description:
      "Restricted case review and escalation. No automated eligibility decisions.",
    fields: [
      {
        name: "concern",
        label: "Concern",
        type: "textarea",
        required: true,
      },
      {
        name: "action",
        label: "Action taken",
        type: "textarea",
        required: true,
      },
      {
        name: "reviewDate",
        label: "Review date",
        type: "date",
        required: true,
      },
    ],
    states: ["reported", "review", "escalated", "closed"],
    student: true,
    restricted: true,
  },
];
