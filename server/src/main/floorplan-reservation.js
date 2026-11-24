import {
  createPlanAssignmentRecord,
  planAssignmentReference,
} from "./managed-project-assignment.js";

export async function createReservedFloorPlanDraft(
  db,
  {
    ownerId,
    draftId,
    draftRecord,
  },
) {
  const draftReference = db.collection("adminManagedFloorPlanDrafts").doc(draftId);
  const assignmentReference = planAssignmentReference(db, draftId, "draft");

  return db.runTransaction(async transaction => {
    const [draftSnapshot, assignmentSnapshot] = await Promise.all([
      transaction.get(draftReference),
      transaction.get(assignmentReference),
    ]);
    if (draftSnapshot.exists || assignmentSnapshot.exists) {
      const error = new Error("The generated floor-plan draft ID is already in use.");
      error.status = 409;
      throw error;
    }

    transaction.create(assignmentReference, createPlanAssignmentRecord({
      planId: draftId,
      planType: "draft",
      ownerId,
      createdBy: draftRecord.createdBy,
      creatorName: draftRecord.creatorName,
      createdAt: draftRecord.createdAt,
      updatedAt: draftRecord.updatedAt,
    }));
    transaction.create(draftReference, draftRecord);
  });
}
