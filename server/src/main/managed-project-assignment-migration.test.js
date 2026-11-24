import test from "node:test";
import assert from "node:assert/strict";
import { migrateManagedProjectAssignments } from "./managed-project-assignment-migration.js";

class InMemoryFirestore {
  constructor(seed = {}) {
    this.documents = new Map(
      Object.entries(seed).map(([path, data]) => [path, structuredClone(data)]),
    );
    this.writeCount = 0;
  }

  collection(name) {
    return {
      doc: id => this.documentReference(name, id),
      get: async () => {
        const prefix = `${name}/`;
        const docs = [...this.documents.entries()]
          .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
          .map(([path, data]) => ({
            id: path.slice(prefix.length),
            data: () => structuredClone(data),
          }));
        return { docs };
      },
    };
  }

  snapshot(path) {
    const data = this.documents.get(path);
    return {
      exists: data !== undefined,
      data: () => data === undefined ? undefined : structuredClone(data),
    };
  }

  async runTransaction(callback) {
    return callback({
      get: async reference => this.snapshot(`${reference.collection}/${reference.id}`),
      create: (reference, data) => {
        const path = `${reference.collection}/${reference.id}`;
        if (this.documents.has(path)) throw new Error(`Document already exists: ${path}`);
        this.documents.set(path, structuredClone(data));
        this.writeCount += 1;
      },
    });
  }

  documentReference(collection, id) {
    const path = `${collection}/${id}`;
    return {
      id,
      collection,
      get: async () => this.snapshot(path),
    };
  }
}

function createLegacyData() {
  const createdAt = new Date("2025-01-02T03:04:05.000Z");
  return {
    "adminManagedProjectAssignments/client-uid": {
      ownerId: "client-uid",
      projectId: "project-1",
    },
    "adminManagedProjectAssignments/account-document-id": {
      ownerId: "client-uid",
      draftId: "draft-1",
    },
    "projects/project-1": {
      projectId: "project-1",
      ownerId: "client-uid",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt,
      updatedAt: createdAt,
    },
    "adminManagedFloorPlanDrafts/draft-1": {
      draftId: "draft-1",
      intendedClientId: "client-uid",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt,
      updatedAt: createdAt,
    },
  };
}

test("assignment migration defaults to dry-run and is idempotent when applied twice", async () => {
  const db = new InMemoryFirestore(createLegacyData());
  const originalAssignments = [...db.documents.entries()]
    .filter(([path]) => path.startsWith("adminManagedProjectAssignments/"));

  const dryRun = await migrateManagedProjectAssignments(db);
  assert.equal(dryRun.wouldCreate, 2);
  assert.equal(dryRun.created, 0);
  assert.equal(db.writeCount, 0);
  assert.deepEqual(
    [...db.documents.entries()].filter(([path]) =>
      path.startsWith("adminManagedProjectAssignments/")),
    originalAssignments,
  );

  const applied = await migrateManagedProjectAssignments(db, { apply: true });
  assert.equal(applied.created, 2);
  assert.equal(applied.conflicts, 0);
  assert.equal(db.writeCount, 2);
  assert.deepEqual(
    db.snapshot("adminManagedProjectAssignments/project_project-1").data(),
    {
      ownerId: "client-uid",
      projectId: "project-1",
      status: "published",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt: new Date("2025-01-02T03:04:05.000Z"),
      updatedAt: new Date("2025-01-02T03:04:05.000Z"),
    },
  );
  assert.deepEqual(
    db.snapshot("adminManagedProjectAssignments/draft_draft-1").data(),
    {
      ownerId: "client-uid",
      draftId: "draft-1",
      status: "draft",
      createdBy: "admin-uid",
      creatorName: "Admin",
      createdAt: new Date("2025-01-02T03:04:05.000Z"),
      updatedAt: new Date("2025-01-02T03:04:05.000Z"),
    },
  );

  const rerun = await migrateManagedProjectAssignments(db, { apply: true });
  assert.equal(rerun.created, 0);
  assert.equal(rerun.alreadyExists, 2);
  assert.equal(db.writeCount, 2);
  assert.equal(
    db.documents.has("adminManagedProjectAssignments/client-uid"),
    true,
  );
  assert.equal(
    db.documents.has("adminManagedProjectAssignments/account-document-id"),
    true,
  );
});

test("migration skips published historical drafts and reports assignment conflicts", async () => {
  const db = new InMemoryFirestore({
    ...createLegacyData(),
    "adminManagedFloorPlanDrafts/draft-1": {
      draftId: "draft-1",
      intendedClientId: "client-uid",
      publishedProjectId: "project-1",
    },
    "adminManagedProjectAssignments/project_project-1": {
      ownerId: "someone-else",
      projectId: "project-1",
    },
  });

  const result = await migrateManagedProjectAssignments(db, { apply: true });
  assert.equal(result.conflicts, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);
  assert.equal(
    db.documents.has("adminManagedProjectAssignments/project_project-1"),
    true,
  );
});
