export const reportColumns = {
  students: ["id", "admissionNumber", "displayName", "classSectionId"],
  attendance: ["personType", "personId", "date", "status", "note"],
  fees: [
    "reference",
    "studentId",
    "issuedOn",
    "dueDate",
    "amountMinor",
    "concessionMinor",
    "status",
  ],
  marks: ["studentId", "examId", "subjectId", "marks", "remark"],
  staff: ["id", "displayName", "designation"],
  admissions: ["id", "studentName", "stage"],
  ledger: ["reference", "date", "memo", "debitMinor", "creditMinor"],
  payroll: ["period", "status", "staffId", "grossMinor", "netMinor"],
} as const;
