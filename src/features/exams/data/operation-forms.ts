import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "grading-scales",
    area: "exams",
    title: "Grading scales",
    description: "Version grade boundaries and descriptors.",
    fields: [
      {
        name: "minimum",
        label: "Minimum percent",
        type: "number",
        required: true,
        min: 0,
        max: 100,
      },
      {
        name: "maximum",
        label: "Maximum percent",
        type: "number",
        required: true,
        min: 0,
        max: 100,
      },
      {
        name: "grade",
        label: "Grade",
        type: "text",
        required: true,
      },
      {
        name: "descriptor",
        label: "Descriptor",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "report-templates",
    area: "exams",
    title: "Report-card templates",
    description:
      "Prepare report headings, remarks and layout before publication.",
    fields: [
      {
        name: "heading",
        label: "Heading",
        type: "text",
        required: true,
      },
      {
        name: "layout",
        label: "Layout",
        type: "select",
        required: true,
        options: ["Term summary", "Detailed subjects", "Skills & remarks"],
      },
      {
        name: "footer",
        label: "Footer",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "published"],
  },
  {
    kind: "moderation",
    area: "exams",
    title: "Marks moderation",
    description:
      "Review a scoped student examination outcome before publishing.",
    fields: [
      {
        name: "examId",
        label: "Exam cycle",
        type: "text",
        required: true,
        relation: "exams",
      },
      {
        name: "subjectId",
        label: "Subject",
        type: "text",
        required: true,
        relation: "subjects",
      },
      {
        name: "remark",
        label: "Review note",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "submitted", "approved", "completed"],
    student: true,
    staff: true,
  },
  {
    kind: "seating",
    area: "exams",
    title: "Exam seating",
    description: "Allocate a student to a hall and seat for an examination.",
    fields: [
      {
        name: "examId",
        label: "Exam cycle",
        type: "text",
        required: true,
        relation: "exams",
      },
      {
        name: "room",
        label: "Hall",
        type: "text",
        required: true,
      },
      {
        name: "seat",
        label: "Seat number",
        type: "text",
        required: true,
      },
    ],
    states: ["draft", "published"],
    student: true,
  },
  {
    kind: "re-evaluations",
    area: "exams",
    title: "Re-evaluation requests",
    description:
      "Student or guardian requests a review; exam staff record the decision.",
    fields: [
      {
        name: "examId",
        label: "Exam cycle",
        type: "text",
        required: true,
        relation: "exams",
      },
      {
        name: "subjectId",
        label: "Subject",
        type: "text",
        required: true,
        relation: "subjects",
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
      {
        name: "decision",
        label: "Decision / review note",
        type: "textarea",
        required: true,
      },
    ],
    states: ["draft", "submitted", "approved", "completed"],
    student: true,
  },
];
