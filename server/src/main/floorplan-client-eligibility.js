const ADMIN_ROLES = new Set(["admin", "superadmin", "employee"]);

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function recordOwner(record) {
  return normalizedString(record.ownerId) ||
    normalizedString(record.intendedClientId) ||
    normalizedString(record.intendedClientAccountId);
}

function belongsToClient(record, identifiers) {
  const ownerId = recordOwner(record);
  return !ownerId || identifiers.has(ownerId);
}

export function isFloorPlanClientAccount(data, identifiers, employeeIdentifiers) {
  if (!data || identifiers.some(id => employeeIdentifiers.has(id))) return false;
  const role = normalizedString(data.role).toLowerCase();
  return !ADMIN_ROLES.has(role);
}

export function findExistingFloorPlan({
  identifiers,
  projects,
  drafts,
  assignments,
}) {
  const ownerIds = new Set(identifiers);
  const projectById = new Map(projects.map(project => [project.id, project]));
  const draftById = new Map(drafts.map(draft => [draft.id, draft]));

  const directProject = projects.find(project =>
    ownerIds.has(normalizedString(project.ownerId))
  );
  const directDraft = drafts.find(draft =>
    (
      !normalizedString(draft.publishedProjectId) ||
      !projectById.has(normalizedString(draft.publishedProjectId))
    ) &&
    ownerIds.has(normalizedString(draft.intendedClientId))
  );

  let assignedProjectId;
  let assignedDraftId;
  for (const assignment of assignments) {
    if (!ownerIds.has(normalizedString(assignment.ownerId))) continue;

    const projectId = normalizedString(assignment.projectId);
    const project = projectById.get(projectId);
    if (project && belongsToClient(project, ownerIds)) {
      assignedProjectId ??= projectId;
    }

    const draftId = normalizedString(assignment.draftId);
    const draft = draftById.get(draftId);
    if (draft && belongsToClient(draft, ownerIds)) {
      assignedDraftId ??= draftId;
    }
  }

  return {
    projectId: directProject?.id ?? assignedProjectId ?? null,
    draftId: directDraft?.id ?? assignedDraftId ?? null,
  };
}
