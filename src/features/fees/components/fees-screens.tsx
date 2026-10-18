"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  studentOptions,
  labelFor,
  newRecord,
  money,
  enumOptions,
  type FormField,
  printSection,
} from "../../workspace/components/workspace-ui";
import {
  scope,
  balance,
  takePayment,
  putRecord,
} from "../../workspace/domain/operations";
import { generateInvoices } from "../domain/generate-invoices";
import { readableError } from "../../school-setup/components/form-errors";
export default function FeesScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]),
    [invoiceId, setInvoiceId] = useState(
      query.invoice ?? y.records.invoices[0]?.id ?? "",
    ),
    [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState("");
  const students = studentOptions(y),
    date = academicReferenceDate(y.setup.calendar.year, "10-14");
  const rows = y.records.invoices.filter((i) =>
    `${i.reference} ${labelFor(students, i.studentId)} ${i.period}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const invoice = y.records.invoices.find((i) => i.id === invoiceId);
  const total = y.records.invoices
      .filter((i) => i.status === "issued")
      .reduce(
        (s, i) =>
          s +
          i.lines.reduce((n, l) => n + l.amountMinor, 0) -
          i.concessionMinor,
        0,
      ),
    collected = y.records.payments
      .filter((p) => p.status === "completed")
      .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0);
  async function act(work: () => Promise<void>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  function generate() {
    setEditor(
      <Dialog title="Generate fee invoices" onClose={() => setEditor(null)}>
        <DataForm
          initial={{
            ...scope(y),
            studentIds: y.setup.students.slice(0, 10).map((s) => s.id),
            feeHeadIds: y.setup.fees.map((f) => f.id),
            period: "Quarter 3",
            issuedOn: date,
            dueDate:
              y.setup.calendar.terms.find((t) => t.endDate >= date)?.endDate ??
              y.setup.calendar.year.endDate,
            concessionPercent: y.setup.concessionPercent,
          }}
          fields={[
            { name: "period", label: "Billing period / installment" },
            {
              name: "studentIds",
              label: "Students",
              type: "multi",
              options: students,
            },
            {
              name: "feeHeadIds",
              label: "Fee heads",
              type: "multi",
              options: y.setup.fees.map((f) => ({
                value: f.id,
                label: `${f.name} · ${money(y, f.amountMinor)}`,
              })),
            },
            { name: "issuedOn", label: "Issue date", type: "date" },
            { name: "dueDate", label: "Due date", type: "date" },
            {
              name: "concessionPercent",
              label: "Concession (%)",
              type: "number",
            },
          ]}
          submitLabel="Generate invoices"
          onSave={async (value) => {
            await mutate(
              (current) => generateInvoices(current, value),
              "Generated fee invoices",
              { type: "billing-generate", input: value },
            );
            setEditor(null);
          }}
        />
      </Dialog>,
    );
  }
  function receipt(paymentId: string) {
    const payment = y.records.payments.find((p) => p.id === paymentId)!;
    const invoice = y.records.invoices.find((i) => i.id === payment.invoiceId)!;
    setEditor(
      <Dialog
        title={`Receipt ${payment.reference}`}
        onClose={() => setEditor(null)}
      >
        <article className="ws-letterhead" id="receipt-print">
          <h3>{y.setup.school.name}</h3>
          <p>SIMULATED PAYMENT RECEIPT</p>
          <p>
            Receipt: {payment.reference}
            <br />
            Invoice: {invoice.reference}
            <br />
            Student: {labelFor(students, invoice.studentId)}
            <br />
            Date: {payment.paidOn}
          </p>
          <h3>{money(y, payment.amountMinor)}</h3>
          <p>
            Method: {payment.method}
            <br />
            Status: {payment.status}
            <br />
            Refunded: {money(y,payment.refundedMinor)}<br/>
            Remaining invoice balance: {money(y, balance(y, invoice.id))}
          </p>
          <p>Recorded school collection.</p>
        </article>
        <Button variant="outline" onClick={() => printSection("receipt-print")}>
          Print receipt / Save PDF
        </Button>
      </Dialog>,
    );
  }
  if (route === "/fees/collect")
    return (
      <>
        <div className="ws-filter-bar">
          <Select
            aria-label="Payment invoice"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            {y.records.invoices
              .filter((i) => i.status === "issued")
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.reference} · {labelFor(students, i.studentId)} ·{" "}
                  {money(y, balance(y, i.id))}
                </option>
              ))}
          </Select>
          <LinkButton href="/fees">← Fee dashboard</LinkButton>
        </div>
        {invoice ? (
          <div className="ws-two-column">
            <Panel title="Front-desk collection · Simulated">
              <DataForm
                key={invoice.id + y.setup.revision}
                initial={{
                  ...newRecord(y),
                  invoiceId: invoice.id,
                  amountMinor: balance(y, invoice.id),
                  paidOn: date,
                  method: "Cash",
                  reference: `RCPT-${Date.now()}`,
                  idempotencyKey: crypto.randomUUID(),
                  status: "completed",
                  note: "",
                }}
                fields={[
                  {
                    name: "amountMinor",
                    label: "Amount collected",
                    type: "number",
                    factor: 100,
                  },
                  { name: "paidOn", label: "Payment date", type: "date" },
                  {
                    name: "method",
                    label: "Payment method",
                    type: "select",
                    options: enumOptions([
                      "Cash",
                      "UPI",
                      "Card",
                      "Bank transfer",
                    ]),
                  },
                  {
                    name: "reference",
                    label: "Receipt / transaction reference",
                  },
                  { name: "note", label: "Collection note", type: "textarea" },
                ]}
                submitLabel="Record payment entry"
                onSave={async (value) => {
                  await mutate(
                    (current) => takePayment(current, value),
                    "Recorded fee entry",
                    { type: "billing-collect", input: value },
                  );
                }}
              />
            </Panel>
            <Panel title="Invoice breakdown">
              <div className="ws-panel-body">
                <h3>{invoice.reference}</h3>
                <p>
                  {labelFor(students, invoice.studentId)}
                  <br />
                  Due: {invoice.dueDate}
                </p>
                {invoice.lines.map((line) => (
                  <p key={line.id}>
                    {line.name} <strong>{money(y, line.amountMinor)}</strong>
                  </p>
                ))}
                <p>Concession: {money(y, invoice.concessionMinor)}</p>
                <h3>Balance: {money(y, balance(y, invoice.id))}</h3>
                <p className="ws-hint">
                  No payment gateway or bank account is connected.
                </p>
              </div>
            </Panel>
          </div>
        ) : (
          <Panel title="No invoice">
            <p className="ws-empty">
              Generate a fee invoice before recording payment.
            </p>
            <Button onClick={generate}>Generate invoice</Button>
          </Panel>
        )}
        {editor}
      </>
    );
  return (
    <>
      <div className="ws-actions">
        <Button onClick={generate}>+ Generate invoices</Button>
        <LinkButton href="/fees/collect">Collect payment</LinkButton>
        <LinkButton href="/fees/invoices">Invoice ledger</LinkButton>
        <LinkButton href="/school-setup/fee-structure">
          Configure fee structure
        </LinkButton>
        <ExportButton
          name="fee-invoices"
          report="fees"
          rows={rows.map((i) => ({
            ...i,
            student: labelFor(students, i.studentId),
            balanceMinor: balance(y, i.id),
          }))}
        />
      </div>
      <Metrics
        items={[
          { label: "Total billed", value: money(y, total) },
          { label: "Recorded collections", value: money(y, collected) },
          { label: "Outstanding", value: money(y, total - collected) },
          {
            label: "Overdue accounts",
            value: y.records.invoices.filter(
              (i) =>
                i.status === "issued" &&
                i.dueDate < date &&
                balance(y, i.id) > 0,
            ).length,
          },
        ]}
      />
      <Panel title="Fee invoices & outstanding ledger">
        <Table
          headers={[
            "Select",
            "Invoice / period",
            "Student",
            "Due date",
            "Outstanding",
            "Actions",
          ]}
          rows={rows.map((i) => [
            <input
              aria-label={`Select ${i.reference}`}
              type="checkbox"
              checked={selected.includes(i.id)}
              onChange={(e) =>
                setSelected((s) =>
                  e.target.checked
                    ? [...s, i.id]
                    : s.filter((id) => id !== i.id),
                )
              }
            />,
            <>
              {i.reference}
              <br />
              <small>{i.period}</small>
            </>,
            labelFor(students, i.studentId),
            i.dueDate,
            <Badge
              tone={
                balance(y, i.id) === 0
                  ? "green"
                  : i.dueDate < date
                    ? "red"
                    : "amber"
              }
            >
              {money(y, balance(y, i.id))}
            </Badge>,
            <div className="ws-actions">
              <LinkButton href={`/fees/collect?invoice=${i.id}`}>
                Collect
              </LinkButton>
              <Button
                variant="outline"
                onClick={() =>
                  setEditor(
                    <RecordDialog
                      title="Request fee concession"
                      collection="approvals"
                      initial={{
                        ...newRecord(y),
                        title: `Concession for ${i.reference}`,
                        category: "concession",
                        requesterId: y.setup.staff[0]?.id ?? "",
                        targetId: i.id,
                        reason: "",
                        amountMinor: 0,
                        status: "pending",
                        decisionNote: "",
                      }}
                      fields={[
                        {
                          name: "amountMinor",
                          label: "Requested concession amount",
                          type: "number",
                          factor: 100,
                        },
                        {
                          name: "reason",
                          label: "Reason (8+ characters)",
                          type: "textarea",
                        },
                      ]}
                      onClose={() => setEditor(null)}
                    />,
                  )
                }
              >
                Concession request
              </Button>
            </div>,
          ])}
        />
      </Panel>
      <div className="ws-sticky-bar">
        <p>
          {selected.length} invoices selected · Reminder delivery requires a configured provider
          and saved to notices.
        </p>
        <Button
          disabled={busy || !selected.length}
          onClick={() =>
            void act(async () => {
              await mutate((current) => {
                const invoices = current.records.invoices.filter(
                  (i) => selected.includes(i.id) && balance(current, i.id) > 0,
                );
                if (!invoices.length)
                  throw new Error(
                    "Select at least one invoice with a balance.",
                  );
                const ids = invoices.map((i) => i.studentId);
                const recipients = [
                  ...new Set(
                    current.setup.relationships
                      .filter(
                        (l) => ids.includes(l.studentId) && l.canReceiveNotices,
                      )
                      .map((l) => l.guardianId),
                  ),
                ];
                if (!recipients.length)
                  throw new Error("No permitted guardian recipients found.");
                return putRecord(current, "notices", {
                  ...newRecord(current),
                  title: "Fee payment reminder",
                  body: `A fee reminder was prepared for ${invoices.length} outstanding invoices. Please review the fee ledger.`,
                  priority: "normal",
                  audience: "guardians",
                  classSectionIds: [],
                  channels: ["App", "WhatsApp"],
                  status: "published",
                  scheduledFor: null,
                  recipientIds: recipients,
                  acknowledgedIds: [],
                });
              }, "Prepared fee reminders", { type: "billing-remind", ids: selected });
              setSelected([]);
            })
          }
        >
          Prepare guardian reminders
        </Button>
      </div>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      <Panel title="Receipts & transaction history">
        <Table
          headers={[
            "Receipt",
            "Invoice",
            "Date / method",
            "Amount",
            "Status",
            "Actions",
          ]}
          rows={y.records.payments.map((p) => [
            p.reference,
            y.records.invoices.find((i) => i.id === p.invoiceId)?.reference,
            <>
              {p.paidOn}
              <br />
              {p.method}
            </>,
            money(y, p.amountMinor),
            <Badge tone={p.status === "completed" ? "green" : "gray"}>
              {p.status}
            </Badge>,
            <div className="ws-actions">
              <Button variant="outline" onClick={() => receipt(p.id)}>
                View receipt
              </Button>
              {p.status === "completed" && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEditor(
                      <Dialog
                        title="Reverse payment entry"
                        onClose={() => setEditor(null)}
                      >
                        <DataForm
                          initial={{ note: "" }}
                          fields={[
                            {
                              name: "note",
                              label: "Reversal reason (8+ characters)",
                              type: "textarea",
                            },
                          ]}
                          onSave={async (value) => {
                            const note = (value as { note: unknown }).note;
                            if (
                              typeof note !== "string" ||
                              note.trim().length < 8
                            )
                              throw new Error("Add a reversal reason.");
                            await mutate(
                              (current) =>
                                putRecord(current, "payments", {
                                  ...p,
                                  status: "reversed",
                                  note: note.trim(),
                                }),
                              "Reversed payment entry",
                              { type: "billing-reverse", id: p.id, note: note.trim() },
                            );
                            setEditor(null);
                          }}
                        />
                      </Dialog>,
                    )
                  }
                >
                  Reverse entry
                </Button>
              )}
            </div>,
          ])}
        />
      </Panel>
      {editor}
    </>
  );
}
