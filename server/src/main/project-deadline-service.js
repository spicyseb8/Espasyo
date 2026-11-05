const DEADLINE_TIME_ZONE = "Asia/Manila";

export function isValidDeadlineValue(value) {
  if (typeof value !== "string") return false;
  const date = value.slice(0, 10);
  if (!isValidCalendarDeadline(date)) return false;
  if (value === date) return true;
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

export function isValidCalendarDeadline(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const isLeapYear =
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

export function getPhilippineDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEADLINE_TIME_ZONE,
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

export function getPhilippineDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEADLINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function validateDeadlineUpdate(value, today = getPhilippineDateKey()) {
  if (!isValidDeadlineValue(value)) {
    return {
      valid: false,
      message: "Deadline must be a valid Philippine date and time. Deadlines cannot be cleared.",
    };
  }

  if (value.slice(0, 10) <= today.slice(0, 10)) {
    return {
      valid: false,
      message: "A new deadline must be after today.",
    };
  }

  return { valid: true, deadline: value };
}

export function isDeadlineExpired(value, today = getPhilippineDateKey()) {
  if (!isValidDeadlineValue(value)) return false;
  const deadlineDate = value.slice(0, 10);
  const nowDate = today.slice(0, 10);
  if (deadlineDate !== nowDate) return deadlineDate < nowDate;
  return value.length > 10 && today.length > 10 && value <= today.slice(0, 16);
}

export async function saveProjectDeadline(db, projectId, deadline, actor, reason = "") {
  const projectReference = db.collection("projects").doc(projectId);
  const activityReference = db.collection("projectActivity").doc();
  return db.runTransaction(async (transaction) => {
    const projectSnapshot = await transaction.get(projectReference);
    if (!projectSnapshot.exists) return false;
    const previousDeadline = projectSnapshot.data().deadline ?? null;
    transaction.update(projectReference, {
      deadline,
      updatedAt: new Date(),
    });
    transaction.create(activityReference, {
      projectId,
      actorId: actor.uid,
      actorRole: actor.role,
      ...(typeof actor.name === "string" && actor.name.trim()
        ? { actorName: actor.name.trim() }
        : {}),
      action: previousDeadline ? "deadline-changed" : "deadline-created",
      previousValue: { deadline: previousDeadline },
      newValue: { deadline },
      ...(reason ? { description: reason } : {}),
      createdAt: new Date(),
    });
    return true;
  });
}
