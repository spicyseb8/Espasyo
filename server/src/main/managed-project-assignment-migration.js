import {
  createPlanAssignmentRecord,
  planAssignmentReference,
} from "./managed-project-assignment.js";

const ASSIGNMENTS = "adminManagedProjectAssignments";

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlanAssignmentDocument(db, document) {
  const data = document.data() ?? {};
  const projectId = normalizedString(data.projectId);
  const draftId = normalizedString(data.draftId);
  return (
    (projectId &&
      document.id === planAssignmentReference(db, projectId, "project").id) ||
    (draftId &&
      document.id === planAssignmentReference(db, draftId, "draft").id)
  );
}

function getPlanCandidates(data) {
  return [
    { planId: normalizedString(data.projectId), planType: "project" },
    { planId: normalizedString(data.draftId), planType: "draft" },
  ].filter(candidate => candidate.planId);
}

async function getPlanData(db, { planId, planType }) {
  const collectionName = planType === "project"
    ? "projects"
    : "adminManagedFloorPlanDrafts";
  const snapshot = await db.collection(collectionName).doc(planId).get();
  return snapshot.exists ? snapshot.data() ?? {} : null;
}

function createMigratedAssignment({
  planId,
  planType,
  planData,
  legacyData,
  ownerId,
  now,
}) {
  return createPlanAssignmentRecord({
    planId,
    planType,
    ownerId,
    createdBy: normalizedString(planData.createdBy) ||
      normalizedString(legacyData.createdBy) || null,
    creatorName: normalizedString(planData.creatorName) ||
      normalizedString(legacyData.creatorName) || null,
    createdAt: planData.createdAt ?? legacyData.createdAt ?? now,
    updatedAt: planData.updatedAt ?? legacyData.updatedAt ?? now,
  });
}

function matchesAssignment(snapshot, planId, planType, ownerId) {
  if (!snapshot.exists) return false;
  const data = snapshot.data() ?? {};
  return data.ownerId === ownerId &&
    data[planType === "project" ? "projectId" : "draftId"] === planId;
}

export async function migrateManagedProjectAssignments(
  db,
  { apply = false, now = new Date() } = {},
) {
  const snapshot = await db.collection(ASSIGNMENTS).get();
  const result = {
    legacyDocuments: 0,
    plans: 0,
    wouldCreate: 0,
    created: 0,
    alreadyExists: 0,
    skipped: 0,
    conflicts: 0,
  };

  for (const document of snapshot.docs) {
    if (isPlanAssignmentDocument(db, document)) continue;
    result.legacyDocuments += 1;
    const legacyData = document.data() ?? {};
    const candidates = getPlanCandidates(legacyData);
    if (!candidates.length) {
      result.skipped += 1;
      continue;
    }

    for (const candidate of candidates) {
      result.plans += 1;
      const planData = await getPlanData(db, candidate);
      if (!planData) {
        result.skipped += 1;
        continue;
      }

      const ownerId = normalizedString(legacyData.ownerId);
      const planOwnerId = normalizedString(
        planData.ownerId ?? planData.intendedClientId,
      );
      if (!ownerId || ownerId !== planOwnerId) {
        result.skipped += 1;
        continue;
      }
      if (candidate.planType === "draft" && planData.publishedProjectId) {
        result.skipped += 1;
        continue;
      }

      const reference = planAssignmentReference(
        db,
        candidate.planId,
        candidate.planType,
      );
      const record = createMigratedAssignment({
        ...candidate,
        planData,
        legacyData,
        ownerId,
        now,
      });

      if (apply) {
        const outcome = await db.runTransaction(async transaction => {
          const existing = await transaction.get(reference);
          if (existing.exists) {
            return matchesAssignment(
              existing,
              candidate.planId,
              candidate.planType,
              ownerId,
            ) ? "alreadyExists" : "conflicts";
          }
          transaction.create(reference, record);
          return "created";
        });
        result[outcome] += 1;
      } else {
        const existing = await reference.get();
        if (existing.exists) {
          result[matchesAssignment(
            existing,
            candidate.planId,
            candidate.planType,
            ownerId,
          ) ? "alreadyExists" : "conflicts"] += 1;
        } else {
          result.wouldCreate += 1;
        }
      }
    }
  }

  return result;
}
