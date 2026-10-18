import { WorkflowScreen } from "@/features/workspace/components/workflow-screen";
import { workflowRoutes } from "@/features/workspace/data/workflow-routes";
import { roleHome } from "@/features/identity/domain/access";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { WorkspaceScreen } from "@/features/workspace/components/workspace-screen";
import { getScreen } from "@/features/workspace/data/screen-catalog";
import { requireIdentity } from "@/features/identity/server/session";
import { operationRoute } from "@/features/operations/data/routes";
import { OperationsScreen } from "@/features/operations/components/operations-screen";
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const route = "/" + screen.join("/");
  if (!workflowRoutes.includes(route) && !getScreen(route) && route !== "/workspace" && !operationRoute(route))
    notFound();
  const actor = await requireIdentity(route);
  const aliases:Record<string,string>={"/hr/payroll":"/hr/payroll-runs","/reports/saved-reports":"/reports/builder","/documents/document-register":"/documents/files"};
  if(aliases[route])redirect(aliases[route]);
  if(workflowRoutes.includes(route)) return <WorkflowScreen actor={actor} route={route}/>;
  if (
    route === "/workspace" &&
    ["parent", "student", "teacher", "staff"].includes(actor.role)
  )
    redirect(roleHome(actor.role));
  if (!getScreen(route))
    return <OperationsScreen actor={actor} route={route} />;
  const raw = await searchParams;
  const query = Object.fromEntries(
    Object.entries(raw).filter(
      ([, v]) => typeof v === "string" && v.length <= 200,
    ),
  ) as Record<string, string>;
  return <WorkspaceScreen key={route} route={route} query={query} />;
}
