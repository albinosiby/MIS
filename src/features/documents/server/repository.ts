import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountIdentity } from "../../identity/models";
import type { Workspace } from "../../workspace/models";
import type { PrivateDocument } from "../models";
import {
  documentCursorSchema,
  documentUploadSchema,
  privateDocumentSchema,
  privateDocumentSummarySchema,
} from "../schemas/private-document.schema";
import {
  canAccessDocument,
  canRevokeDocument,
  documentScope,
} from "../domain/document-access";
import { validateDocumentBytes } from "../domain/file-validation";
const BUCKET = "mis-private-documents";
function summary(d: PrivateDocument, a: AccountIdentity) {
  const {
    object_path: _path,
    created_by: uploader,
    sha256: _hash,
    ...permitted
  } = d;
  return privateDocumentSummarySchema.parse({
    ...permitted,
    isUploader: uploader === a.id,
  });
}
function year(root: Workspace, id: string) {
  const y = root.years.find((y) => y.setup.calendar.year.id === id);
  if (!y) throw new Error("File unavailable.");
  return y;
}
async function lifecycle(a: AccountIdentity, id: string, action: string) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_document_lifecycle",
    { p_actor: a.id, p_id: id, p_action: action },
  );
  if (error) {
    console.error("Private file lifecycle failed", {
      code: error.code,
      action,
    });
    throw new Error(
      "File changed or action is unavailable. Refresh and try again.",
    );
  }
  return privateDocumentSchema.parse(data);
}
export async function getPrivateDocument(
  a: AccountIdentity,
  root: Workspace,
  id: string,
  write = false,
) {
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_documents")
    .select("*")
    .eq("id", id)
    .eq("school_id", a.schoolId)
    .maybeSingle();
  if (error || !data) throw new Error("File unavailable.");
  const d = privateDocumentSchema.parse(data);
  if (
    !canAccessDocument(
      year(root, d.academic_year_id),
      a,
      documentScope(d),
      write,
      year(root, root.activeYearId),
    )
  )
    throw new Error("File unavailable.");
  return d;
}
export async function listPrivateDocuments(
  a: AccountIdentity,
  root: Workspace,
  yearId: string,
  before?: string,
) {
  const y = year(root, yearId);
  // Bounded database pages; caller cursor is a validated ISO timestamp.
  let query = createSupabaseAdminClient()
    .from("mis_documents")
    .select("*")
    .eq("school_id", a.schoolId)
    .eq("academic_year_id", yearId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (before) {
    const cursor = documentCursorSchema.parse(JSON.parse(before));
    query = query.or(
      `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error("Files could not be loaded.");
  const rows = privateDocumentSchema.array().parse(data);
  return {
    files: rows
      .filter(
        (d) =>
          (d.status !== "uploading" ||
            d.created_by === a.id ||
            ["admin", "principal"].includes(a.role)) &&
          canAccessDocument(
            y,
            a,
            documentScope(d),
            false,
            year(root, root.activeYearId),
          ),
      )
      .map((d) => summary(d, a)),
    next:
      rows.length === 100
        ? JSON.stringify({ at: rows.at(-1)!.created_at, id: rows.at(-1)!.id })
        : null,
  };
}
export async function uploadPrivateDocument(
  a: AccountIdentity,
  root: Workspace,
  input: unknown,
  file: File,
) {
  const request = documentUploadSchema.parse(input);
  if (
    !canAccessDocument(
      year(root, request.yearId),
      a,
      request,
      true,
      year(root, root.activeYearId),
    )
  )
    throw new Error("You cannot upload to this file owner and category.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime: ReturnType<typeof validateDocumentBytes>;
  try {
    mime = validateDocumentBytes(file.name, file.type, bytes);
  } catch (error) {
    console.error("Private file format rejected", {
      reason: error instanceof Error ? error.message : "Invalid format",
    });
    throw error;
  }
  if (request.replacesId) {
    const previous = await getPrivateDocument(
      a,
      root,
      request.replacesId,
      true,
    );
    if (
      !canRevokeDocument(
        year(root, previous.academic_year_id),
        a,
        previous,
        year(root, root.activeYearId),
      ) ||
      previous.status !== "ready" ||
      previous.academic_year_id !== request.yearId ||
      previous.owner_type !== request.ownerType ||
      previous.owner_id !== request.ownerId ||
      previous.category !== request.category
    )
      throw new Error("Replacement scope must match the original file.");
  }
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("mis_begin_document", {
    p_actor: a.id,
    p_document: {
      id: randomUUID(),
      school_id: a.schoolId,
      academic_year_id: request.yearId,
      owner_type: request.ownerType,
      owner_id: request.ownerId,
      category: request.category,
      filename: file.name,
      mime_type: mime,
      byte_size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      replaces_id: request.replacesId,
    },
  });
  if (error) {
    console.error("Private file reservation failed", { code: error.code });
    throw new Error("Upload could not be reserved. Refresh and retry.");
  }
  const d = privateDocumentSchema.parse(data);
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(d.object_path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
  if (uploadError) {
    console.error("Private file bytes failed", {
      code: uploadError.statusCode,
    });
    await lifecycle(a, d.id, "failed");
    throw new Error(
      "File upload failed. The previous version remains available.",
    );
  }
  // If publication fails, retain the unavailable object/metadata for inspection; never expose pending bytes.
  return summary(await lifecycle(a, d.id, "ready"), a);
}
export async function downloadPrivateDocument(
  a: AccountIdentity,
  root: Workspace,
  id: string,
) {
  const d = await getPrivateDocument(a, root, id);
  if (d.status !== "ready") throw new Error("File unavailable.");
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .download(d.object_path);
  if (error || !data || data.size !== d.byte_size)
    throw new Error("File content is unavailable.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== d.sha256)
    throw new Error("File integrity check failed.");
  await lifecycle(a, d.id, "download");
  return { document: d, bytes };
}
export async function changePrivateDocument(
  a: AccountIdentity,
  root: Workspace,
  id: string,
  action: "revoke" | "purge" | "resume" | "discard",
) {
  const d: PrivateDocument = await getPrivateDocument(a, root, id);
  if (
    !canRevokeDocument(
      year(root, d.academic_year_id),
      a,
      d,
      year(root, root.activeYearId),
    )
  )
    throw new Error("You cannot change this file.");
  if (["resume", "discard"].includes(action)) {
    if (
      d.status !== "uploading" ||
      d.created_by !== a.id ||
      !canAccessDocument(
        year(root, d.academic_year_id),
        a,
        documentScope(d),
        true,
        year(root, root.activeYearId),
      )
    )
      throw new Error(
        "Only the permitted uploader can recover a pending upload.",
      );
    if (action === "discard") {
      const cancelled = await lifecycle(a, id, "failed");
      const { error } = await createSupabaseAdminClient()
        .storage.from(BUCKET)
        .remove([d.object_path]);
      if (error)
        throw new Error(
          "Upload cancelled; a retained object needs administrator cleanup.",
        );
      return summary(cancelled, a);
    }
    const { data: content, error } = await createSupabaseAdminClient()
      .storage.from(BUCKET)
      .download(d.object_path);
    if (error || !content || content.size !== d.byte_size)
      throw new Error(
        "Upload content is incomplete. Cancel the pending upload and retry.",
      );
    const bytes = new Uint8Array(await content.arrayBuffer());
    validateDocumentBytes(d.filename, d.mime_type, bytes);
    if (createHash("sha256").update(bytes).digest("hex") !== d.sha256)
      throw new Error("Upload integrity check failed.");
    return summary(await lifecycle(a, id, "ready"), a);
  }
  if (action === "revoke") return summary(await lifecycle(a, id, "revoke"), a);
  if (
    !["admin", "principal"].includes(a.role) ||
    Date.parse(d.retain_until) > Date.now()
  )
    throw new Error("Retention has not expired or purge is not permitted.");
  await lifecycle(a, id, "purge-start");
  const { error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .remove([d.object_path]);
  if (error)
    throw new Error(
      "Purge could not finish. Retry the purge; downloads remain blocked.",
    );
  return summary(await lifecycle(a, id, "purged"), a);
}
