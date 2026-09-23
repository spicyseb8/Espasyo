import "./Topbar.css";

import {
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

import useEditor
    from "../../context/editor/useEditor";

import {
    calculateCostEstimate
} from "../../engine/cost/CostEstimator";

import type {
    CostCategory
} from "../../engine/cost/CostTypes";


export default function Topbar() {

    const {
        state,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditor();


    const [
        open,
        setOpen
    ] = useState(false);


    const dropdownRef =
        useRef<HTMLDivElement>(null);


    //==================================================
    // PROJECT TITLE
    //==================================================

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


    function handleProjectNameChange(
        event: ChangeEvent<HTMLInputElement>
    ) {

        setProjectName(
            event.target.value
        );

    }


    //==================================================
    // COST ESTIMATION
    //==================================================

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


    //==================================================
    // FORMAT CURRENCY
    //==================================================

    const formatCurrency =
        (
            amount: number
        ) => {

            return new Intl.NumberFormat(
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

        };


    //==================================================
    // CATEGORY LABELS
    //==================================================

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


    //==================================================
    // FURNITURE COUNT
    //==================================================

    const furnitureCount =
        state.furniture.length;


    //==================================================
    // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
    //==================================================

    useEffect(() => {

        function handleOutsideClick(
            event: MouseEvent
        ) {

            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(
                    event.target as Node
                )
            ) {

                setOpen(false);

            }

        }


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


    //==================================================
    // GROUP COST ITEMS BY CATEGORY
    //==================================================

    const groupedItems =
        useMemo(() => {

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

        }, [
            estimate.items
        ]);


    //==================================================
    // RENDER
    //==================================================

    return (

        <header
            className="topbar"
        >

            {/*==================================================
                LEFT
            ==================================================*/}

            <div
                className="topbar-left"
            >

                <div
                    className="topbar-brand"
                >
                    ESPASYO
                </div>

            </div>


            {/*==================================================
                CENTER
            ==================================================*/}

            <div
                className="topbar-center"
            >

                <input

                    type="text"

                    className=
                        "project-title-input"

                    placeholder=
                        "Project name"

                    value={
                        projectName
                    }

                    onChange={
                        handleProjectNameChange
                    }

                    aria-label=
                        "Project name"

                />

            </div>


            {/*==================================================
                RIGHT ACTIONS
            ==================================================*/}

            <div
                className="topbar-actions"
            >

                {/*----------------------------------------------
                    UNDO
                ----------------------------------------------*/}

                <button

                    type="button"

                    className=
                        "history-button"

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
                        size={18}
                    />

                </button>


                {/*----------------------------------------------
                    REDO
                ----------------------------------------------*/}

                <button

                    type="button"

                    className=
                        "history-button"

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
                        size={18}
                    />

                </button>


                {/*----------------------------------------------
                    COST ESTIMATOR
                ----------------------------------------------*/}

                <div

                    className=
                        "cost-estimator"

                    ref={
                        dropdownRef
                    }

                >

                    <button

                        type="button"

                        className=
                            "cost-estimator-button"

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
                            size={17}
                        />

                        <span>
                            Cost Estimation
                        </span>

                        <ChevronDown

                            size={16}

                            className={
                                open
                                    ? "cost-chevron open"
                                    : "cost-chevron"
                            }

                        />

                    </button>


                    {/*==========================================
                        COST DROPDOWN
                    ==========================================*/}

                    {
                        open && (

                            <div

                                className=
                                    "cost-estimator-dropdown"

                            >

                                {/*----------------------------------
                                    HEADER
                                ----------------------------------*/}

                                <div
                                    className=
                                        "cost-estimator-header"
                                >

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


                                {/*----------------------------------
                                    ITEMS
                                ----------------------------------*/}

                                <div
                                    className=
                                        "cost-estimator-list"
                                >

                                    {
                                        estimate.items.length ===
                                        0

                                            ? (

                                                <div
                                                    className=
                                                        "cost-empty"
                                                >
                                                    No cost items yet.
                                                </div>

                                            )

                                            : (

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

                                                                className=
                                                                    "cost-category"

                                                            >

                                                                {/*----------------------------------
                                                                    CATEGORY HEADER
                                                                ----------------------------------*/}

                                                                <div

                                                                    className=
                                                                        "cost-category-header"

                                                                >

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


                                                                {/*----------------------------------
                                                                    ITEMS
                                                                ----------------------------------*/}

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

                                                                                className=
                                                                                    "cost-item"

                                                                            >

                                                                                <div

                                                                                    className=
                                                                                        "cost-item-info"

                                                                                >

                                                                                    <span

                                                                                        className=
                                                                                            "cost-item-name"

                                                                                    >

                                                                                        {
                                                                                            item.name
                                                                                        }

                                                                                    </span>


                                                                                    <span

                                                                                        className=
                                                                                            "cost-item-quantity"

                                                                                    >

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

                                                                                        /{
                                                                                            item.unit
                                                                                        }

                                                                                    </span>

                                                                                </div>


                                                                                <span

                                                                                    className=
                                                                                        "cost-item-total"

                                                                                >

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


                                {/*----------------------------------
                                    TOTAL
                                ----------------------------------*/}

                                <div

                                    className=
                                        "cost-estimator-total"

                                >

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