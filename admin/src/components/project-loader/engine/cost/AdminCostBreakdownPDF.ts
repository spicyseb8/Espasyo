
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { SavedProjectData } from "../../ProjectTypes";
import { calculateAdminCostEstimate } from "./AdminCostCalculation";

type CostCategory =
    | "furniture"
    | "flooring"
    | "wallFinish"
    | "doors"
    | "windows";

interface SavedCostItem {
    category: CostCategory;
    name: string;
    floorId?: string;
    quantity: number;
    unit: string;
    rate: number;
    subtotal: number;
    coats?: number;
    pieces?: number;
    length?: number;
    width?: number;
}

interface PreparedCostItem extends SavedCostItem {
    displayQuantity: string;
    displayCoats: string;
    displayAmount: number;
}

interface ReportSection {
    title: string;
    categories: CostCategory[];
}

interface RecordValue {
    [key: string]: unknown;
}

type JsPdfWithAutoTable = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

const SECTIONS: ReportSection[] = [
    {
        title: "WALL MATERIALS",
        categories: ["wallFinish"]
    },
    {
        title: "FURNITURE MATERIALS",
        categories: ["furniture", "doors", "windows"]
    },
    {
        title: "FLOORING MATERIALS",
        categories: ["flooring"]
    }
];

function isRecord(value: unknown): value is RecordValue {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isSavedProjectData(value: unknown): value is SavedProjectData {
    return (
        isRecord(value) &&
        typeof value.projectId === "string" &&
        typeof value.ownerId === "string" &&
        (value.floors === undefined || Array.isArray(value.floors))
    );
}

function formatMoney(amount: number): string {
    const value = Number.isFinite(amount) ? amount : 0;

    return `PHP ${value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function roundLitersUp(quantity: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return 0;
    }

    return Math.ceil(quantity);
}

function formatQuantity(item: SavedCostItem): string {
    if (item.unit.trim().toLowerCase() === "l") {
        return String(roundLitersUp(item.quantity));
    }

    return item.quantity.toLocaleString("en-PH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: item.unit === "m²" ? 2 : 4
    });
}

function formatDimension(
    value: number | undefined
): string {
    if (value === undefined || !Number.isFinite(value)) {
        return "—";
    }

    return value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatPieces(value: number): string {
    return value.toLocaleString("en-PH", {
        maximumFractionDigits: 0
    });
}

function createFileName(projectName: string): string {
    const safeName = projectName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const date = new Date().toISOString().slice(0, 10);

    return `espasyo-cost-breakdown-${safeName || "project"}-${date}.pdf`;
}

function prepareCostItem(
    item: SavedCostItem
): PreparedCostItem {
    const isWallItem = item.category === "wallFinish";
    const isLiterItem =
        item.unit.trim().toLowerCase() === "l";

    if (isWallItem && isLiterItem) {
        const inferredCoats = /primer/i.test(item.name)
            ? 1
            : 2;

        return {
            ...item,
            displayQuantity: `${item.quantity.toLocaleString("en-PH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            })} L`,
            displayCoats: String(item.coats ?? inferredCoats),
            displayAmount: item.subtotal
        };
    }

    return {
        ...item,
        displayQuantity: `${formatQuantity(item)} ${item.unit}`,
        displayCoats: isWallItem
            ? String(item.coats ?? "—")
            : "—",
        displayAmount: item.subtotal
    };
}

export async function downloadAdminCostBreakdownPDF(
    projectData: unknown,
    projectName: string,
    projectId: string
): Promise<void> {
    if (!isSavedProjectData(projectData)) {
        throw new Error("The saved project JSON is invalid.");
    }

    const estimate = await calculateAdminCostEstimate(projectData);
    const preparedItems = estimate.items.map(prepareCostItem);

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    }) as JsPdfWithAutoTable;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const title = projectName.trim() || "Untitled Project";

    const generatedAt = new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date());

    doc.setProperties({
        title: `Cost Breakdown Report - ${title}`,
        subject: "Espasyo Interior Design Cost Estimate",
        author: "Espasyo",
        creator: "Espasyo Admin"
    });

    doc.setFillColor(37, 43, 36);
    doc.rect(0, 0, pageWidth, 32, "F");

    doc.setTextColor(245, 243, 236);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ESPASYO", margin, 10);

    doc.setFontSize(16);
    doc.text("COST BREAKDOWN REPORT", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("INTERIOR DESIGN COST ESTIMATE", margin, 26);

    doc.text(
        `Generated: ${generatedAt}`,
        pageWidth - margin,
        11,
        { align: "right" }
    );

    doc.setTextColor(38, 43, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, 41, {
        maxWidth: contentWidth
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(95, 99, 91);

    doc.text(`Project ID: ${projectId}`, margin, 47);

    doc.text(
        `Cost items: ${preparedItems.length}`,
        pageWidth - margin,
        47,
        { align: "right" }
    );

    let currentY = 53;

    for (const floor of estimate.floors) {
        if (currentY + 15 > pageHeight - 16) {
            doc.addPage();
            currentY = 16;
        }

        doc.setFillColor(37, 43, 36);
        doc.roundedRect(
            margin,
            currentY,
            contentWidth,
            9,
            1.2,
            1.2,
            "F"
        );
        doc.setTextColor(245, 243, 236);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(floor.name, margin + 3, currentY + 6);
        doc.text(
            formatMoney(floor.subtotal),
            pageWidth - margin - 3,
            currentY + 6,
            { align: "right" }
        );
        currentY += 11;

        for (const section of SECTIONS) {
        const sectionItems = preparedItems.filter(item =>
            item.floorId === floor.floorId &&
            section.categories.includes(item.category)
        );

        if (sectionItems.length === 0) continue;

        const isWallSection =
            section.title === "WALL MATERIALS";

        const isFlooringSection =
            section.title === "FLOORING MATERIALS";

        const hasLegacyWallUnits = isWallSection &&
            sectionItems.some(
                item => item.unit.trim().toLowerCase() !== "l"
            );

        if (currentY + 25 > pageHeight - 16) {
            doc.addPage();
            currentY = 16;
        }

        doc.setFillColor(239, 241, 234);
        doc.roundedRect(
            margin,
            currentY,
            contentWidth,
            8,
            1.2,
            1.2,
            "F"
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(67, 78, 59);
        doc.text(section.title, margin + 3, currentY + 5.4);

        currentY += 10;

        const head = isWallSection
            ? [[
                "Product",
                "No. of Coats",
                hasLegacyWallUnits
                    ? "Quantity (saved unit)"
                    : "Quantity (in Liters)\n1 gallon = 4 liters",
                "Price"
            ]]
            : isFlooringSection
                ? [[
                    "Item / Material",
                    "No. of Pieces",
                    "Length (m)",
                    "Width (m)",
                    "Rate",
                    "Amount"
                ]]
                : [[
                    "Item / Material",
                    "Quantity",
                    "Unit",
                    "Unit Rate",
                    "Amount"
                ]];

        const rows = sectionItems.map(item => {
                if (isWallSection) {
                    return [
                        item.name,
                        item.displayCoats,
                        item.displayQuantity,
                        formatMoney(item.displayAmount)
                    ];
                }

                if (isFlooringSection) {
                    return [
                        item.name,
                        formatPieces(item.pieces ?? item.quantity),
                        formatDimension(item.length),
                        formatDimension(item.width),
                        formatMoney(item.rate),
                        formatMoney(item.subtotal)
                    ];
                }

                return [
                    item.name,
                    formatQuantity(item),
                    item.unit,
                    formatMoney(item.rate),
                    formatMoney(item.subtotal)
                ];
            });

        autoTable(doc, {
            startY: currentY,
            head,
            body: rows,
            theme: "striped",
            margin: {
                left: margin,
                right: margin,
                top: 14,
                bottom: 17
            },
            styles: {
                font: "helvetica",
                fontSize: 7.5,
                cellPadding: 2,
                textColor: [48, 51, 46],
                lineColor: [225, 227, 221],
                lineWidth: 0.1,
                overflow: "linebreak",
                valign: "middle"
            },
            headStyles: {
                fillColor: [67, 78, 59],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 7.5
            },
            alternateRowStyles: {
                fillColor: [246, 247, 243]
            },
            columnStyles: isWallSection
                ? {
                    0: { cellWidth: 69 },
                    1: { cellWidth: 27, halign: "center" },
                    2: { cellWidth: 41, halign: "right" },
                    3: { cellWidth: 49, halign: "right" }
                }
                : isFlooringSection
                    ? {
                        0: { cellWidth: 52 },
                        1: { cellWidth: 27, halign: "center" },
                        2: { cellWidth: 24, halign: "right" },
                        3: { cellWidth: 24, halign: "right" },
                        4: { cellWidth: 28, halign: "right" },
                        5: { cellWidth: 31, halign: "right" }
                    }
                    : {
                        0: { cellWidth: 65 },
                        1: { cellWidth: 24, halign: "right" },
                        2: { cellWidth: 18 },
                        3: { cellWidth: 36, halign: "right" },
                        4: { cellWidth: 43, halign: "right" }
                    },
        });

        currentY = (doc.lastAutoTable?.finalY ?? currentY) + 6;
        }

        if (floor.items.length === 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(115, 118, 110);
            doc.text("No cost items on this floor.", margin + 2, currentY + 2);
            currentY += 8;
        }

        if (currentY + 12 > pageHeight - 16) {
            doc.addPage();
            currentY = 16;
        }

        doc.setDrawColor(220, 222, 216);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        doc.setTextColor(67, 78, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`${floor.name} SUBTOTAL`, margin, currentY + 6);
        doc.text(
            formatMoney(floor.subtotal),
            pageWidth - margin,
            currentY + 6,
            { align: "right" }
        );
        currentY += 12;
    }

    const reportTotal = estimate.total;

    if (currentY + 20 > pageHeight - 15) {
        doc.addPage();
        currentY = 18;
    }

    doc.setFillColor(37, 43, 36);
    doc.roundedRect(
        margin,
        currentY,
        contentWidth,
        16,
        1.8,
        1.8,
        "F"
    );

    doc.setTextColor(245, 243, 236);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ESTIMATED TOTAL", margin + 4, currentY + 10);

    doc.setFontSize(11);
    doc.text(
        formatMoney(reportTotal),
        pageWidth - margin - 4,
        currentY + 10,
        { align: "right" }
    );

    const pageCount = doc.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setDrawColor(220, 222, 216);
        doc.setLineWidth(0.2);

        doc.line(
            margin,
            pageHeight - 11,
            pageWidth - margin,
            pageHeight - 11
        );

        doc.setTextColor(115, 118, 110);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);

        doc.text(
            "Preliminary estimate only. Actual costs may vary.",
            margin,
            pageHeight - 6
        );

        doc.text(
            `Page ${page} of ${pageCount}`,
            pageWidth - margin,
            pageHeight - 6,
            { align: "right" }
        );
    }

    doc.save(createFileName(title));
}
