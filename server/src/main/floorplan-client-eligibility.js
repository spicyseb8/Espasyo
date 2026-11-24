const ADMIN_ROLES = new Set(["admin", "superadmin", "employee"]);

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isFloorPlanClientAccount(data, identifiers, employeeIdentifiers) {
  if (!data || identifiers.some(id => employeeIdentifiers.has(id))) return false;
  const role = normalizedString(data.role).toLowerCase();
  return !ADMIN_ROLES.has(role);
}

export function countExistingFloorPlans({
  identifiers,
  projects,
  drafts,
}) {
  const ownerIds = new Set(identifiers);
  const ownedProjects = projects.filter(project =>
    ownerIds.has(normalizedString(project.ownerId))
  );
  const projectIds = new Set(ownedProjects
    .map(project => normalizedString(project.id) || normalizedString(project.projectId))
    .filter(Boolean));
  const publishedProjectIds = new Set(ownedProjects.flatMap(project =>
    [normalizedString(project.id), normalizedString(project.projectId)]
      .filter(Boolean)
  ));
  const draftIds = new Set(drafts
    .filter(draft => ownerIds.has(normalizedString(draft.intendedClientId)))
    .filter(draft => !publishedProjectIds.has(normalizedString(draft.publishedProjectId)))
    .map(draft => normalizedString(draft.id))
    .filter(Boolean));

  return projectIds.size + draftIds.size;
}
