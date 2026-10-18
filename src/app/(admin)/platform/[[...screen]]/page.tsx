import { redirect, notFound } from "next/navigation";
import { currentIdentity } from "@/features/identity/server/session";
import { platformActor } from "@/features/admin/server/auth";
import { PlatformPanel } from "@/features/admin/components/platform-panel";
import "@/features/operations/styles.css";
import "@/features/admin/styles/platform.css";
export default async function Page({
  params,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  const actor = await currentIdentity();
  if (!actor) redirect("/login/platform");
  if (actor.role !== "platform") redirect("/access-denied");
  await platformActor();
  const { screen = [] } = await params;
  if (
    !(
      screen.length === 0 ||
      (["institutions", "users", "support", "audit"].includes(screen[0]) &&
        screen.length <= 2) ||
      (screen[0] === "institutions" &&
        screen.length === 3 &&
        screen[2] === "data")
    )
  )
    notFound();
  return <PlatformPanel actor={actor} screen={screen} />;
}
