import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  if (process.env.MIS_BACKEND !== "supabase")
    return NextResponse.redirect(new URL("/login", request.url));
  const client = await createSupabaseServerClient();
  const code = request.nextUrl.searchParams.get("code");
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let success = false;
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    success = !error;
  } else if (token && ["recovery", "email"].includes(type ?? "")) {
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: type === "recovery" ? "recovery" : "email",
    });
    success = !error;
  }
  return NextResponse.redirect(
    new URL(
      success ? "/reset-password?token=cloud-session" : "/forgot-password",
      request.url,
    ),
  );
}
