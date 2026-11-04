import { useEffect, useMemo, useRef, useState } from "react";

import useEditor from "../context/editor/useEditor";
import { calculateCostEstimate } from "../engine/cost/CostEstimator";
import {
    getProjectBudgetSummary,
    PROJECT_BUDGET_ACTION_EVENT,
    PROJECT_BUDGET_NOTICE_DURATION_MS,
    shouldShowBudgetStatusNotice,
    type ProjectBudgetStatus
} from "../engine/cost/ProjectBudget";

interface BudgetNotice {
    id: number;
    status: ProjectBudgetStatus;
    message: string;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

export default function BudgetWarning() {
    const { state } = useEditor();
    const estimate = useMemo(() => calculateCostEstimate(state), [state]);
    const summary = useMemo(
        () => getProjectBudgetSummary(state.projectBudget, estimate.total),
        [state.projectBudget, estimate.total]
    );
    const incomplete = (estimate.incompleteItems?.length ?? 0) > 0;
    const previousStatus = useRef<ProjectBudgetStatus | null | undefined>(undefined);
    const relevantAction = useRef(false);
    const noticeId = useRef(0);
    const [notice, setNotice] = useState<BudgetNotice | null>(null);

    useEffect(() => {
        const handleBudgetAction = (event: Event) => {
            relevantAction.current =
                event instanceof CustomEvent && event.detail === true;
        };
        window.addEventListener(PROJECT_BUDGET_ACTION_EVENT, handleBudgetAction);
        return () => {
            window.removeEventListener(PROJECT_BUDGET_ACTION_EVENT, handleBudgetAction);
        };
    }, []);

    useEffect(() => {
        const nextStatus = summary?.status ?? null;
        const previous = previousStatus.current;
        previousStatus.current = nextStatus;

        if (
            !shouldShowBudgetStatusNotice(
                previous,
                nextStatus,
                relevantAction.current
            ) ||
            !summary ||
            !nextStatus
        ) {
            relevantAction.current = false;
            return;
        }

        const qualification = incomplete
            ? " Estimate may be incomplete."
            : "";
        const message = nextStatus === "over"
            ? `${formatCurrency(Math.abs(summary.remainingAmount))} over budget.${qualification}`
            : nextStatus === "near"
                ? `Approaching the project budget limit.${qualification}`
                : `Project is within budget.${qualification}`;

        noticeId.current += 1;
        setNotice({
            id: noticeId.current,
            status: nextStatus,
            message
        });
        relevantAction.current = false;
    }, [state, summary, incomplete]);

    useEffect(() => {
        if (!notice) return;

        const clearTimer = window.setTimeout(
            () => setNotice(null),
            PROJECT_BUDGET_NOTICE_DURATION_MS
        );
        return () => window.clearTimeout(clearTimer);
    }, [notice]);

    if (!notice) return null;

    return (
        <div
            key={notice.id}
            className={`budget-warning ${notice.status}`}
            role="status"
            aria-live="polite"
        >
            {notice.message}
        </div>
    );
}
