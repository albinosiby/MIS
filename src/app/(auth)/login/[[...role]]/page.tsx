import { LoginForm } from "@/features/identity/components/login-form";
import "@/features/identity/styles.css";
import { notFound } from "next/navigation";
import { testAccounts } from "@/features/identity/data/test-accounts";
export default async function Page({
  params,
}: {
  params: Promise<{ role?: string[] }>;
}) {
  const { role } = await params;
  if (
    role &&
    (role.length !== 1 || !testAccounts.some((x) => x.role === role[0]))
  )
    notFound();
  return <LoginForm key={role?.[0] ?? "admin"} role={role?.[0]} />;
}
