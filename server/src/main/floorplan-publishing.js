export function createPublishedFloorPlanRecord({
  projectId,
  projectName,
  ownerId,
  revision,
  deadline,
  jsonPath,
  createdBy,
  creatorName,
  timestamp,
}) {
  return {
    projectId,
    projectName,
    ownerId,
    schemaVersion: 1,
    workflowType: "admin-managed",
    structuralOwner: "admin",
    structuralStatus: "published",
    projectStatus: "available",
    structuralRevision: revision,
    publishedStructuralRevision: revision,
    deadline,
    clientDesignStarted: false,
    structureInitialized: true,
    jsonPath,
    createdBy,
    creatorName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function commitPublishedFloorPlan(transaction, {
  projectReference,
  assignmentReference,
  draftReference,
  projectRecord,
  projectId,
  ownerId,
  projectName,
  deadline,
  revision,
  actor,
  timestamp,
  deleteField,
  recordActivity,
}) {
  transaction.set(assignmentReference, {
    ownerId,
    projectId,
    status: "published",
    draftId: deleteField,
    updatedAt: timestamp,
  }, { merge: true });
  transaction.create(projectReference, projectRecord);
  recordActivity(transaction, projectId, actor, "floor-plan-published", {
    newValue: { projectName, deadline, ownerId, structuralRevision: revision },
  });
  recordActivity(transaction, projectId, actor, "project-assigned", {
    newValue: { ownerId, projectId },
  });
  transaction.set(draftReference, {
    projectName,
    publishedProjectId: projectId,
    publishedAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });
}
