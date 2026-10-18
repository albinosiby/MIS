import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import {
  canContact,
  canReadConversation,
  nextMessageDelivery,
} from "../src/features/communication/domain/conversations.ts";
import {
  messageSendSchema,
  conversationCreateSchema,
  quietHoursSchema,
} from "../src/features/communication/schemas/conversation.schema.ts";
import { retryAt } from "../src/features/jobs/domain/retry.ts";
import type {
  Conversation,
  ConversationContact,
} from "../src/features/communication/models/index.ts";
const actor = (role: string) => testAccounts.find((a) => a.role === role)!;
const contact = (role: string): ConversationContact => {
  const a = actor(role);
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    personId: a.personId,
    schoolId: a.schoolId,
  };
};
test("private threads require explicit participants in addition to current guardian/teaching relationships", () => {
  const y = createWorkspace().years[0],
    p = actor("parent");
  const thread: Conversation = {
    id: crypto.randomUUID(),
    school_id: p.schoolId,
    academic_year_id: y.setup.calendar.year.id,
    student_id: "student-1",
    subject: "Classwork discussion",
    created_by: p.id,
    state: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  assert.ok(canContact(y, p, contact("teacher"), "student-1"));
  assert.equal(canContact(y, p, contact("staff"), "student-1"), false);
  assert.ok(canReadConversation(y, p, thread, [p.id]));
  assert.equal(canReadConversation(y, p, thread, ["different-parent"]), false);
  assert.equal(
    canReadConversation(y, { ...p, id: "other-parent-account" }, thread, [
      p.id,
    ]),
    false,
  );
  assert.equal(
    canReadConversation(y, { ...p, schoolId: "other-school" }, thread, [p.id]),
    false,
  );
  const revoked = {
    ...y,
    setup: {
      ...y.setup,
      relationships: y.setup.relationships.map((l) => ({
        ...l,
        canViewRecords: false,
      })),
    },
  };
  assert.equal(canReadConversation(revoked, p, thread, [p.id]), false);
  assert.equal(
    canContact(
      y,
      p,
      { ...contact("teacher"), schoolId: "foreign" },
      "student-1",
    ),
    false,
  );
});
test("message contracts reject oversized content and forged fields; idempotency keys are mandatory", () => {
  const input = {
    conversationId: crypto.randomUUID(),
    body: "Homework question",
    attachmentIds: [],
    clientKey: crypto.randomUUID(),
  };
  assert.ok(messageSendSchema.safeParse(input).success);
  assert.equal(
    messageSendSchema.safeParse({ ...input, body: "x".repeat(4001) }).success,
    false,
  );
  assert.equal(
    messageSendSchema.safeParse({ ...input, senderId: actor("admin").id })
      .success,
    false,
  );
  assert.equal(
    messageSendSchema.safeParse({ ...input, clientKey: "" }).success,
    false,
  );
  assert.equal(
    conversationCreateSchema.safeParse({
      yearId: "ay-2026-27",
      studentId: "student-1",
      subject: "Question",
      participantIds: [],
      clientKey: crypto.randomUUID(),
    }).success,
    false,
  );
});
test("quiet hours respect India time, overnight windows and disabled settings", () => {
  const settings = quietHoursSchema.parse({
    enabled: true,
    start: 22,
    end: 7,
    timezone: "Asia/Kolkata",
  });
  assert.equal(
    nextMessageDelivery(new Date("2026-10-18T17:30:00Z"), settings),
    "2026-10-19T01:30:00.000Z",
  );
  assert.equal(
    nextMessageDelivery(new Date("2026-10-18T05:00:00Z"), settings),
    "2026-10-18T05:00:00.000Z",
  );
  assert.equal(
    nextMessageDelivery(new Date("2026-10-18T17:30:00Z"), {
      ...settings,
      enabled: false,
    }),
    "2026-10-18T17:30:00.000Z",
  );
  assert.equal(
    quietHoursSchema.safeParse({ ...settings, end: 22 }).success,
    false,
  );
  assert.equal(
    retryAt(new Date("2026-10-18T00:00:00Z"), 1),
    "2026-10-18T00:00:15.000Z",
  );
  assert.throws(() => retryAt(new Date(), 0));
});
