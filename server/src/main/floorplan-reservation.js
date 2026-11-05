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
    const assignmentTargetReferences = assignments.flatMap(assignment => {
      if (!assignment.exists) return [];
      const data = assignment.data() ?? {};
      return [
        ...(typeof data.projectId === "string" && data.projectId.trim()
          ? [db.collection("projects").doc(data.projectId.trim())]
          : []),
        ...(typeof data.draftId === "string" && data.draftId.trim()
          ? [db.collection("adminManagedFloorPlanDrafts").doc(data.draftId.trim())]
          : []),
      ];
    });
    const assignmentTargets = await Promise.all(
      assignmentTargetReferences.map(reference => transaction.get(reference)),
    );
    let targetIndex = 0;
    const hasExistingAssignment = assignments.some(assignment => {
      if (!assignment.exists) return false;
      const data = assignment.data() ?? {};
      const assignmentOwnerId = typeof data.ownerId === "string" ? data.ownerId.trim() : "";
      const linkedProject = typeof data.projectId === "string" && data.projectId.trim()
        ? assignmentTargets[targetIndex++]
        : null;
      const linkedDraft = typeof data.draftId === "string" && data.draftId.trim()
        ? assignmentTargets[targetIndex++]
        : null;
      if (assignmentOwnerId && !ownerIds.includes(assignmentOwnerId)) return false;
      const projectOwnerId = linkedProject?.exists &&
        typeof linkedProject.data()?.ownerId === "string"
        ? linkedProject.data().ownerId.trim()
        : "";
      const draftOwnerId = linkedDraft?.exists &&
        typeof linkedDraft.data()?.intendedClientId === "string"
        ? linkedDraft.data().intendedClientId.trim()
        : "";
      return Boolean(
        (linkedProject?.exists && (!projectOwnerId || ownerIds.includes(projectOwnerId))) ||
        (linkedDraft?.exists && (!draftOwnerId || ownerIds.includes(draftOwnerId))),
      );
    });
    if (
      hasExistingAssignment ||
      projects.some(snapshot => snapshot.docs.length > 0) ||
      drafts.some(snapshot => snapshot.docs.length > 0)
    ) {
      const error = new Error(FLOORPLAN_ALREADY_EXISTS_MESSAGE);
      error.status = 409;
      throw error;
    }

    transaction.set(assignmentReference, {
      ownerId,
      draftId,
      status: "draft",
    });
    transaction.create(draftReference, draftRecord);
  });
}
