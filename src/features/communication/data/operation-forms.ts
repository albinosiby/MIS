import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "message-templates",
    area: "communication",
    title: "Message templates",
    description:
      "Reusable channel-specific messages without provider credentials.",
    fields: [
      {
        name: "channel",
        label: "Channel",
        type: "select",
        required: true,
        options: ["In-app", "Email", "SMS", "WhatsApp"],
      },
      {
        name: "body",
        label: "Message body",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "messages",
    area: "communication",
    title: "Messages",
    description: "School-to-family messages scoped to a linked student.",
    fields: [
      {
        name: "body",
        label: "Message",
        type: "textarea",
        required: true,
      },
      {
        name: "recipientRole",
        label: "Recipient",
        type: "select",
        required: true,
        options: ["teacher", "parent", "student", "staff"],
      },
    ],
    states: ["sent", "read"],
    student: true,
    staff: true,
  },
  {
    kind: "deliveries",
    area: "communication",
    title: "Delivery log",
    description:
      "Inspect local provider simulations and retry states; no external delivery occurs.",
    fields: [
      {
        name: "channel",
        label: "Channel",
        type: "select",
        required: true,
        options: ["Email", "SMS", "WhatsApp", "Push"],
      },
      {
        name: "recipient",
        label: "recipient",
        type: "text",
        required: true,
      },
      {
        name: "body",
        label: "Message",
        type: "textarea",
        required: true,
      },
    ],
    states: ["queued", "simulated-delivery", "failed"],
  },
  {
    kind: "ptm",
    area: "communication",
    title: "Parent\u2013teacher meetings",
    description:
      "Offer and book meeting slots with linked student and teacher.",
    fields: [
      {
        name: "meetingDate",
        label: "Meeting date",
        type: "date",
        required: true,
      },
      {
        name: "time",
        label: "Start time (HH:MM)",
        type: "text",
        required: true,
      },
      {
        name: "minutes",
        label: "Duration in minutes",
        type: "number",
        required: true,
        min: 5,
        max: 60,
      },
    ],
    states: ["available", "booked", "completed"],
    student: true,
    staff: true,
  },
  {
    kind: "surveys",
    area: "communication",
    title: "Surveys & polls",
    description: "Draft a question and review responses.",
    fields: [
      {
        name: "question",
        label: "Question",
        type: "textarea",
        required: true,
      },
      {
        name: "response",
        label: "Response",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "open", "closed"],
    student: true,
  },
  {
    kind: "consents",
    area: "communication",
    title: "Consent requests",
    description: "Record guardian review of a school activity request.",
    fields: [
      {
        name: "purpose",
        label: "Consent purpose",
        type: "textarea",
        required: true,
      },
      {
        name: "response",
        label: "Response",
        type: "select",
        required: true,
        options: ["Pending", "Granted", "Declined"],
      },
    ],
    states: ["requested", "responded"],
    student: true,
  },
];
