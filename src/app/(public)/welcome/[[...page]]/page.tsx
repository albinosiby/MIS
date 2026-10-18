import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { SetupWorkspaceProvider } from "@/features/school-setup/hooks/setup-workspace-provider";
import { VendorSite } from "@/features/operations/components/vendor-site";
import "@/features/operations/styles.css";
import "@/features/identity/styles.css";
import "@/features/workspace/styles/workspace.css";
import "@/features/school-setup/styles/setup-config.css";
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const { page } = await params;
  if (page?.join("/") === "demo") redirect("/welcome/contact");
  const key = page?.join("/") ?? "";
  if (
    ![
      "",
      "features",
      "pricing",
      "contact",
      "signup",
      "security",
      "partners",
      "help",
      "status",
      "blog",
      "careers",
      "privacy",
      "terms",
    ].includes(key)
  )
    notFound();
  return (
    <SetupWorkspaceProvider publicView>
      <VendorSite page={key} />
    </SetupWorkspaceProvider>
  );
}
