export const ACCESS_AGREEMENT_VERSION = "2026-01";
export const SUBMISSION_AGREEMENT_VERSION = "2026-01";

export const PROJECT_STATUSES = [
  "available",
  "ongoing",
  "submitted",
  "revision-requested",
  "approved",
];

export function getProjectStatus(project) {
  if (PROJECT_STATUSES.includes(project.projectStatus)) {
    return project.projectStatus;
  }
  return project.clientDesignStarted === true ||
    Boolean(project.interiorJsonPath || project.interiorJsonUrl)
    ? "ongoing"
    : "available";
}

export function isFutureProjectDeadline(value, today) {
  return isValidProjectDeadline(value) && value.slice(0, 10) > today;
}

export function isProjectDeadlineExpired(value, nowInManila) {
  if (!isValidProjectDeadline(value)) return false;
  const deadlineDate = value.slice(0, 10);
  const nowDate = nowInManila.slice(0, 10);
  if (deadlineDate !== nowDate) return deadlineDate < nowDate;
  if (value.length === 10) return false;
  return value <= nowInManila.slice(0, 16);
}

export function isValidCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isValidProjectDeadline(value) {
  if (isValidCalendarDate(value)) return true;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return false;
  }
  return isValidCalendarDate(value.slice(0, 10));
}

export function getPhilippineDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export function canClientEditProject(project, today) {
  return getClientEditLockReason(project, today) === null;
}

export function getClientEditLockReason(project, today) {
  const status = getProjectStatus(project);
  if (!["available", "ongoing", "revision-requested"].includes(status)) {
    return "This project is locked during administrative review or after approval.";
  }
  if (!isValidProjectDeadline(project.deadline)) {
    return "An administrator must set a valid deadline before client editing can continue.";
  }
  if (isProjectDeadlineExpired(project.deadline, today)) {
    return "The project deadline has passed. Ask an administrator to extend it.";
  }
  return null;
}

export function canTransitionProject(status, action) {
  return status === "submitted" &&
    ["approve", "request-revision"].includes(action);
}

export function canContinueAdminStructureSave(initialProject, currentProject) {
  const initialStatus = getProjectStatus(initialProject);
  const currentStatus = getProjectStatus(currentProject);
  return initialStatus === currentStatus &&
    !["submitted", "approved"].includes(currentStatus);
}

export function isCurrentProjectAcknowledgement(
  acknowledgement,
  projectId,
  userId,
  agreementType,
  agreementVersion
) {
  return acknowledgement !== null &&
    typeof acknowledgement === "object" &&
    acknowledgement.projectId === projectId &&
    acknowledgement.userId === userId &&
    acknowledgement.agreementType === agreementType &&
    acknowledgement.agreementVersion === agreementVersion &&
    acknowledgement.accepted === true;
}
