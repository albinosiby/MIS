import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "resources",
    area: "learning",
    title: "Learning resources",
    description: "Share resources with a class through approved links.",
    fields: [
      {
        name: "classSectionId",
        label: "Class",
        type: "text",
        required: true,
        relation: "classes",
      },
      {
        name: "url",
        label: "Resource URL",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "live-classes",
    area: "learning",
    title: "Live classes",
    description:
      "Publish external meeting links; no meeting provider is connected.",
    fields: [
      {
        name: "classSectionId",
        label: "Class",
        type: "text",
        required: true,
        relation: "classes",
      },
      {
        name: "url",
        label: "Meeting URL",
        type: "text",
        required: true,
      },
      {
        name: "time",
        label: "Start time (HH:MM)",
        type: "text",
        required: true,
      },
    ],
    states: ["scheduled", "completed"],
    staff: true,
  },
  {
    kind: "quizzes",
    area: "learning",
    title: "Online quizzes",
    description:
      "Publish a single-question formative quiz and review responses.",
    fields: [
      {
        name: "classSectionId",
        label: "Class",
        type: "text",
        required: true,
        relation: "classes",
      },
      {
        name: "question",
        label: "Question",
        type: "textarea",
        required: true,
      },
      {
        name: "answer",
        label: "Expected answer",
        type: "text",
        required: true,
      },
      {
        name: "maxScore",
        label: "Maximum score",
        type: "number",
        required: true,
        min: 1,
        max: 100,
      },
      {
        name: "gradingMode",
        label: "Grading mode",
        type: "select",
        required: true,
        options: ["Manual", "Exact answer"],
      },
      {
        name: "maxAttempts",
        label: "Maximum student attempts",
        type: "number",
        required: true,
        min: 1,
        max: 10,
      },
    ],
    states: ["draft", "published", "closed"],
  },
  {
    kind: "quiz-attempts",
    area: "learning",
    title: "Quiz attempts",
    description: "Submit a response and receive reviewed marks.",
    fields: [
      {
        name: "quizId",
        label: "Quiz",
        type: "text",
        required: true,
        relation: "quizzes",
      },
      {
        name: "response",
        label: "Response",
        type: "textarea",
        required: true,
      },
      {
        name: "score",
        label: "Reviewed score",
        type: "number",
        required: true,
        min: 0,
        max: 100,
      },
    ],
    states: ["submitted", "graded"],
    student: true,
  },
];
