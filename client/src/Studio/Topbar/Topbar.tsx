import "./Topbar.css";

import {
    ChevronDown,
    Receipt
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import useEditor from "../../context/editor/useEditor";
import { findAsset } from "../../assets/AssetLibrary";

export default function Topbar() {

    const { state } = useEditor();
    const furnitureList = Array.isArray(state?.furniture) ? state.furniture : [];

    const [open, setOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    //--------------------------------------------------
    // Build cost estimation from placed furniture
    //--------------------------------------------------

    const costItems = useMemo(() => {

        const grouped = new Map<
            string,
            {
                assetId: string;
                name: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
            }
        >();

        for (const furniture of furnitureList) {

            const asset = findAsset(
                furniture.assetId
            );

            if (!asset)
                continue;

            const existing =
                grouped.get(asset.id);

            if (existing) {

                existing.quantity += 1;

                existing.totalPrice =
                    existing.quantity *
                    existing.unitPrice;

            } else {

                grouped.set(
                    asset.id,
                    {
                        assetId: asset.id,
                        name: asset.name,
                        quantity: 1,
                        unitPrice: asset.price,
                        totalPrice: asset.price
                    }
                );
            }
        }

        return Array.from(
            grouped.values()
        );

    }, [furnitureList]);

    //--------------------------------------------------
    // Total cost
    //--------------------------------------------------

    const totalCost = useMemo(() => {

        return costItems.reduce(
            (sum, item) =>
                sum + item.totalPrice,
            0
        );

    }, [costItems]);

    //--------------------------------------------------
    // Total number of furniture
    //--------------------------------------------------

    const totalItems =
        furnitureList.length;

    //--------------------------------------------------
    // Close when clicking outside
    //--------------------------------------------------

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

    //--------------------------------------------------
    // Currency formatter
    //--------------------------------------------------

    const formatCurrency = (
        amount: number
    ) => {

        return new Intl.NumberFormat(
            "en-PH",
            {
                style: "currency",
                currency: "PHP",
                minimumFractionDigits: 2
            }
        ).format(amount);

    };

    return (

        <header className="topbar">

            <div className="topbar-brand">
                ESPASYO
            </div>

            <div
                className="cost-estimator"
                ref={dropdownRef}
            >

                <button
                    className="cost-estimator-button"
                    onClick={() =>
                        setOpen(value => !value)
                    }
                    aria-expanded={open}
                >

                    <Receipt size={17} />

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

                {open && (

                    <div className="cost-estimator-dropdown">

                        <div className="cost-estimator-header">

                            <div>
                                <strong>
                                    Cost Estimation
                                </strong>

                                <span>
                                    {totalItems} furniture item
                                    {totalItems !== 1
                                        ? "s"
                                        : ""}
                                </span>
                            </div>

                        </div>

                        <div className="cost-estimator-list">

                            {costItems.length === 0 ? (

                                <div className="cost-empty">

                                    No furniture placed yet.

                                </div>

                            ) : (

                                costItems.map(
                                    item => (

                                        <div
                                            key={item.assetId}
                                            className="cost-item"
                                        >

                                            <div className="cost-item-info">

                                                <span className="cost-item-name">
                                                    {item.name}
                                                </span>

                                                <span className="cost-item-quantity">
                                                    × {item.quantity}
                                                </span>

                                            </div>

                                            <span className="cost-item-total">

                                                {
                                                    formatCurrency(
                                                        item.totalPrice
                                                    )
                                                }

                                            </span>

                                        </div>

                                    )
                                )

                            )}

                        </div>

                        <div className="cost-estimator-total">

                            <span>
                                Estimated Total
                            </span>

                            <strong>
                                {
                                    formatCurrency(
                                        totalCost
                                    )
                                }
                            </strong>

                        </div>

                    </div>

                )}

            </div>

        </header>

    );
}