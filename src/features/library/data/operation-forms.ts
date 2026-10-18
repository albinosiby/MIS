import type { ModuleDefinition } from "../../operations/models/definitions.ts";
export const forms: ModuleDefinition[] = [
  {
    kind: "books",
    area: "library",
    title: "Book catalogue",
    description: "Catalogue titles; each physical copy is recorded separately.",
    fields: [
      {
        name: "isbn",
        label: "ISBN / catalogue reference",
        type: "text",
        required: true,
      },
      {
        name: "author",
        label: "Author",
        type: "text",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        type: "text",
        required: true,
      },
    ],
    states: ["active", "archived"],
  },
  {
    kind: "copies",
    area: "library",
    title: "Book copies",
    description: "Track physical copies and barcode references.",
    fields: [
      {
        name: "bookId",
        label: "Book title",
        type: "text",
        required: true,
        relation: "books",
      },
      {
        name: "barcode",
        label: "Barcode",
        type: "text",
        required: true,
      },
      {
        name: "shelf",
        label: "Shelf",
        type: "text",
        required: true,
      },
    ],
    states: ["available", "lost", "retired"],
  },
  {
    kind: "loans",
    area: "library",
    title: "Circulation desk",
    description:
      "Issue an available copy, renew its due date and record return.",
    fields: [
      {
        name: "copyId",
        label: "Book copy",
        type: "text",
        required: true,
        relation: "copies",
      },
      {
        name: "dueDate",
        label: "Due date",
        type: "date",
        required: true,
      },
    ],
    states: ["issued", "returned"],
    student: true,
  },
  {
    kind: "reservations",
    area: "library",
    title: "Book reservations",
    description: "Queue requests against catalogue titles.",
    fields: [
      {
        name: "bookId",
        label: "Book title",
        type: "text",
        required: true,
        relation: "books",
      },
    ],
    states: ["requested", "ready", "collected"],
    student: true,
  },
  {
    kind: "library-fines",
    area: "library",
    title: "Library fines",
    description: "Review overdue or damage fines without charging a gateway.",
    fields: [
      {
        name: "loanId",
        label: "Loan",
        type: "text",
        required: true,
        relation: "loans",
      },
      {
        name: "amountMinor",
        label: "Fine in minor units",
        type: "number",
        required: true,
        min: 1,
        max: 100000000,
      },
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
      },
    ],
    states: ["outstanding", "settled"],
    student: true,
  },
];
