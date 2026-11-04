export type ProjectBudgetStatus = "within" | "near" | "over";

export interface ProjectBudgetSummary {
    maximumBudget: number;
    totalEstimatedCost: number;
    remainingAmount: number;
    usagePercent: number;
    status: ProjectBudgetStatus;
}

export const PROJECT_BUDGET_ACTION_EVENT = "espasyo:project-budget-action";
export const PROJECT_BUDGET_NOTICE_DURATION_MS = 4500;

function hasAtMostTwoDecimalPlaces(value: number): boolean {
    const cents = value * 100;
    return Math.abs(cents - Math.round(cents)) <=
        Number.EPSILON * Math.max(1, Math.abs(cents)) * 2;
}

export function parseProjectBudget(value: string): number | null {
    const text = value.trim().replace(/^₱\s*/, "");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) {
        return null;
    }

    const amount = Number(text.replace(/,/g, ""));
    return isValidProjectBudget(amount) ? amount : null;
}

export function isValidProjectBudget(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= Number.MAX_SAFE_INTEGER / 100 &&
        hasAtMostTwoDecimalPlaces(value)
    );
}

export function getProjectBudgetSummary(
    maximumBudget: number | null | undefined,
    totalEstimatedCost: number
): ProjectBudgetSummary | null {
    if (
        !isValidProjectBudget(maximumBudget) ||
        !Number.isFinite(totalEstimatedCost) ||
        totalEstimatedCost < 0
    ) {
        return null;
    }

    const budgetCents = Math.round(maximumBudget * 100);
    const estimatedCostCents = Math.round(totalEstimatedCost * 100);
    const nearBudgetThresholdCents = Math.ceil(budgetCents * 0.9);

    return {
        maximumBudget,
        totalEstimatedCost,
        remainingAmount: maximumBudget - totalEstimatedCost,
        usagePercent: totalEstimatedCost / maximumBudget * 100,
        status: estimatedCostCents >= budgetCents
            ? "over"
            : estimatedCostCents >= nearBudgetThresholdCents
                ? "near"
                : "within"
    };
}

export function shouldShowBudgetStatusNotice(
    previousStatus: ProjectBudgetStatus | null | undefined,
    nextStatus: ProjectBudgetStatus | null,
    followsUserAction: boolean
): boolean {
    return (
        previousStatus !== undefined &&
        previousStatus !== nextStatus &&
        nextStatus !== null &&
        followsUserAction
    );
}
