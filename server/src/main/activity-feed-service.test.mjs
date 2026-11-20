import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeActivityCursor,
  encodeActivityCursor,
  getActivityPage,
  parseActivityPageSize,
  parseManilaDateBoundary,
} from "./activity-feed-service.js";
import { Timestamp } from "firebase-admin/firestore";

test("activity cursors preserve timestamp and document ID", () => {
  const date = new Date("2026-03-01T12:30:00.000Z");
  const cursor = decodeActivityCursor(encodeActivityCursor(date, "event-42"));

  assert.deepEqual(cursor, { createdAt: date, id: "event-42" });
});

test("invalid activity cursors and page sizes are rejected", () => {
  assert.throws(() => decodeActivityCursor("not-a-cursor"), { status: 400 });
  assert.throws(() => parseActivityPageSize("101"), { status: 400 });
  assert.equal(parseActivityPageSize(undefined), 30);
});

test("activity date filters use Manila day boundaries", () => {
  assert.equal(
    parseManilaDateBoundary("2026-03-01").toISOString(),
    "2026-02-28T16:00:00.000Z",
  );
  assert.equal(
    parseManilaDateBoundary("2026-03-01", true).toISOString(),
    "2026-03-01T16:00:00.000Z",
  );
  assert.throws(() => parseManilaDateBoundary("2026-02-30"), { status: 400 });
});

test("activity pages advance with a timestamp and document-ID cursor", async () => {
  const firstPage = [
    makeActivityDocument("event-3", "2026-03-03T10:00:00.000Z"),
    makeActivityDocument("event-2", "2026-03-02T10:00:00.000Z"),
    makeActivityDocument("event-1", "2026-03-01T10:00:00.000Z"),
  ];
  const secondPage = [firstPage[2]];
  const calls = [];
  const responses = [firstPage, secondPage];
  const query = {
    where(...args) { calls.push(["where", ...args]); return this; },
    orderBy(...args) { calls.push(["orderBy", ...args]); return this; },
    startAfter(...args) { calls.push(["startAfter", ...args]); return this; },
    limit(value) { calls.push(["limit", value]); return this; },
    async get() { return { docs: responses.shift() }; },
  };
  const db = { collection: () => query };

  const first = await getActivityPage(db, { pageSize: 2, userUid: "client-uid" });
  const second = await getActivityPage(db, {
    pageSize: 2,
    userUid: "client-uid",
    cursor: first.nextCursor,
  });

  assert.deepEqual(first.items.map(item => item.id), ["event-3", "event-2"]);
  assert.equal(first.hasMore, true);
  assert.deepEqual(second.items.map(item => item.id), ["event-1"]);
  assert.equal(second.hasMore, false);
  const cursorCall = calls.find(call => call[0] === "startAfter");
  assert.ok(cursorCall[1] instanceof Timestamp);
  assert.equal(cursorCall[2], "event-2");
});

function makeActivityDocument(id, createdAt) {
  const timestamp = Timestamp.fromDate(new Date(createdAt));
  return {
    id,
    get: field => field === "createdAt" ? timestamp : undefined,
    data: () => ({
      action: "project-submitted",
      createdAt: timestamp,
    }),
  };
}
