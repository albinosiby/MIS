/** RFC-style quoted cells, CRLF, escaped quotes; bounded before parsing. */
export function parseCsv(text: string, maxRows = 500): string[][] {
  if (text.length > 1_000_000)
    throw new Error("CSV must be smaller than 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell.length || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(cell.trim());
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === "\r" && source[i + 1] === "\n") i++;
      }
      continue;
    }
    if (closed && !/\s/.test(c))
      throw new Error("Unexpected text after a quoted value.");
    if (!closed) cell += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > maxRows + 1)
    throw new Error(`Import at most ${maxRows} data rows at a time.`);
  return rows;
}
