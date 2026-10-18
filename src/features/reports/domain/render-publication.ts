import "regenerator-runtime/runtime.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ExcelJS from "exceljs";
import { publicationSchema } from "../schemas/publication.schema.ts";
import { reportTemplatesValuesSchema } from "../../exams/schemas/operations.schema.ts";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
const label = (key: string) =>
  key
    .replace(/Minor$/, " (INR)")
    .replace(/Bps$/, " (%)")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
const money = (key: string, value: unknown) =>
  typeof value === "number" && key.endsWith("Minor")
    ? value / 100
    : typeof value === "number" && key.endsWith("Bps")
      ? value / 100
      : value;
function display(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
/** Snapshot-only exports never recompute historical marks, amounts or ownership. */
export async function renderPublication(
  input: unknown,
  format: "pdf" | "xlsx",
) {
  const pub = publicationSchema.parse(input);
  const parsedTemplate=reportTemplatesValuesSchema.extend({id:identifierSchema}).safeParse(pub.snapshot.template);
  const template=pub.kind==="report-card"&&parsedTemplate.success?parsedTemplate.data:null;
  const entries=Object.entries(pub.snapshot).filter(([key])=>!key.endsWith("Id")&&!key.endsWith("Version")&&key!=="template"&&!(template?.layout==="Term summary"&&["subjects","gradeBands","gradingScale"].includes(key)));
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "School MIS";
    workbook.created = new Date(pub.issuedAt);
    workbook.modified = new Date(pub.issuedAt);
    const sheet = workbook.addWorksheet("Published record");
    sheet.addRow([template?.heading ?? pub.title]);
    sheet.addRow([pub.reference, pub.issuedAt]);
    const rows = Array.isArray(pub.snapshot.rows) ? pub.snapshot.rows : [];
    if (rows.length) {
      const columns = Array.isArray(pub.snapshot.columns)
        ? pub.snapshot.columns.map(String)
        : Object.keys(rows[0] as object);
      sheet.addRow(columns.map(label));
      for (const row of rows)
        sheet.addRow(
          columns.map((c) => {
            const value = money(c, (row as Record<string, unknown>)[c]);
            return typeof value === "number" ? value : display(value);
          }),
        );
      sheet.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: columns.length },
      };
    } else
      for (const [key, value] of entries) {
        if(key==="subjects"&&Array.isArray(value)){
          const columns=template?.layout==="Skills & remarks"?["subject","grade","remark"]:["subject","marks","maximum","percent","grade","remark"];
          sheet.addRow(columns.map(label));
          for(const subject of value)sheet.addRow(columns.map(c=>display((subject as Record<string,unknown>)[c])));
        }else sheet.addRow([label(key), display(money(key, value))]);
      }
    if(template)sheet.addRow([template.footer]);
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.columns.forEach((c) => {
      c.width = 32;
    });
    sheet.getRow(1).font = { bold: true, size: 16 };
    sheet.eachRow((r) => {
      r.alignment = { vertical: "top", wrapText: true };
    });
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(
      join(process.cwd(), "public/assets/fonts/Poppins-Regular.ttf"),
    ),
    { subset: true },
  );
  pdf.setTitle(pub.title);
  pdf.setAuthor("School MIS");
  pdf.setCreationDate(new Date(pub.issuedAt));
  pdf.setModificationDate(new Date(pub.issuedAt));
  let page = pdf.addPage([595, 842]),
    cursor = 790;
  const pages = [page];
  const line = (text: string, size = 10) => {
    if (cursor < 65) {
      page = pdf.addPage([595, 842]);
      pages.push(page);
      cursor = 790;
    }
    page.drawText(text, {
      x: 40,
      y: cursor,
      size,
      font,
      color: rgb(0.15, 0.18, 0.27),
    });
    cursor -= size + 7;
  };
  const wrap = (text: string, size = 10) => {
    for (const paragraph of text.replace(/[\r\t]/g, " ").split("\n")) {
      let current = "";
      for (const { segment: char } of new Intl.Segmenter("en-IN", {
        granularity: "grapheme",
      }).segment(paragraph)) {
        if (current && font.widthOfTextAtSize(current + char, size) > 515) {
          line(current, size);
          current = "";
        }
        current += char;
      }
      line(current, size);
    }
  };
  wrap(template?.heading ?? pub.title, 18);
  if(template)wrap(pub.title,12);
  wrap(`${pub.reference} · version ${pub.version}`, 10);
  wrap(`Issued ${pub.issuedAt.slice(0, 10)}`, 9);
  cursor -= 12;
  for (const [key, value] of entries) {
    if (key === "rows" && Array.isArray(value)) {
      for (const row of value)
        wrap(
          Object.entries(row as object)
            .map(([k, v]) => `${label(k)}: ${display(money(k, v))}`)
            .join("   |   "),
        );
    } else if (Array.isArray(value)) {
      wrap(label(key).toUpperCase(), 11);
      for (const item of value)
        wrap(
          typeof item === "object" && item !== null
            ? Object.entries(item)
                .filter(([k]) => !k.endsWith("Id")&&(key!=="subjects"||template?.layout!=="Skills & remarks"||["subject","grade","remark"].includes(k)))
                .map(([k, v]) => `${label(k)}: ${display(money(k, v))}`)
                .join(" · ")
            : display(item),
        );
    } else wrap(`${label(key)}: ${display(money(key, value))}`);
    cursor -= 5;
  }
  if(template){cursor-=8;wrap(template.footer,9);}
  pages.forEach((p, i) =>
    p.drawText(`${pub.reference}  •  ${i + 1}/${pages.length}`, {
      x: 40,
      y: 30,
      size: 8,
      font,
    }),
  );
  return pdf.save({ useObjectStreams: false, addDefaultPage: false });
}
