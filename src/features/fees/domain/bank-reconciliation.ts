import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  bankImportSchema,
  bankMatchSchema,
  bankCloseSchema,
  bankStatementSchema,
  serviceChargeSchema,
  bankUnmatchSchema,
  bankVoidSchema,
  bankFineSchema,
} from "../schemas/bank-reconciliation.schema.ts";
import {
  operationalDate,
  activeStudent,
} from "../../operations/domain/workflow-context.ts";
import { scope } from "../../workspace/domain/operations.ts";
import { invoiceSchema } from "../schemas/fees.schema.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal", "accountant"].includes(a.role)
  )
    throw new Error("Finance permission required.");
}
export function importBankStatement(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = bankImportSchema.parse(input);
  operationalDate(y, r.from);
  operationalDate(y, r.to);
  if (
    y.workflows.bankStatements.some(
      (s) => !s.voidedAt && s.account.toLowerCase() !== r.account.toLowerCase(),
    )
  )
    throw new Error(
      "This workspace uses one school Bank ledger. Use its existing bank account label.",
    );
  const prior = y.workflows.bankStatements.filter(
    (s) => !s.voidedAt && s.account.toLowerCase() === r.account.toLowerCase(),
  );
  if (prior.some((s) => s.from <= r.to && r.from <= s.to))
    throw new Error("A statement already covers these dates for this account.");
  if (
    prior.some((s) =>
      s.lines.some((l) =>
        r.lines.some(
          (n) => n.reference.toLowerCase() === l.reference.toLowerCase(),
        ),
      ),
    )
  )
    throw new Error(
      "A bank reference has already been imported for this account.",
    );
  const earlier = prior
      .filter((s) => s.to < r.from)
      .sort((a, b) => b.to.localeCompare(a.to))[0],
    later = prior
      .filter((s) => s.from > r.to)
      .sort((a, b) => a.from.localeCompare(b.from))[0];
  const adjacent = (a: string, b: string) =>
    Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z") === 86400000;
  if (
    (earlier &&
      adjacent(earlier.to, r.from) &&
      earlier.closingMinor !== r.openingMinor) ||
    (later &&
      adjacent(r.to, later.from) &&
      later.openingMinor !== r.closingMinor)
  )
    throw new Error(
      "Statement balances must continue the adjoining imported statements.",
    );
  const statement = bankStatementSchema.parse({
    ...r,
    id: crypto.randomUUID(),
    lines: r.lines.map((l) => ({ ...l, id: crypto.randomUUID() })),
    importedBy: a.id,
    importedAt: new Date().toISOString(),
    matches: [],
    closedBy: null,
    closedAt: null,
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      bankStatements: [...y.workflows.bankStatements, statement],
    },
  };
}
export function matchBankLine(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = bankMatchSchema.parse(input),
    statement = y.workflows.bankStatements.find((s) => s.id === r.statementId),
    line = statement?.lines.find((l) => l.id === r.lineId),
    journal = y.workflows.ledger.find((j) => j.id === r.journalId);
  if (
    !statement ||
    statement.closedAt ||
    statement.voidedAt ||
    !line ||
    !journal
  )
    throw new Error("Choose an open statement line and posted journal.");
  const movement = journal.lines
    .filter((l) => l.account === "Bank")
    .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0);
  if (movement !== line.amountMinor || journal.date !== line.date)
    throw new Error(
      "Bank journal date and signed amount must exactly match the statement line.",
    );
  if (
    statement.matches.some((m) => !m.voidedAt && m.lineId === line.id) ||
    y.workflows.bankStatements.some((s) =>
      s.matches.some((m) => !m.voidedAt && m.journalId === journal.id),
    )
  )
    throw new Error("This line or journal is already matched.");
  return {
    ...y,
    workflows: {
      ...y.workflows,
      bankStatements: y.workflows.bankStatements.map((s) =>
        s.id === statement.id
          ? {
              ...s,
              matches: [
                ...s.matches,
                {
                  lineId: line.id,
                  journalId: journal.id,
                  matchedBy: a.id,
                  matchedAt: new Date().toISOString(),
                  voidedAt: null,
                  voidedBy: null,
                  voidReason: "",
                },
              ],
            }
          : s,
      ),
    },
  };
}
export function closeBankStatement(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = bankCloseSchema.parse(input),
    s = y.workflows.bankStatements.find((s) => s.id === r.statementId);
  if (
    !s ||
    s.closedAt ||
    s.voidedAt ||
    s.matches.filter((m) => !m.voidedAt).length !== s.lines.length
  )
    throw new Error(
      "Match every line of an open statement before reconciliation.",
    );
  if (
    y.workflows.ledger.some(
      (j) =>
        j.date >= s.from &&
        j.date <= s.to &&
        j.lines.some((l) => l.account === "Bank") &&
        !s.matches.some((m) => !m.voidedAt && m.journalId === j.id),
    )
  )
    throw new Error(
      "There are unmatched bank ledger movements in this statement period.",
    );
  const bookOpening = y.workflows.ledger
    .filter((j) => j.date < s.from)
    .flatMap((j) => j.lines)
    .filter((l) => l.account === "Bank")
    .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0);
  if (bookOpening !== s.openingMinor)
    throw new Error(
      "Statement opening balance differs from the Bank ledger. Post and review the missing opening or correcting journal first.",
    );
  if (
    s.importedBy === a.id ||
    s.matches.some((m) => !m.voidedAt && m.matchedBy === a.id)
  )
    throw new Error(
      "A separate finance reviewer must reconcile this statement.",
    );
  return {
    ...y,
    workflows: {
      ...y.workflows,
      bankStatements: y.workflows.bankStatements.map((v) =>
        v.id === s.id
          ? { ...v, closedBy: a.id, closedAt: new Date().toISOString() }
          : v,
      ),
    },
  };
}
export function issueServiceCharge(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = serviceChargeSchema.parse(input),
    allocation = y.extensions.find(
      (v) =>
        v.id === r.allocationId &&
        ["hostel-allocations", "transport-allocations"].includes(v.kind) &&
        v.status === "active",
    );
  if (!allocation)
    throw new Error("Choose an active hostel or transport allocation.");
  activeStudent(y, allocation.studentId);
  operationalDate(y, r.issuedOn);
  operationalDate(y, r.dueDate);
  const first = `${r.month}-01`,
    last = new Date(
      Date.UTC(Number(r.month.slice(0, 4)), Number(r.month.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10);
  if (
    String(allocation.values.startDate) > last ||
    String(allocation.values.endDate) < first
  )
    throw new Error("The charge month must overlap the allocation.");
  const reference = `SVC-${allocation.id}-${r.month}`;
  if (y.records.invoices.some((i) => i.reference === reference))
    throw new Error("This allocation has already been charged for that month.");
  const invoice = invoiceSchema.parse({
    ...scope(y),
    id: crypto.randomUUID(),
    reference,
    studentId: allocation.studentId,
    period: `${allocation.kind === "hostel-allocations" ? "Hostel" : "Transport"} ${r.month}`,
    issuedOn: r.issuedOn,
    dueDate: r.dueDate,
    lines: [
      {
        id: crypto.randomUUID(),
        name: allocation.title,
        amountMinor: r.amountMinor,
      },
    ],
    concessionMinor: 0,
    status: "issued",
  });
  return {
    ...y,
    records: { ...y.records, invoices: [...y.records.invoices, invoice] },
  };
}

export function unmatchBankLine(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = bankUnmatchSchema.parse(input),
    s = y.workflows.bankStatements.find((s) => s.id === r.statementId);
  if (
    !s ||
    s.closedAt ||
    s.voidedAt ||
    !s.matches.some((m) => !m.voidedAt && m.lineId === r.lineId)
  )
    throw new Error(
      "Only an active match on an open statement can be corrected.",
    );
  return {
    ...y,
    workflows: {
      ...y.workflows,
      bankStatements: y.workflows.bankStatements.map((v) =>
        v.id === s.id
          ? {
              ...v,
              matches: v.matches.map((m) =>
                !m.voidedAt && m.lineId === r.lineId
                  ? {
                      ...m,
                      voidedAt: new Date().toISOString(),
                      voidedBy: a.id,
                      voidReason: r.reason,
                    }
                  : m,
              ),
            }
          : v,
      ),
    },
  };
}
export function voidBankStatement(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = bankVoidSchema.parse(input),
    s = y.workflows.bankStatements.find((s) => s.id === r.statementId);
  if (!s || s.closedAt || s.voidedAt || s.matches.some((m) => !m.voidedAt))
    throw new Error(
      "Correct all active matches before voiding an open statement.",
    );
  return {
    ...y,
    workflows: {
      ...y.workflows,
      bankStatements: y.workflows.bankStatements.map((v) =>
        v.id === s.id
          ? {
              ...v,
              voidedAt: new Date().toISOString(),
              voidedBy: a.id,
              voidReason: r.reason,
            }
          : v,
      ),
    },
  };
}
/** Explicitly connect a historical fine that predates linked invoicing. */
export function billLibraryFine(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const { id } = bankFineSchema.parse(input),
    fine = y.extensions.find(
      (r) =>
        r.id === id && r.kind === "library-fines" && r.status === "outstanding",
    );
  if (!fine) throw new Error("Choose an outstanding library fine.");
  if (y.records.invoices.some((i) => i.period === `Library fine ${fine.id}`))
    throw new Error("This fine already has a linked invoice.");
  const invoice = invoiceSchema.parse({
    ...scope(y),
    id: crypto.randomUUID(),
    studentId: fine.studentId,
    reference: `LIB-${fine.id.slice(0, 100)}`,
    period: `Library fine ${fine.id}`,
    issuedOn: fine.date,
    dueDate: fine.date,
    lines: [
      {
        id: crypto.randomUUID(),
        name: fine.title,
        amountMinor: Number(fine.values.amountMinor),
      },
    ],
    concessionMinor: 0,
    status: "issued",
  });
  return {
    ...y,
    records: { ...y.records, invoices: [...y.records.invoices, invoice] },
  };
}
