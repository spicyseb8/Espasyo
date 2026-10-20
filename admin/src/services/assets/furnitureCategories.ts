export const FURNITURE_CATEGORY_OPTIONS = [
  ["tables", "Tables"],
  ["beds", "Beds"],
  ["decorations", "Decorations"],
  ["toilets", "Toilets"],
  ["vanity", "Vanity"],
  ["cabinets", "Cabinets"],
  ["appliances", "Appliances"],
  ["chairs", "Chairs"],
  ["sofas", "Sofas"],
  ["lavatory", "Lavatory"],
  ["shelves", "Shelves"],
] as const;

export const FURNITURE_LEGACY_CATEGORIES = [
  ["livingroom", "Living room"],
  ["bedroom", "Bedroom"],
  ["diningroom", "Dining room"],
  ["kitchen", "Kitchen"],
  ["bathroom", "Bathroom"],
  ["office", "Office"],
] as const;

export const FURNITURE_SPECIAL_CATEGORIES = [
  ["doors", "Doors"],
  ["windows", "Windows"],
] as const;

export function isOptionalFurniturePrice(category: string): boolean {
  const normalizedCategory = category
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  return (
    normalizedCategory === "decorations" ||
    normalizedCategory === "appliances"
  );
}
