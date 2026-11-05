export const FLOORPLAN_ALREADY_EXISTS_MESSAGE =
  "This client already has a floorplan. You can view the existing project, but cannot create another one.";

export async function createReservedFloorPlanDraft(
  db,
  {
    ownerId,
    draftId,
    draftRecord,
    assignmentReference,
    additionalOwnerIds = [],
    additionalAssignmentReferences = [],
  },
) {
  const ownerIds = [...new Set([ownerId, ...additionalOwnerIds])];
  const projectQueries = ownerIds.map(id => db.collection("projects")
    .where("ownerId", "==", id)
    .limit(1));
  const draftQueries = ownerIds.map(id => db.collection("adminManagedFloorPlanDrafts")
    .where("intendedClientId", "==", id)
    .limit(1));
  const reservationReferences = [
    assignmentReference,
    ...additionalAssignmentReferences,
  ];
  const draftReference = db.collection("adminManagedFloorPlanDrafts").doc(draftId);

  return db.runTransaction(async transaction => {
    const [assignments, projects, drafts] = await Promise.all([
      Promise.all(reservationReferences.map(reference => transaction.get(reference))),
      Promise.all(projectQueries.map(query => transaction.get(query))),
      Promise.all(draftQueries.map(query => transaction.get(query))),
    ]);
    if (
      assignments.some(assignment => assignment.exists) ||
      projects.some(snapshot => snapshot.docs.length > 0) ||
      drafts.some(snapshot => snapshot.docs.length > 0)
    ) {
      const error = new Error(FLOORPLAN_ALREADY_EXISTS_MESSAGE);
      error.status = 409;
      throw error;
    }

    transaction.create(assignmentReference, {
      ownerId,
      draftId,
      status: "draft",
    });
    transaction.create(draftReference, draftRecord);
  });
}
