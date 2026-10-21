const DEADLINE_TIME_ZONE = "Asia/Manila";

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
  if (value === null) {
    return { valid: true, deadline: null };
  }

  if (!isValidCalendarDeadline(value)) {
    return {
      valid: false,
      message: "Deadline must be a valid YYYY-MM-DD calendar date or null.",
    };
  }

  if (value < today) {
    return {
      valid: false,
      message: "A new deadline must be today or a future date.",
    };
  }

  return { valid: true, deadline: value };
}

export function isDeadlineExpired(value, today = getPhilippineDateKey()) {
  return isValidCalendarDeadline(value) && value < today;
}

export async function saveProjectDeadline(db, projectId, deadline) {
  const projectReference = db.collection("projects").doc(projectId);
  const projectSnapshot = await projectReference.get();

  if (!projectSnapshot.exists) {
    return false;
  }

  await projectReference.update({
    deadline,
    updatedAt: new Date(),
  });

  return true;
}
