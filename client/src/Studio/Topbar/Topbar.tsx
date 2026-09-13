import "./Topbar.css";

import {
    ChevronDown,
    Receipt,
    PersonStanding,
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
        dispatch,
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
    function hasClosedRoom(
    walls: typeof state.walls
) {
    const EPSILON = 0.001;

    if (
        !walls ||
        walls.length < 3
    ) {
        return false;
    }

    function samePoint(
        a: { x: number; z: number },
        b: { x: number; z: number }
    ) {
        return (
            Math.abs(a.x - b.x) <= EPSILON &&
            Math.abs(a.z - b.z) <= EPSILON
        );
    }

    const adjacency =
        new Map<number, number[]>();

    const points: {
        x: number;
        z: number;
    }[] = [];

    function getPointIndex(
        point: {
            x: number;
            z: number;
        }
    ) {
        const existingIndex =
            points.findIndex(
                existing =>
                    samePoint(
                        existing,
                        point
                    )
            );

        if (
            existingIndex !== -1
        ) {
            return existingIndex;
        }

        const newIndex =
            points.length;

        points.push({
            x: point.x,
            z: point.z
        });

        return newIndex;
    }

    for (
        const wall of walls
    ) {

        const startIndex =
            getPointIndex(
                wall.start.position
            );

        const endIndex =
            getPointIndex(
                wall.end.position
            );

        if (
            !adjacency.has(
                startIndex
            )
        ) {
            adjacency.set(
                startIndex,
                []
            );
        }

        if (
            !adjacency.has(
                endIndex
            )
        ) {
            adjacency.set(
                endIndex,
                []
            );
        }

        adjacency
            .get(startIndex)!
            .push(endIndex);

        adjacency
            .get(endIndex)!
            .push(startIndex);
    }

    //--------------------------------------------------
    // Detect a cycle.
    //--------------------------------------------------

    const visited =
        new Set<number>();

    function hasCycle(
        current: number,
        parent: number
    ): boolean {

        visited.add(
            current
        );

        const neighbours =
            adjacency.get(
                current
            ) ?? [];

        for (
            const neighbour of neighbours
        ) {

            if (
                !visited.has(
                    neighbour
                )
            ) {

                if (
                    hasCycle(
                        neighbour,
                        current
                    )
                ) {
                    return true;
                }

            }

            else if (
                neighbour !== parent
            ) {

                return true;
            }
        }

        return false;
    }

    for (
        const pointIndex of adjacency.keys()
    ) {

        if (
            !visited.has(
                pointIndex
            )
        ) {

            if (
                hasCycle(
                    pointIndex,
                    -1
                )
            ) {
                return true;
            }
        }
    }

    return false;
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
    // WALKTHROUGH
    //==================================================

    function handleWalkthrough() {

    if (
        !state.walkthroughMode &&
        !hasClosedRoom(
            state.walls
        )
    ) {

        alert(
            "Create a closed room first before entering Walkthrough."
        );

        return;
    }

    dispatch({
        type:
            "TOGGLE_WALKTHROUGH"
    });
}


    //==================================================
    // RENDER
    //==================================================

    return (

       <header className="topbar">

    {/* LEFT */}
    <div className="topbar-left">
        <div className="topbar-brand">
            ESPASYO
        </div>
    </div>


    {/* CENTER */}
    <div className="topbar-center">

        <input
            type="text"
            className="project-title-input"
            placeholder="Project name"
            value={projectName}
            onChange={
                handleProjectNameChange
            }
            aria-label="Project name"
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
    className="history-button"
    onClick={undo}
    disabled={!canUndo}
    title="Undo"
    aria-label="Undo"
>
    <Undo2 size={18} />
</button>


{/*----------------------------------------------
    REDO
----------------------------------------------*/}

<button
    type="button"
    className="history-button"
    onClick={redo}
    disabled={!canRedo}
    title="Redo"
    aria-label="Redo"
>
    <Redo2 size={18} />
</button>
                {/*----------------------------------------------
                    WALKTHROUGH
                ----------------------------------------------*/}

                <button

    type="button"

    className={
        state.walkthroughMode
            ? "walkthrough-button active"
            : "walkthrough-button"
    }

    onClick={
        event => {

            handleWalkthrough();

            //--------------------------------------------------
            // Remove keyboard focus from this button.
            //
            // This prevents pressing Space later from
            // activating the button again.
            //--------------------------------------------------

            event.currentTarget.blur();

        }
    }

    onKeyDown={
        event => {

            //--------------------------------------------------
            // Space must NOT toggle Walkthrough.
            //--------------------------------------------------

            if (
                event.key ===
                " "
            ) {

                event.preventDefault();
                event.stopPropagation();

                return;
            }

        }
    }

    aria-pressed={
        state.walkthroughMode
    }

>

                    <PersonStanding
                        size={16}
                    />

                    <span>

                        {
                            state.walkthroughMode
                                ? "Exit Walkthrough"
                                : "Walkthrough"
                        }

                    </span>

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
                                                furnitureCount !== 1
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
                                                estimate.items.length !== 1
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
                                        estimate.items.length === 0
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