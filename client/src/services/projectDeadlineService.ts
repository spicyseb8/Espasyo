
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
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value
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

export function isDeadlinePassed(
    deadline: unknown
): boolean {
    if (!isValidProjectDeadline(deadline)) {
        return false;
    }

    // The deadline remains valid for the entire deadline date.
    return getPhilippineDateKey() > deadline;
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
