import {publicationDownloadRequestSchema} from "@/features/reports/schemas/publication-register.schema";
import {identifierSchema} from "@/shared/schemas/primitives";
import {publicationRevocations,revokePublishedDocument} from "@/features/reports/server/publication-register";
import {jsonBody,privateJson} from "@/shared/server/request";
import { schoolContext, apiFailure } from "@/shared/server/request";
import { canReadPublication } from "@/features/reports/domain/publication-access";
import { renderPublication } from "@/features/reports/domain/render-publication";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = identifierSchema.parse((await params).id),
      { actor, root } = await schoolContext(),
      url = new URL(request.url),
      {format,yearId}=publicationDownloadRequestSchema.parse({yearId:url.searchParams.get("year"),format:url.searchParams.get("format")??"pdf"});
    const year = root.years.find(
        (y) => y.setup.calendar.year.id === yearId,
      ),
      pub = year?.workflows.publications.find((p) => p.id === id);
    if (!year || !pub || !canReadPublication(year, actor, pub))
      throw new Error("Publication inaccessible.");
    if((await publicationRevocations(actor.schoolId,year.setup.calendar.year.id,[pub.id])).length)throw new Error("Publication revoked.");
    const bytes = await renderPublication(pub, format),
      name = pub.reference.replace(/[^A-Za-z0-9_-]/g, "_");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const {actor,root}=await schoolContext(),id=identifierSchema.parse((await params).id);await revokePublishedDocument(actor,root,id,await jsonBody(request));return privateJson({ok:true});}catch(error){return apiFailure(error);}}
