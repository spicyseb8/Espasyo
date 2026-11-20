export function getManilaDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required.");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getManilaDateBounds(date = new Date()) {
  const dayKey = getManilaDateKey(date);
  const start = new Date(`${dayKey}T00:00:00+08:00`);
  return {
    dayKey,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}
