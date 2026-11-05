
const TIME_ZONE = "Asia/Manila";

let activeProjectId: string | null = null;
let activeDeadline: string | null = null;

const listeners = new Set<() => void>();

function notifyListeners(): void {
    listeners.forEach(listener => listener());
}

export function isValidProjectDeadline(
    value: unknown
): value is string {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value.slice(0, 10)
        .split("-")
        .map(Number);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

export function getPhilippineDateKey(
    date: Date = new Date()
): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const year = parts.find(part => part.type === "year")?.value;
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

export function getDaysUntilProjectDeadline(
    deadline: string
): number {
    const today = getPhilippineDateKey();
    return Math.round(
        (Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`) -
            Date.parse(`${today}T00:00:00Z`)) /
            86_400_000
    );
}

export function isDeadlinePassed(
    deadline: unknown
): boolean {
    if (!isValidProjectDeadline(deadline)) {
        return false;
    }

    const deadlineDate = deadline.slice(0, 10);
    if (getPhilippineDateKey() !== deadlineDate) {
        return getPhilippineDateKey() > deadlineDate;
    }
    if (deadline.length === 10) return false;
    return Date.now() >= Date.parse(`${deadline}:00+08:00`);
}

export function formatProjectDeadline(value: string): string {
    const date = value.length === 10
        ? new Date(`${value}T00:00:00+08:00`)
        : new Date(`${value}:00+08:00`);
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: TIME_ZONE,
        dateStyle: "medium",
        ...(value.length > 10 ? { timeStyle: "short" as const } : {}),
    }).format(date);
}

export function setActiveProjectDeadline(
    projectId: string,
    deadline: unknown
): void {
    activeProjectId = projectId;
    activeDeadline = isValidProjectDeadline(deadline)
        ? deadline
        : null;

    notifyListeners();
}

export function clearActiveProjectDeadline(
    projectId?: string
): void {
    // Avoid clearing a different project if its loader
    // has already replaced this one.
    if (
        projectId &&
        activeProjectId !== projectId
    ) {
        return;
    }

    activeProjectId = null;
    activeDeadline = null;

    notifyListeners();
}

export function isProjectReadOnlyByDeadline(): boolean {
    return isDeadlinePassed(activeDeadline);
}
export function getActiveProjectDeadline(): string | null {
    return activeDeadline;
}
export function subscribeToProjectDeadline(
    listener: () => void
): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}
