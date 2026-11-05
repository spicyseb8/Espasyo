import "./Topbar.css";

import { ArrowLeft, ChevronDown, Download, Undo2, Redo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";

import useEditor from "../../context/editor/useEditor";
import { calculateCostEstimate } from "../../engine/cost/CostEstimator";
import { downloadCostBreakdownPdf } from "../../engine/cost/CostBreakdownPDF";
import {
    getProjectBudgetSummary,
    parseProjectBudget
} from "../../engine/cost/ProjectBudget";
import type { CostCategory } from "../../engine/cost/CostTypes";
import AdminComments from "../../scene/Comment/AdminComments";

const CATEGORY_LABELS: Record<CostCategory, string> = {
    furniture: "Furniture",
    flooring: "Flooring",
    wallFinish: "Wall finish",
    doors: "Doors",
    windows: "Windows"
};

const CATEGORY_ORDER: CostCategory[] = [
    "furniture",
    "flooring",
    "wallFinish",
    "doors",
    "windows"
];

const formatCurrency = (amount: number, decimals = 2) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);

export default function Topbar() {
    const { state, dispatch, undo, redo, canUndo, canRedo } = useEditor();

    const { projectId: routeProjectId } = useParams<{ projectId?: string }>();

    const [open, setOpen] = useState(false);
    const [expandedFloorIds, setExpandedFloorIds] = useState<string[]>([]);
    const [budgetExpanded, setBudgetExpanded] = useState(true);
    const [budgetEditing, setBudgetEditing] = useState(false);
    const [budgetDraft, setBudgetDraft] = useState("");
    const [budgetError, setBudgetError] = useState("");
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const [projectName, setProjectName] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem("espasyo_project_name") || "";
    });

    useEffect(() => {
        localStorage.setItem("espasyo_project_name", projectName);
    }, [projectName]);

    const handleProjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
        setProjectName(event.target.value);
    };

    const estimate = useMemo(() => calculateCostEstimate(state), [state]);
    const budgetSummary = useMemo(
        () => getProjectBudgetSummary(state.projectBudget, estimate.total),
        [state.projectBudget, estimate.total]
    );
    const hasIncompleteEstimate = (estimate.incompleteItems?.length ?? 0) > 0;
    const budgetStatusLabel = budgetSummary
        ? budgetSummary.status === "over"
            ? "Over Budget"
            : budgetSummary.status === "near"
                ? "Near Budget"
                : "Within Budget"
        : "No budget set";

    const furnitureCount = state.floors.length > 0
        ? state.floors.reduce((count, floor) => count + floor.furniture.length, 0)
        : state.furniture.length;

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, []);

    const handleDownloadReport = () => {
        try {
            downloadCostBreakdownPdf(estimate, projectName, routeProjectId);

            setOpen(false);
        } catch (error) {
            console.error("Failed to generate cost breakdown PDF:", error);

            window.alert(
                "Unable to generate the cost breakdown report. Please try again."
            );
        }
    };

    const toggleFloor = (floorId: string) => {
        setExpandedFloorIds(current =>
            current.includes(floorId)
                ? current.filter(id => id !== floorId)
                : [...current, floorId]
        );
    };

    const startBudgetEdit = () => {
        setBudgetDraft(
            state.projectBudget === null
                ? ""
                : String(state.projectBudget)
        );
        setBudgetError("");
        setBudgetEditing(true);
    };

    const saveBudget = () => {
        const maximumBudget = parseProjectBudget(budgetDraft);
        if (maximumBudget === null) {
            setBudgetError("Enter a valid budget greater than ₱0.");
            return;
        }
        dispatch({ type: "SET_PROJECT_BUDGET", payload: maximumBudget });
        setBudgetEditing(false);
        setBudgetError("");
    };

    const cancelBudgetEdit = () => {
        setBudgetEditing(false);
        setBudgetDraft("");
        setBudgetError("");
    };

    const removeBudget = () => {
        dispatch({ type: "SET_PROJECT_BUDGET", payload: null });
        cancelBudgetEdit();
    };

    return (
        <header className="topbar">
            {/* Left — back to Studio */}
            <div className="topbar-left">
                <Link
                    to="/studio"
                    className="topbar-back"
                    title="Back to Studio"
                    aria-label="Back to Studio"
                >
                    <ArrowLeft size={15} strokeWidth={1.75} />
                    <span>Studio</span>
                </Link>
                <nav className="floor-tabs" aria-label="Project floors">
                    {(state.floors.length > 0
                        ? state.floors
                        : [{ floorId: state.activeFloorId, name: "1st Floor" }]
                    ).map((floor, index) => (
                        <button
                            key={floor.floorId}
                            type="button"
                            className={`floor-tab${floor.floorId === state.activeFloorId ? " active" : ""}`}
                            aria-pressed={floor.floorId === state.activeFloorId}
                            onClick={() => dispatch({
                                type: "SWITCH_FLOOR",
                                payload: floor.floorId
                            })}
                        >
                            {floor.name || `${index + 1} Floor`}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Center — project name */}
            <div className="topbar-center">
                <input
                    type="text"
                    className="project-title-input"
                    placeholder="Untitled project"
                    value={projectName}
                    onChange={handleProjectNameChange}
                    aria-label="Project name"
                    spellCheck={false}
                />
            </div>

            {/* Right — history, comments, estimate */}
            <div className="topbar-actions">
                <div className="history-group" role="group" aria-label="History">
                    <button
                        type="button"
                        className="history-button"
                        onClick={undo}
                        disabled={!canUndo || state.projectLocked}
                        title="Undo"
                        aria-label="Undo"
                    >
                        <Undo2 size={15} strokeWidth={1.75} />
                    </button>

                    <button
                        type="button"
                        className="history-button"
                        onClick={redo}
                        disabled={!canRedo || state.projectLocked}
                        title="Redo"
                        aria-label="Redo"
                    >
                        <Redo2 size={15} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="admin-comments-icon-only">
                    <AdminComments projectId={routeProjectId ?? null} />
                </div>

                <div className="cost-estimator" ref={dropdownRef}>
                    <button
                        type="button"
                        className="cost-estimator-button"
                        onClick={() => setOpen((value) => !value)}
                        aria-expanded={open}
                        aria-haspopup="true"
                    >
                        <span className="cost-estimator-label">Estimate</span>
                        <span className="cost-estimator-amount">
                            {formatCurrency(estimate.total)}
                        </span>
                        <ChevronDown
                            size={14}
                            strokeWidth={1.75}
                            className={open ? "cost-chevron open" : "cost-chevron"}
                        />
                    </button>

                    {open && (
                        <div className="cost-estimator-dropdown">
                            <div className="cost-estimator-header">
                                <p className="cost-eyebrow">Cost estimate</p>
                                <p className="cost-summary">
                                    {furnitureCount} furniture{" "}
                                    {furnitureCount !== 1 ? "items" : "item"} ·{" "}
                                    {estimate.items.length} cost{" "}
                                    {estimate.items.length !== 1 ? "items" : "item"}
                                </p>
                            </div>

                            <div className="cost-estimator-list">
                                <section className="project-budget-section">
                                    <button
                                        type="button"
                                        className="project-budget-header"
                                        aria-expanded={budgetExpanded}
                                        aria-controls="project-budget-details"
                                        onClick={() => setBudgetExpanded(value => !value)}
                                    >
                                        <span className="project-budget-heading">
                                            <ChevronDown
                                                size={13}
                                                className={budgetExpanded ? "open" : ""}
                                            />
                                            Project Budget
                                        </span>
                                        <span
                                            className={`project-budget-compact${budgetSummary ? ` ${budgetSummary.status}` : ""}`}
                                            title={hasIncompleteEstimate
                                                ? "The estimate has missing or invalid prices."
                                                : undefined}
                                        >
                                            {budgetSummary
                                                ? `${budgetStatusLabel} · ${formatCurrency(state.projectBudget ?? 0)}${hasIncompleteEstimate ? " · incomplete" : ""}`
                                                : budgetStatusLabel}
                                        </span>
                                    </button>
                                    {budgetExpanded && (
                                        <div
                                            className="project-budget-details"
                                            id="project-budget-details"
                                        >
                                            {budgetEditing ? (
                                                <div className="project-budget-form">
                                                    <label htmlFor="project-budget-input">
                                                        Maximum budget
                                                    </label>
                                                    <div className="project-budget-entry">
                                                        <span>₱</span>
                                                        <input
                                                            id="project-budget-input"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={budgetDraft}
                                                            onChange={event => {
                                                                setBudgetDraft(event.target.value);
                                                                setBudgetError("");
                                                            }}
                                                            placeholder="e.g. 500,000"
                                                        />
                                                    </div>
                                                    {budgetError && (
                                                        <p className="project-budget-message" role="alert">
                                                            {budgetError}
                                                        </p>
                                                    )}
                                                    <div className="project-budget-actions">
                                                        <button
                                                            type="button"
                                                            className="primary"
                                                            onClick={saveBudget}
                                                        >
                                                            Save Budget
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelBudgetEdit}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : budgetSummary ? (
                                                <>
                                                    <div className="project-budget-status-row">
                                                        <span>Maximum budget</span>
                                                        <strong>{formatCurrency(budgetSummary.maximumBudget)}</strong>
                                                    </div>
                                                    <div className={`project-budget-status ${budgetSummary.status}`}>
                                                        <div className="project-budget-status-row">
                                                            <strong>{budgetStatusLabel}</strong>
                                                            <span>{formatCurrency(estimate.total)} estimated</span>
                                                        </div>
                                                        <div
                                                            className="project-budget-meter"
                                                            role="progressbar"
                                                            aria-label="Budget usage"
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                            aria-valuenow={Math.min(100, Math.round(budgetSummary.usagePercent))}
                                                        >
                                                            <span
                                                                style={{
                                                                    width: `${Math.min(100, Math.max(0, budgetSummary.usagePercent))}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <p>
                                                            {budgetSummary.status === "over"
                                                                ? `${formatCurrency(Math.abs(budgetSummary.remainingAmount))} over budget`
                                                                : `${formatCurrency(budgetSummary.remainingAmount)} remaining`}
                                                        </p>
                                                    </div>
                                                    {hasIncompleteEstimate && (
                                                        <p className="project-budget-incomplete" role="status">
                                                            Estimate incomplete: missing or invalid prices for{" "}
                                                            {estimate.incompleteItems?.join(", ")}. Actual costs may be higher.
                                                        </p>
                                                    )}
                                                    <div className="project-budget-actions">
                                                        <button type="button" className="primary" onClick={startBudgetEdit}>
                                                            Edit Budget
                                                        </button>
                                                        <button type="button" className="remove" onClick={removeBudget}>
                                                            Remove Budget
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="project-budget-empty">
                                                        Set one budget for the entire project.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="project-budget-set"
                                                        onClick={startBudgetEdit}
                                                    >
                                                        Set Budget
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </section>

                                {estimate.floors.length === 0 ? (
                                    <div className="cost-empty">
                                        No cost items yet. Add furniture or finishes to see your
                                        estimate.
                                    </div>
                                ) : (
                                    estimate.floors.map(floor => {
                                        const isExpanded = expandedFloorIds.includes(floor.floorId);
                                        return (
                                            <section className="cost-floor" key={floor.floorId}>
                                                <button
                                                    type="button"
                                                    className="cost-floor-header"
                                                    aria-expanded={isExpanded}
                                                    onClick={() => toggleFloor(floor.floorId)}
                                                >
                                                    <span className="cost-floor-name">
                                                        <ChevronDown
                                                            size={13}
                                                            className={isExpanded ? "open" : ""}
                                                        />
                                                        {floor.name}
                                                    </span>
                                                    <strong>{formatCurrency(floor.subtotal)}</strong>
                                                </button>
                                                {isExpanded && (
                                                    <div className="cost-floor-details">
                                                        {floor.items.length === 0 ? (
                                                            <p className="cost-floor-empty">
                                                                No cost items on this floor.
                                                            </p>
                                                        ) : CATEGORY_ORDER.map(category => {
                                                            const items = floor.items.filter(
                                                                item => item.category === category
                                                            );
                                                            if (items.length === 0) return null;
                                                            const categoryTotal = items.reduce(
                                                                (sum, item) => sum + item.subtotal,
                                                                0
                                                            );

                                                            return (
                                                                <section
                                                                    key={category}
                                                                    className="cost-category"
                                                                >
                                                                    <div className="cost-category-header">
                                                                        <span>{CATEGORY_LABELS[category]}</span>
                                                                        <strong>{formatCurrency(categoryTotal)}</strong>
                                                                    </div>
                                                                    {items.map((item, index) => (
                                                                        <div
                                                                            key={`${item.name}-${index}`}
                                                                            className="cost-item"
                                                                        >
                                                                            <div className="cost-item-info">
                                                                                <span className="cost-item-name">
                                                                                    {item.name}
                                                                                </span>
                                                                                <span className="cost-item-quantity">
                                                                                    {item.quantity.toFixed(
                                                                                        item.unit === "m²" ||
                                                                                        item.unit === "L" ? 2 : 0
                                                                                    )}{" "}
                                                                                    {item.unit} × {formatCurrency(item.rate)}/
                                                                                    {item.category === "flooring" &&
                                                                                    item.unit === "pieces"
                                                                                        ? "tile"
                                                                                        : item.unit}
                                                                                </span>
                                                                            </div>
                                                                            <span className="cost-item-total">
                                                                                {formatCurrency(item.subtotal)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </section>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </section>
                                        );
                                    })
                                )}
                            </div>

                            <div className="cost-estimator-total">
                                <span>Estimated total</span>
                                <strong>{formatCurrency(estimate.total)}</strong>
                            </div>

                            <div className="cost-estimator-footer">
                                <button
                                    type="button"
                                    className="cost-estimator-export-button"
                                    onClick={handleDownloadReport}
                                >
                                    <Download size={15} strokeWidth={1.75} />
                                    <span>Download cost breakdown PDF</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}