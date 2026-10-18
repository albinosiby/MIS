import nextEnv from "@next/env";
import { validateDeploymentEnvironment } from "../src/lib/deployment/environment.ts";
nextEnv.loadEnvConfig(process.cwd());
const service = process.argv[2];
try {
  if (service !== "web" && service !== "worker")
    throw new Error("Choose deployment service web or worker.");
  validateDeploymentEnvironment(process.env, service);
  console.log(`Deployment configuration verified for ${service}.`);
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Deployment configuration is incomplete.",
  );
  process.exitCode = 1;
}
