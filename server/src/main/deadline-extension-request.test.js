import assert from "node:assert/strict";
import test from "node:test";
import { saveDeadlineExtensionRequest } from "./deadline-extension-request.js";

function createDb(project) {
  const writes = [];
  return {
    writes,
    collection() {
      return {
        doc(projectId) {
          return { projectId };
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get() {
          return {
            exists: project !== null,
            data: () => project,
          };
        },
        update(reference, fields) {
          writes.push({ reference, fields });
        },
      });
    },
  };
}

const expiredProject = {
  ownerId: "client-1",
  projectName: "Kitchen plan",
  projectStatus: "ongoing",
  deadline: "2000-01-01",
};

test("saves a request only for the owning client with an expired deadline", async () => {
  const db = createDb(expiredProject);
  const requestedAt = new Date("2026-11-26T14:00:00Z");
  const result = await saveDeadlineExtensionRequest(
    db,
    "PRJ-00126",
    "client-1",
    "Client Name",
    "  Need more time  ",
    requestedAt,
  );

  assert.equal(db.writes.length, 1);
  assert.deepEqual(db.writes[0].fields.deadlineExtensionRequest, {
    status: "pending",
    requestedBy: "client-1",
    requestedByName: "Client Name",
    reason: "  Need more time  ",
    requestedAt,
  });
  assert.equal(result.projectName, "Kitchen plan");
});

test("rejects missing, non-owned, non-expired, locked-status, and duplicate requests", async () => {
  const cases = [
    { project: null, ownerId: "client-1", status: 404 },
    { project: expiredProject, ownerId: "client-2", status: 403 },
    {
      project: { ...expiredProject, deadline: "2099-12-31" },
      ownerId: "client-1",
      status: 400,
    },
    {
      project: { ...expiredProject, projectStatus: "submitted" },
      ownerId: "client-1",
      status: 400,
    },
    {
      project: {
        ...expiredProject,
        deadlineExtensionRequest: { status: "pending" },
      },
      ownerId: "client-1",
      status: 409,
    },
  ];

  for (const { project, ownerId, status } of cases) {
    await assert.rejects(
      saveDeadlineExtensionRequest(
        createDb(project),
        "PRJ-00126",
        ownerId,
        "Client Name",
        null,
        new Date("2026-11-26T14:00:00Z"),
      ),
      error => error.status === status,
    );
  }
});
