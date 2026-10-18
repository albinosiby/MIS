import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSupabaseConfig } from "../src/lib/supabase/config.ts";
const valid = {
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_key",
};
test("Supabase config accepts the public project origin and normalizes the slash", () => {
  assert.equal(
    parseSupabaseConfig({ ...valid, url: valid.url + "/" }).url,
    valid.url,
  );
});
test("Supabase config rejects secrets, missing config and credential-bearing endpoints without leaking values", () => {
  for (const input of [
    undefined,
    {},
    { ...valid, publishableKey: "sb_secret_do_not_expose" },
    { ...valid, publishableKey: "eyJlegacyjwt" },
    { ...valid, url: "http://example.supabase.co" },
    { ...valid, url: "https://user:password@example.supabase.co" },
    { ...valid, url: valid.url + "/rest/v1" },
    { ...valid, url: valid.url + "?token=sensitive" },
  ]) {
    assert.throws(
      () => parseSupabaseConfig(input),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes("do_not_expose") &&
        !error.message.includes("sensitive") &&
        !error.message.includes("password@"),
    );
  }
});
