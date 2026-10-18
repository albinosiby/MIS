import { AuthPage } from "@/features/identity/components/auth-page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <AuthPage screen="reset-password" searchParams={searchParams} />;
}
