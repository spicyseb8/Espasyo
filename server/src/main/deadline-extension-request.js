import {
  getClientEditLockReason,
  getPhilippineDateTimeKey,
  getProjectStatus,
  isProjectDeadlineExpired,
} from "./project-workflow.js";

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function saveDeadlineExtensionRequest(
  db,
  projectId,
  ownerId,
  requestedByName,
  reason,
  requestedAt = new Date(),
) {
  const projectReference = db.collection("projects").doc(projectId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(projectReference);
    if (!snapshot.exists) throw requestError(404, "Project does not exist.");

    const project = snapshot.data();
    if (project.ownerId !== ownerId) {
      throw requestError(403, "You do not have access to this project.");
    }

    const nowInManila = getPhilippineDateTimeKey(requestedAt);
    const lockReason = getClientEditLockReason(project, nowInManila);
    const deadlineExpired = isProjectDeadlineExpired(project.deadline, nowInManila);
    const editableStatuses = ["available", "ongoing", "revision-requested"];
    if (
      !lockReason ||
      !deadlineExpired ||
      !editableStatuses.includes(getProjectStatus(project))
    ) {
      throw requestError(400, "A deadline extension can only be requested for an expired project deadline.");
    }

    if (project.deadlineExtensionRequest?.status === "pending") {
      throw requestError(409, "A deadline extension request is already pending.");
    }

    const deadlineExtensionRequest = {
      status: "pending",
      requestedBy: ownerId,
      requestedByName,
      reason,
      requestedAt,
    };
    transaction.update(projectReference, {
      deadlineExtensionRequest,
      updatedAt: requestedAt,
    });

    return {
      projectName: typeof project.projectName === "string" && project.projectName.trim()
        ? project.projectName.trim()
        : projectId,
      deadlineExtensionRequest,
    };
  });
}
