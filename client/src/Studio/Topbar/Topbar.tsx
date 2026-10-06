import "./Topbar.css";

import {
    ArrowLeft,
    ChevronDown,
    Receipt,
    Undo2,
    Redo2
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import type {
    ChangeEvent
} from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import useEditor
    from "../../context/editor/useEditor";

import {
    calculateCostEstimate
} from "../../engine/cost/CostEstimator";

import type {
    CostCategory
} from "../../engine/cost/CostTypes";

import AdminComments
    from "../../scene/Comment/AdminComments";

export default function Topbar() {
    const {
        state,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditor();

    const navigate =
        useNavigate();

    const {
        projectId:
            routeProjectId
    } = useParams<{
        projectId?: string;
    }>();

    const [
        open,
        setOpen
    ] = useState(false);

    const dropdownRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const [
        projectName,
        setProjectName
    ] = useState<string>(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return "";
        }

        return (
            localStorage.getItem(
                "espasyo_project_name"
            ) || ""
        );
    });

    useEffect(() => {
        localStorage.setItem(
            "espasyo_project_name",
            projectName
        );
    }, [
        projectName
    ]);

    const handleProjectNameChange =
        (
            event:
                ChangeEvent<HTMLInputElement>
        ) => {
            setProjectName(
                event.target.value
            );
        };

    const handleBack =
        () => {
            window.history.back();
        };

    const estimate =
        useMemo(
            () =>
                calculateCostEstimate(
                    state
                ),
            [
                state
            ]
        );

    const formatCurrency =
        (
            amount:
                number
        ) =>
            new Intl.NumberFormat(
                "en-PH",
                {
                    style:
                        "currency",
                    currency:
                        "PHP",
                    minimumFractionDigits:
                        2
                }
            ).format(
                amount
            );

    const categoryLabels:
        Record<
            CostCategory,
            string
        > = {
        furniture:
            "Furniture",
        flooring:
            "Flooring",
        wallFinish:
            "Wall Finish",
        doors:
            "Doors",
        windows:
            "Windows"
    };

    const furnitureCount =
        state.furniture.length;

    useEffect(() => {
        const handleOutsideClick =
            (
                event:
                    MouseEvent
            ) => {
                if (
                    dropdownRef.current &&
                    !dropdownRef.current.contains(
                        event.target as Node
                    )
                ) {
                    setOpen(
                        false
                    );
                }
            };

        document.addEventListener(
            "mousedown",
            handleOutsideClick
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleOutsideClick
            );
        };
    }, []);

    const groupedItems =
        useMemo(
            () => {
                const groups:
                    Record<
                        CostCategory,
                        typeof estimate.items
                    > = {
                    furniture: [],
                    flooring: [],
                    wallFinish: [],
                    doors: [],
                    windows: []
                };

                for (
                    const item of
                    estimate.items
                ) {
                    groups[
                        item.category
                    ].push(
                        item
                    );
                }

                return groups;
            },
            [
                estimate.items
            ]
        );

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button
                    type="button"
                    className="history-button"
                    onClick={
                        handleBack
                    }
                    title="Back"
                    aria-label="Back"
                >
                    <ArrowLeft
                        size={
                            18
                        }
                    />
                </button>
            </div>

            <div className="topbar-center">
                <input
                    type="text"
                    className="project-title-input"
                    placeholder="Project name"
                    value={
                        projectName
                    }
                    onChange={
                        handleProjectNameChange
                    }
                    aria-label="Project name"
                />
            </div>

            <div className="topbar-actions">
                <button
                    type="button"
                    className="history-button"
                    onClick={
                        undo
                    }
                    disabled={
                        !canUndo
                    }
                    title="Undo"
                    aria-label="Undo"
                >
                    <Undo2
                        size={
                            18
                        }
                    />
                </button>

                <button
                    type="button"
                    className="history-button"
                    onClick={
                        redo
                    }
                    disabled={
                        !canRedo
                    }
                    title="Redo"
                    aria-label="Redo"
                >
                    <Redo2
                        size={
                            18
                        }
                    />
                </button>

                <div
                    className="admin-comments-icon-only"
                >
                    <AdminComments
                        projectId={
                            routeProjectId ??
                            null
                        }
                    />
                </div>

                <div
                    className="cost-estimator"
                    ref={
                        dropdownRef
                    }
                >
                    <button
                        type="button"
                        className="cost-estimator-button"
                        onClick={() =>
                            setOpen(
                                value =>
                                    !value
                            )
                        }
                        aria-expanded={
                            open
                        }
                    >
                        <Receipt
                            size={
                                17
                            }
                        />

                        <span>
                            Cost Estimation
                        </span>

                        <ChevronDown
                            size={
                                16
                            }
                            className={
                                open
                                    ? "cost-chevron open"
                                    : "cost-chevron"
                            }
                        />
                    </button>

                    {
                        open && (
                            <div className="cost-estimator-dropdown">
                                <div className="cost-estimator-header">
                                    <div>
                                        <strong>
                                            Cost Estimation
                                        </strong>

                                        <span>
                                            {
                                                furnitureCount
                                            }
                                            {" "}
                                            furniture
                                            {
                                                furnitureCount !==
                                                1
                                                    ? " items"
                                                    : " item"
                                            }
                                            {" · "}
                                            {
                                                estimate.items.length
                                            }
                                            {" "}
                                            cost item
                                            {
                                                estimate.items.length !==
                                                1
                                                    ? "s"
                                                    : ""
                                            }
                                        </span>
                                    </div>
                                </div>

                                <div className="cost-estimator-list">
                                    {
                                        estimate.items.length ===
                                        0 ? (
                                            <div className="cost-empty">
                                                No cost items yet.
                                            </div>
                                        ) : (
                                            (
                                                Object.keys(
                                                    groupedItems
                                                ) as CostCategory[]
                                            ).map(
                                                category => {
                                                    const items =
                                                        groupedItems[
                                                            category
                                                        ];

                                                    if (
                                                        items.length ===
                                                        0
                                                    ) {
                                                        return null;
                                                    }

                                                    const categoryTotal =
                                                        items.reduce(
                                                            (
                                                                sum,
                                                                item
                                                            ) =>
                                                                sum +
                                                                item.subtotal,
                                                            0
                                                        );

                                                    return (
                                                        <div
                                                            key={
                                                                category
                                                            }
                                                            className="cost-category"
                                                        >
                                                            <div className="cost-category-header">
                                                                <span>
                                                                    {
                                                                        categoryLabels[
                                                                            category
                                                                        ]
                                                                    }
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        formatCurrency(
                                                                            categoryTotal
                                                                        )
                                                                    }
                                                                </strong>
                                                            </div>

                                                            {
                                                                items.map(
                                                                    (
                                                                        item,
                                                                        index
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                `${item.name}-${index}`
                                                                            }
                                                                            className="cost-item"
                                                                        >
                                                                            <div className="cost-item-info">
                                                                                <span className="cost-item-name">
                                                                                    {
                                                                                        item.name
                                                                                    }
                                                                                </span>

                                                                                <span className="cost-item-quantity">
                                                                                    {
                                                                                        item.quantity.toFixed(
                                                                                            item.unit ===
                                                                                            "m²"
                                                                                                ? 2
                                                                                                : 0
                                                                                        )
                                                                                    }
                                                                                    {" "}
                                                                                    {
                                                                                        item.unit
                                                                                    }
                                                                                    {" × "}
                                                                                    {
                                                                                        formatCurrency(
                                                                                            item.rate
                                                                                        )
                                                                                    }
                                                                                    /
                                                                                    {
                                                                                        item.unit
                                                                                    }
                                                                                </span>
                                                                            </div>

                                                                            <span className="cost-item-total">
                                                                                {
                                                                                    formatCurrency(
                                                                                        item.subtotal
                                                                                    )
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                )
                                                            }
                                                        </div>
                                                    );
                                                }
                                            )
                                        )
                                    }
                                </div>

                                <div className="cost-estimator-total">
                                    <span>
                                        Estimated Total
                                    </span>

                                    <strong>
                                        {
                                            formatCurrency(
                                                estimate.total
                                            )
                                        }
                                    </strong>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
        </header>
    );
}