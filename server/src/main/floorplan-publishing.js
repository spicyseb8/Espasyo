export function isDraftPublishSnapshotCurrent(initial, current) {
  return current.structuralRevision === initial.structuralRevision &&
    current.draftJsonPath === initial.draftJsonPath;
}

export function isProjectStructureSnapshotCurrent(initial, current) {
  return current.structuralRevision === initial.structuralRevision &&
    current.publishedStructuralRevision === initial.publishedStructuralRevision &&
    current.structuralStatus === initial.structuralStatus &&
    current.draftJsonPath === initial.draftJsonPath;
}

export function hasProjectIdCollision(projectSnapshot, assignmentSnapshot) {
  return projectSnapshot.exists || assignmentSnapshot.exists;
}

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
  draftAssignmentReference,
  projectAssignmentReference,
  draftReference,
  projectRecord,
  assignmentRecord,
  projectId,
  ownerId,
  projectName,
  deadline,
  revision,
  actor,
  timestamp,
  recordActivity,
}) {
  transaction.create(projectAssignmentReference, assignmentRecord);
  transaction.delete(draftAssignmentReference);
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
