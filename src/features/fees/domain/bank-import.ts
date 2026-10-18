import { parseCsv } from "../../../shared/data/csv.ts";
import { bankImportSchema } from "../schemas/bank-reconciliation.schema.ts";
/** Exact decimal conversion; signed rupees, no floating point rounding of invalid precision. */
export function bankMinor(text: string) {
  const value = text.trim();
  if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use signed rupee amounts with at most two decimal places.",
    );
  const negative = value.startsWith("-"),
    [whole, fraction = ""] = value.replace("-", "").split(".");
  return (
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (negative ? -1 : 1)
  );
}
export function bankCsvImport(input: {
  account: string;
  from: string;
  to: string;
  opening: string;
  closing: string;
  csv: string;
}) {
  const [header, ...rows] = parseCsv(input.csv, 300);
  if (header?.join(",") !== "date,reference,amount")
    throw new Error(
      "CSV header must be date,reference,amount; amounts are signed rupees.",
    );
  if (rows.some((r) => r.length !== 3))
    throw new Error("Each bank statement row needs exactly three columns.");
  return bankImportSchema.parse({
    account: input.account,
    from: input.from,
    to: input.to,
    openingMinor: bankMinor(input.opening),
    closingMinor: bankMinor(input.closing),
    lines: rows.map(([date, reference, amount]) => ({
      date,
      reference,
      amountMinor: bankMinor(amount),
    })),
  });
}
