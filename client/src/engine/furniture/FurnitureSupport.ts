export function isSupportedFurnitureCategory(
    category?: string
): boolean {
    if (typeof category !== "string") {
        return false;
    }

    const normalizedCategory = category
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    return [
        "table",
        "tables",
        "shelf",
        "shelves",
        "cabinet",
        "cabinets"
    ].includes(normalizedCategory);
}
