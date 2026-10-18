import test from "node:test";
import assert from "node:assert/strict";
import { validateDeploymentEnvironment } from "../src/lib/deployment/environment.ts";
import { GET } from "../src/app/api/health/route.ts";
import railwayConfig from "../.railway/railway.ts";
import { createRailwayContext, project, type ServiceNode } from "railway/iac";
const env = {
  MIS_BACKEND: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnop",
  SUPABASE_SERVER_SECRET_KEY: "sb_secret_abcdefghijklmnopqrstuvwxyz012345",
  NEXT_PUBLIC_APP_URL: "https://school.up.railway.app",
  MIS_TEST_ACCOUNTS_ENABLED: "false",
};
test("hosted startup rejects local persistence, wrong key classes and unsafe callback origins without printing secrets", () => {
  validateDeploymentEnvironment(env, "web");
  validateDeploymentEnvironment(
    { ...env, NEXT_PUBLIC_APP_URL: undefined },
    "worker",
  );
  assert.throws(
    () =>
      validateDeploymentEnvironment({ ...env, MIS_BACKEND: "local" }, "web"),
    /MIS_BACKEND/,
  );
  for (const key of [
    "sb_publishable_abcdefghijklmnopqrstuvwxyz012345",
    "sbp_abcdefghijklmnopqrstuvwxyz012345",
    "",
  ]) {
    assert.throws(
      () =>
        validateDeploymentEnvironment(
          { ...env, SUPABASE_SERVER_SECRET_KEY: key },
          "web",
        ),
      (error) =>
        error instanceof Error &&
        error.message.includes("SUPABASE_SERVER_SECRET_KEY") &&
        (!key || !error.message.includes(key)),
    );
  }
  for (const origin of [
    "http://school.up.railway.app",
    "https://user:password@example.test",
    "https://localhost",
    "https://example.test/path",
    "https://example.test?token=private",
  ]) {
    assert.throws(
      () =>
        validateDeploymentEnvironment(
          { ...env, NEXT_PUBLIC_APP_URL: origin },
          "web",
        ),
      /NEXT_PUBLIC_APP_URL/,
    );
  }
  assert.throws(
    () =>
      validateDeploymentEnvironment(
        { ...env, MIS_TEST_ACCOUNTS_ENABLED: "yes" },
        "web",
      ),
    /true or false/,
  );
});
test("hosted health response is uncached and reveals only process liveness", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("Railway configuration evaluates offline with private shared key references and a continuously running worker", async () => {
  const definition = await railwayConfig(createRailwayContext(), project);
  const services = (definition.resources ?? []).filter(
    (resource): resource is ServiceNode =>
      !Array.isArray(resource) && resource.type === "service",
  );
  const web = services.find((resource) => resource.name === "web");
  const worker = services.find((resource) => resource.name === "worker");
  assert.ok(web);
  assert.ok(worker);
  assert.equal(web.deploy?.healthcheckPath, "/api/health");
  assert.equal(worker.deploy?.healthcheckPath, undefined);
  for (const resource of [web, worker]) {
    assert.equal(resource.deploy?.sleepApplication, false);
    assert.equal(resource.deploy?.numReplicas, 1);
    assert.deepEqual(resource.variables?.SUPABASE_SERVER_SECRET_KEY, {
      type: "sharedReference",
      name: "SUPABASE_SERVER_SECRET_KEY",
    });
    assert.equal(
      resource.variables?.NEXT_PUBLIC_SUPABASE_SERVER_SECRET_KEY,
      undefined,
    );
  }
});
