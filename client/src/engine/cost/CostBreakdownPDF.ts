import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type {
    CostCategory,
    CostEstimate,
    CostItem
} from "./CostTypes";

type CostSection = {
    title: string;
    categories: CostCategory[];
};

type JsPdfWithAutoTable = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

const SECTIONS: CostSection[] = [
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

function formatQuantity(
    item: CostItem,
    preserveFractionalQuantity = false
): string {
    const quantity = Number.isFinite(item.quantity)
        ? item.quantity
        : 0;

    if (
        !preserveFractionalQuantity &&
        (item.unit === "L" || item.unit === "pieces")
    ) {
        return String(roundLitersUp(quantity));
    }

    return quantity.toLocaleString("en-PH", {
        minimumFractionDigits: 0,
        maximumFractionDigits:
            item.unit === "m²" && preserveFractionalQuantity
                ? 4
                : item.unit === "m²"
                    ? 2
                    : 4
    });
}

function formatDimension(value?: number): string {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return "—";
    }

    return value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
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

export function downloadCostBreakdownPdf(
    estimate: CostEstimate,
    projectName: string,
    projectId?: string | null
): void {
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
        creator: "Espasyo"
    });

    //==================================================
    // REPORT HEADER
    //==================================================

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

    //==================================================
    // PROJECT DETAILS
    //==================================================

    doc.setTextColor(38, 43, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text(title, margin, 41, {
        maxWidth: contentWidth
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(95, 99, 91);

    doc.text(
        projectId
            ? `Project ID: ${projectId}`
            : "Project ID: Not assigned",
        margin,
        47
    );

    doc.text(
        `Cost items: ${estimate.items.length}`,
        pageWidth - margin,
        47,
        { align: "right" }
    );

    let currentY = 53;

    //==================================================
    // COST SECTIONS
    //==================================================

    for (const section of SECTIONS) {
        const sectionItems = estimate.items.filter(item =>
            section.categories.includes(item.category)
        );

        const isWallSection =
            section.title === "WALL MATERIALS";

        const isFlooringSection =
            section.title === "FLOORING MATERIALS";

        if (currentY + 25 > pageHeight - 16) {
            doc.addPage();
            currentY = 16;
        }

        // Section heading
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

        doc.text(
            section.title,
            margin + 3,
            currentY + 5.4
        );

        currentY += 10;

        //==================================================
        // TABLE HEADERS
        //==================================================

        const head = isWallSection
            ? [[
                "Product",
                "Coats",
                "Quantity",
                "Unit",
                "Unit Rate",
                "Amount"
            ]]
            : isFlooringSection
                ? [[
                    "Item / Material",
                    "Quantity",
                    "Unit",
                    "Length (m)",
                    "Width (m)",
                    "Rate (₱/unit)",
                    "Amount"
                ]]
                : [[
                    "Item / Material",
                    "Quantity",
                    "Unit",
                    "Unit Rate",
                    "Amount"
                ]];

        //==================================================
        // TABLE ROWS
        //==================================================

        const rows = sectionItems.length > 0
            ? sectionItems.map(item => {
                // Wall material rows
                if (isWallSection) {
                    return [
                        item.name,
                        item.coats === undefined
                            ? "—"
                            : String(item.coats),
                        formatQuantity(item, true),
                        item.unit,
                        formatMoney(item.rate),
                        formatMoney(item.subtotal)
                    ];
                }

                // Flooring rows now include piece count,
                // length, and width.
                if (isFlooringSection) {
                    return [
                        item.name,
                        formatQuantity(item),
                        item.unit,
                        formatDimension(item.length),
                        formatDimension(item.width),
                        formatMoney(item.rate),
                        formatMoney(item.subtotal)
                    ];
                }

                // Furniture, doors, and windows retain
                // the original columns.
                return [
                    item.name,
                    formatQuantity(item),
                    item.unit,
                    formatMoney(item.rate),
                    formatMoney(item.subtotal)
                ];
            })
            : [
                isWallSection
                    ? [
                        "No wall paint or primer assigned.",
                        "",
                        "",
                        "",
                        "",
                        ""
                    ]
                    : isFlooringSection
                        ? [
                            "No flooring assigned.",
                            "",
                            "",
                            "",
                            "",
                            "",
                            ""
                        ]
                        : [
                            "No items in this section.",
                            "",
                            "",
                            "",
                            ""
                        ]
            ];

        //==================================================
        // TABLE STYLING
        //==================================================

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
                    0: { cellWidth: 48 },
                    1: { cellWidth: 18, halign: "center" },
                    2: { cellWidth: 25, halign: "right" },
                    3: { cellWidth: 15, halign: "center" },
                    4: { cellWidth: 39, halign: "right" },
                    5: { cellWidth: 41, halign: "right" }
                }
                : isFlooringSection
                    ? {
                        0: {
                            cellWidth: 47
                        },
                        1: {
                            cellWidth: 20,
                            halign: "center"
                        },
                        2: {
                            cellWidth: 13,
                            halign: "center"
                        },
                        3: {
                            cellWidth: 21,
                            halign: "center"
                        },
                        4: {
                            cellWidth: 21,
                            halign: "center"
                        },
                        5: {
                            cellWidth: 32,
                            halign: "right"
                        },
                        6: {
                            cellWidth: 32,
                            halign: "right"
                        }
                    }
                    : {
                        0: {
                            cellWidth: 65
                        },
                        1: {
                            cellWidth: 24,
                            halign: "right"
                        },
                        2: {
                            cellWidth: 18
                        },
                        3: {
                            cellWidth: 36,
                            halign: "right"
                        },
                        4: {
                            cellWidth: 43,
                            halign: "right"
                        }
                    },

            didParseCell: data => {
                if (
                    data.section === "body" &&
                    sectionItems.length === 0 &&
                    data.row.index === 0
                ) {
                    data.cell.styles.textColor = [
                        115,
                        118,
                        110
                    ];

                    data.cell.styles.fontStyle = "italic";
                }
            }
        });

        currentY =
            (doc.lastAutoTable?.finalY ?? currentY) + 6;
    }

    //==================================================
    // ESTIMATED TOTAL
    //==================================================

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

    doc.text(
        "ESTIMATED TOTAL",
        margin + 4,
        currentY + 10
    );

    doc.setFontSize(11);

    doc.text(
        formatMoney(estimate.total),
        pageWidth - margin - 4,
        currentY + 10,
        { align: "right" }
    );

    //==================================================
    // PAGE FOOTERS
    //==================================================

    const pageCount = doc.getNumberOfPages();

    for (
        let page = 1;
        page <= pageCount;
        page++
    ) {
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