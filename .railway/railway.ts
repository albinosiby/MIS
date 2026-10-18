import { defineRailway, project, service } from "railway/iac";

// Apply explicitly with `railway config plan` / `railway config apply`.
// Connect your repository to both services in Railway after applying.
export default defineRailway((ctx) => {
  const env = {
    NODE_ENV: "production",
    MIS_BACKEND: "supabase",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: ctx.shared.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      ctx.shared.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVER_SECRET_KEY: ctx.shared.SUPABASE_SERVER_SECRET_KEY,
    NEXT_PUBLIC_APP_URL: ctx.shared.NEXT_PUBLIC_APP_URL,
    MIS_TEST_ACCOUNTS_ENABLED: ctx.shared.MIS_TEST_ACCOUNTS_ENABLED,
  };
  return project("school-mis", {
    resources: [
      service("web", {
        build: { builder: "RAILPACK", buildCommand: "npm run build" },
        start: "npm run start:railway",
        healthcheck: "/api/health",
        healthcheckTimeout: 120,
        replicas: 1,
        deploy: {
          sleepApplication: false,
          restartPolicyType: "ON_FAILURE",
          restartPolicyMaxRetries: 10,
        },
        env,
      }),
      service("worker", {
        build: {
          builder: "RAILPACK",
          buildCommand: "node --check scripts/run-school-worker.ts",
        },
        start: "npm run worker:railway",
        replicas: 1,
        deploy: { sleepApplication: false, restartPolicyType: "ALWAYS" },
        env,
      }),
    ],
  });
});
