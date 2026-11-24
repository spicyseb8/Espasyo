const ASSIGNMENTS = "adminManagedProjectAssignments";

export function planAssignmentReference(db, planId, planType) {
  if (planType !== "draft" && planType !== "project") {
    throw new Error("A managed plan assignment type is required.");
  }
  return db.collection(ASSIGNMENTS).doc(`${planType}_${encodeURIComponent(planId)}`);
}

export function createPlanAssignmentRecord({
  planId,
  planType,
  ownerId,
  createdBy,
  creatorName,
  createdAt,
  updatedAt,
}) {
  const isDraft = planType === "draft";
  return {
    ownerId,
    [isDraft ? "draftId" : "projectId"]: planId,
    status: isDraft ? "draft" : "published",
    createdBy,
    creatorName,
    createdAt,
    updatedAt,
  };
}

function isMatchingAssignment(snapshot, planId, ownerId, planType) {
  if (!snapshot.exists) return false;
  const data = snapshot.data() ?? {};
  return data.ownerId === ownerId &&
    data[planType === "draft" ? "draftId" : "projectId"] === planId;
}

export async function getAssignmentForPlan(
  db,
  planId,
  ownerId,
  {
    planType = "project",
    legacyOwnerIds = [],
    transaction,
  } = {},
) {
  const read = reference => transaction
    ? transaction.get(reference)
    : reference.get();
  const planReference = planAssignmentReference(db, planId, planType);
  const planSnapshot = await read(planReference);
  if (isMatchingAssignment(planSnapshot, planId, ownerId, planType)) {
    return planSnapshot;
  }

  const legacyIds = [...new Set([ownerId, ...legacyOwnerIds]
    .filter(value => typeof value === "string" && value.trim()))];
  const legacySnapshots = await Promise.all(legacyIds.map(id =>
    read(db.collection(ASSIGNMENTS).doc(encodeURIComponent(id)))
  ));
  return legacySnapshots.find(snapshot =>
    isMatchingAssignment(snapshot, planId, ownerId, planType)
  ) ?? planSnapshot;
}
