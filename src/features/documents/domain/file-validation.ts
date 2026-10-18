import { MAX_DOCUMENT_BYTES } from "../schemas/private-document.schema.ts";
/** Allow a small bounded set of attachment formats. Content checks are not malware scanning. */
export function validateDocumentBytes(name: string, declaredType: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Choose a non-empty file of at most 5 MB.");
  if (!name || name.length > 180 || /[\/\\\x00-\x1f\x7f]/.test(name) || name.startsWith(".")) throw new Error("Use a plain file name of at most 180 characters.");
  const head = Array.from(bytes.slice(0, 8));
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const png = head.join(",") === "137,80,78,71,13,10,26,10";
  const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
  const mime = pdf ? "application/pdf" : png ? "image/png" : jpeg ? "image/jpeg" : null;
  const extension = name.toLowerCase().split(".").at(-1);
  if (!mime || mime !== declaredType || !(pdf ? extension === "pdf" : png ? extension === "png" : ["jpg", "jpeg"].includes(extension ?? ""))) throw new Error("Upload a PDF, PNG or JPEG whose content matches its file type.");
  if (pdf) {
    const content = new TextDecoder("latin1").decode(bytes).replace(/#([0-9a-f]{2})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
    if (!content.includes("%%EOF") || /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|Encrypt|ObjStm)\b/i.test(content) || /\/J#(?:61|41)vaScript/i.test(content)) throw new Error("This PDF contains unsupported active content or is incomplete.");
  }
  if (png && (bytes.length < 45 || new TextDecoder().decode(bytes.slice(12, 16)) !== "IHDR" || Array.from(bytes.slice(-8)).join(",") !== "73,69,78,68,174,66,96,130")) throw new Error("The PNG is incomplete.");
  if (jpeg && (bytes.length < 4 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)) throw new Error("The JPEG is incomplete.");
  return mime;
}
