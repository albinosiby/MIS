/** Local synthetic identity adapter. Replace with Supabase Auth; never import into client components. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { testAccounts, TEST_ACCOUNT_PASSWORD } from "../data/test-accounts.ts";
import { accountIdentitySchema, roleSchema } from "../schemas/identity.schema.ts";
import type { AccountIdentity } from "../models/index.ts";
export function accountStore(
  path = join(process.cwd(), ".local", "school-demo.sqlite"),
) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, identity TEXT NOT NULL, salt TEXT NOT NULL, digest TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS tokens (digest TEXT PRIMARY KEY, account_id TEXT NOT NULL, purpose TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);",
  );
  function password(value: string, salt: string) {
    return scryptSync(value, salt, 32).toString("hex");
  }
  for (const identity of testAccounts) {
    if (!db.prepare("SELECT id FROM accounts WHERE id=?").get(identity.id)) {
      const salt = randomBytes(16).toString("hex");
      db.prepare(
        "INSERT OR IGNORE INTO accounts(id,email,identity,salt,digest) VALUES(?,?,?,?,?)",
      ).run(
        identity.id,
        identity.email,
        JSON.stringify(identity),
        salt,
        password(TEST_ACCOUNT_PASSWORD, salt),
      );
    }
  }
  function get(id: string) {
    const row = db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
    if (!row) return null;
    return {
      identity: accountIdentitySchema.parse(JSON.parse(String(row.identity))),
      active: row.active === 1,
      version: Number(row.version),
    };
  }
  function authenticate(email: string, value: string) {
    const row = db
      .prepare("SELECT * FROM accounts WHERE email=?")
      .get(email.toLowerCase());
    const salt = String(row?.salt ?? "dummy-salt");
    const actual = Buffer.from(password(value, salt), "hex");
    const expected = Buffer.from(String(row?.digest ?? "00".repeat(32)), "hex");
    if (!timingSafeEqual(actual, expected) || !row || row.active !== 1)
      return null;
    return get(String(row.id));
  }
  function token(id: string, purpose: string) {
    const raw = randomBytes(32).toString("base64url");
    db.prepare("UPDATE tokens SET used=1 WHERE account_id=? AND purpose=?").run(
      id,
      purpose,
    );
    db.prepare("INSERT INTO tokens VALUES(?,?,?,?,0)").run(
      createHash("sha256").update(raw).digest("hex"),
      id,
      purpose,
      Date.now() + 3600000,
    );
    return raw;
  }
  function recover(email: string) {
    const row = db
      .prepare("SELECT id FROM accounts WHERE email=? AND active=1")
      .get(email.toLowerCase());
    return row ? token(String(row.id), "recovery") : null;
  }
  function finish(
    raw: string,
    purpose: "recovery" | "invitation",
    newPassword: string,
  ) {
    if (newPassword.length < 12 || newPassword.length > 128)
      throw new Error("Use a password of 12–128 characters.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const digest = createHash("sha256").update(raw).digest("hex");
      const row = db
        .prepare(
          "SELECT * FROM tokens WHERE digest=? AND purpose=? AND used=0 AND expires>?",
        )
        .get(digest, purpose, Date.now());
      if (!row)
        throw new Error("This link has expired or has already been used.");
      const salt = randomBytes(16).toString("hex");
      db.prepare(
        "UPDATE accounts SET salt=?,digest=?,active=1,version=version+1 WHERE id=?",
      ).run(salt, password(newPassword, salt), String(row.account_id));
      db.prepare("UPDATE tokens SET used=1 WHERE account_id=?").run(
        String(row.account_id),
      );
      db.exec("COMMIT");
      return get(String(row.account_id))!;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function invite(input: unknown) {
    const identity = accountIdentitySchema.parse(input);
    roleSchema.parse(identity.role);
    if (
      db
        .prepare("SELECT id FROM accounts WHERE email=?")
        .get(identity.email.toLowerCase())
    )
      throw new Error("An account with this email already exists.");
    const salt = randomBytes(16).toString("hex");
    db.prepare(
      "INSERT INTO accounts(id,email,identity,salt,digest,active) VALUES(?,?,?,?,?,0)",
    ).run(
      identity.id,
      identity.email.toLowerCase(),
      JSON.stringify(identity),
      salt,
      password(randomBytes(32).toString("hex"), salt),
    );
    return token(identity.id, "invitation");
  }
  function setActive(id: string, active: boolean) {
    const account = get(id);
    if (!account) throw new Error("Account not found.");
    if (
      !active &&
      account.identity.role === "admin" &&
      Number(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM accounts WHERE active=1 AND json_extract(identity,'$.role')='admin'",
          )
          .get()?.n,
      ) <= 1
    )
      throw new Error("Keep at least one active school administrator.");
    db.prepare("UPDATE accounts SET active=?,version=version+1 WHERE id=?").run(
      active ? 1 : 0,
      id,
    );
  }
  return {
    get,
    authenticate,
    recover,
    finish,
    invite,
    setActive,
    updateIdentity: (input: unknown) => {
      const next = accountIdentitySchema.parse(input);
      const previous = get(next.id);
      if (
        !previous ||
        next.schoolId !== previous.identity.schoolId ||
        next.email !== previous.identity.email
      )
        throw new Error("Account ownership cannot change.");
      db.prepare(
        "UPDATE accounts SET identity=?,version=version+1 WHERE id=?",
      ).run(JSON.stringify(next), next.id);
    },
    revoke: (id: string) =>
      db.prepare("UPDATE accounts SET version=version+1 WHERE id=?").run(id),
    list: () =>
      db
        .prepare("SELECT id FROM accounts ORDER BY email")
        .all()
        .map((x) => get(String(x.id))!),
    close: () => db.close(),
  };
}
