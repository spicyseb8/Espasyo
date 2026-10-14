import "./Topbar.css";

import { ArrowLeft, ChevronDown, Download, Undo2, Redo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";

import useEditor from "../../context/editor/useEditor";
import { calculateCostEstimate } from "../../engine/cost/CostEstimator";
import { downloadCostBreakdownPdf } from "../../engine/cost/CostBreakdownPDF";
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
    const { state, undo, redo, canUndo, canRedo } = useEditor();

    const { projectId: routeProjectId } = useParams<{ projectId?: string }>();

    const [open, setOpen] = useState(false);
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

    const furnitureCount = state.furniture.length;

    // Close the estimate dropdown on outside click or Escape
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

    const groupedItems = useMemo(() => {
        const groups: Record<CostCategory, typeof estimate.items> = {
            furniture: [],
            flooring: [],
            wallFinish: [],
            doors: [],
            windows: []
        };

        for (const item of estimate.items) {
            groups[item.category].push(item);
        }

        return groups;
    }, [estimate.items]);

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
                        disabled={!canUndo}
                        title="Undo"
                        aria-label="Undo"
                    >
                        <Undo2 size={15} strokeWidth={1.75} />
                    </button>

                    <button
                        type="button"
                        className="history-button"
                        onClick={redo}
                        disabled={!canRedo}
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
                            {formatCurrency(estimate.total, 0)}
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
                                {estimate.items.length === 0 ? (
                                    <div className="cost-empty">
                                        No cost items yet. Add furniture or finishes to see your
                                        estimate.
                                    </div>
                                ) : (
                                    CATEGORY_ORDER.map((category) => {
                                        const items = groupedItems[category];
                                        if (items.length === 0) return null;

                                        const categoryTotal = items.reduce(
                                            (sum, item) => sum + item.subtotal,
                                            0
                                        );

                                        return (
                                            <section key={category} className="cost-category">
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
                                                                    item.unit === "m²" ? 2 : 0
                                                                )}{" "}
                                                                {item.unit} × {formatCurrency(item.rate)}/
                                                                {item.unit}
                                                            </span>
                                                        </div>

                                                        <span className="cost-item-total">
                                                            {formatCurrency(item.subtotal)}
                                                        </span>
                                                    </div>
                                                ))}
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