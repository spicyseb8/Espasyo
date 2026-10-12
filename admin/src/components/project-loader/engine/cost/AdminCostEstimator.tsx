import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, Receipt } from "lucide-react";
import type {
    SavedCostItem,
    SavedProjectData
} from "../../ProjectTypes";

interface AdminCostEstimatorProps {
    projectData: SavedProjectData;
}

const categoryLabels: Record<SavedCostItem["category"], string> = {
    furniture: "Furniture",
    flooring: "Flooring",
    wallFinish: "Wall Finish",
    doors: "Doors",
    windows: "Windows"
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2
    }).format(amount);
}

const GREEN = "#4f8b62";

const styles: Record<string, CSSProperties> = {
    wrapper: {
        position: "relative",
        flexShrink: 0
    },
    button: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        height: "36px",
        padding: "0 14px",
        borderRadius: "8px",
        border: "1px solid #dededb",
        color: "#333333",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        cursor: "pointer",
        transition: "background 0.15s"
    },
    panel: {
        position: "absolute",
        right: 0,
        top: "44px",
        zIndex: 100,
        width: "350px",
        maxWidth: "calc(100vw - 2rem)",
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid #dfdfdb",
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        textAlign: "left"
    },
    header: {
        borderBottom: "1px solid #e7e7e3",
        padding: "12px 16px"
    },
    title: {
        margin: 0,
        fontSize: "14px",
        fontWeight: 600,
        color: "#222222"
    },
    subtitle: {
        margin: "2px 0 0",
        fontSize: "10px",
        color: "#999999"
    },
    body: {
        maxHeight: "430px",
        overflowY: "auto",
        padding: "12px"
    },
    empty: {
        padding: "40px 0",
        textAlign: "center"
    },
    emptyTitle: {
        margin: 0,
        fontSize: "12px",
        fontWeight: 500,
        color: "#555555"
    },
    emptyText: {
        margin: "4px 0 0",
        fontSize: "10px",
        color: "#999999"
    },
    group: {
        marginBottom: "12px",
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid #e5e5e1",
        background: "#ffffff"
    },
    groupHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #eeeeeb",
        padding: "10px 12px"
    },
    groupLabel: {
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "#888888"
    },
    groupTotal: {
        fontSize: "11px",
        fontWeight: 600,
        color: GREEN
    },
    itemRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px"
    },
    itemInfo: {
        minWidth: 0
    },
    itemName: {
        margin: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: "11px",
        fontWeight: 500,
        color: "#333333"
    },
    itemMeta: {
        margin: "4px 0 0",
        fontSize: "9px",
        color: "#999999"
    },
    itemSubtotal: {
        flexShrink: 0,
        fontSize: "11px",
        fontWeight: 600,
        color: GREEN
    },
    footer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: "1px solid #dededb",
        background: "#fafaf8",
        padding: "12px 16px"
    },
    footerLabel: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#444444"
    },
    footerTotal: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#3f7d54"
    }
};

export default function AdminCostEstimator({
    projectData
}: AdminCostEstimatorProps) {
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);

    const items = projectData.costEstimate?.items ?? [];

    const total =
        typeof projectData.costEstimate?.total === "number" &&
        Number.isFinite(projectData.costEstimate.total)
            ? projectData.costEstimate.total
            : 0;

    const furnitureCount = projectData.furniture.length;

    const groupedItems = useMemo(() => {
        const groups: Record<SavedCostItem["category"], SavedCostItem[]> = {
            furniture: [],
            flooring: [],
            wallFinish: [],
            doors: [],
            windows: []
        };

        for (const item of items) {
            if (groups[item.category]) {
                groups[item.category].push(item);
            }
        }

        return groups;
    }, [items]);

    return (
        <div style={styles.wrapper}>
            <button
                type="button"
                style={{
                    ...styles.button,
                    background: hovered ? "#f5f5f2" : "#ffffff"
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={() => setOpen(value => !value)}
                aria-expanded={open}
            >
                <Receipt size={16} />

                <span>Cost Estimation</span>

                <ChevronDown
                    size={15}
                    style={{
                        transition: "transform 0.15s",
                        transform: open ? "rotate(180deg)" : "none"
                    }}
                />
            </button>

            {open && (
                <div style={styles.panel}>
                    <div style={styles.header}>
                        <h2 style={styles.title}>Cost Estimation</h2>

                        <p style={styles.subtitle}>
                            {furnitureCount} furniture{" "}
                            {furnitureCount !== 1 ? "items" : "item"}
                            {" · "}
                            {items.length} cost item
                            {items.length !== 1 ? "s" : ""}
                        </p>
                    </div>

                    <div style={styles.body}>
                        {items.length === 0 ? (
                            <div style={styles.empty}>
                                <p style={styles.emptyTitle}>
                                    No cost items yet.
                                </p>

                                <p style={styles.emptyText}>
                                    This project does not have a saved cost estimate.
                                </p>
                            </div>
                        ) : (
                            (
                                Object.keys(
                                    groupedItems
                                ) as SavedCostItem["category"][]
                            ).map(category => {
                                const categoryItems = groupedItems[category];

                                if (categoryItems.length === 0) {
                                    return null;
                                }

                                const categoryTotal = categoryItems.reduce(
                                    (sum, item) => sum + item.subtotal,
                                    0
                                );

                                return (
                                    <div key={category} style={styles.group}>
                                        <div style={styles.groupHeader}>
                                            <span style={styles.groupLabel}>
                                                {categoryLabels[category]}
                                            </span>

                                            <strong style={styles.groupTotal}>
                                                {formatCurrency(categoryTotal)}
                                            </strong>
                                        </div>

                                        {categoryItems.map((item, index) => (
                                            <div
                                                key={`${item.name}-${index}`}
                                                style={{
                                                    ...styles.itemRow,
                                                    borderBottom:
                                                        index === categoryItems.length - 1
                                                            ? "none"
                                                            : "1px solid #f0f0ed"
                                                }}
                                            >
                                                <div style={styles.itemInfo}>
                                                    <p style={styles.itemName}>
                                                        {item.name}
                                                    </p>

                                                    <p style={styles.itemMeta}>
                                                        {item.quantity.toFixed(
                                                            item.unit === "m²" ? 2 : 0
                                                        )}{" "}
                                                        {item.unit}
                                                        {" × "}
                                                        {formatCurrency(item.rate)}/
                                                        {item.unit}
                                                    </p>
                                                </div>

                                                <span style={styles.itemSubtotal}>
                                                    {formatCurrency(item.subtotal)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div style={styles.footer}>
                        <span style={styles.footerLabel}>Estimated Total</span>

                        <strong style={styles.footerTotal}>
                            {formatCurrency(total)}
                        </strong>
                    </div>
                </div>
            )}
        </div>
    );
}