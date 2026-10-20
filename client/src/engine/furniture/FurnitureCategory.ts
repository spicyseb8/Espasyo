export type FurnitureCategory =
    | "tables"
    | "beds"
    | "decorations"
    | "toilets"
    | "vanity"
    | "cabinets"
    | "appliances"
    | "chairs"
    | "sofas"
    | "lavatory"
    | "shelves"
    | "livingRoom"
    | "bedroom"
    | "diningRoom"
    | "kitchen"
    | "bathroom"
    | "office";

export const FURNITURE_CATEGORY_SECTIONS = [
    { title: "Tables", category: "tables" },
    { title: "Beds", category: "beds" },
    { title: "Decorations", category: "decorations" },
    { title: "Toilets", category: "toilets" },
    { title: "Vanity", category: "vanity" },
    { title: "Cabinets", category: "cabinets" },
    { title: "Appliances", category: "appliances" },
    { title: "Chairs", category: "chairs" },
    { title: "Sofas", category: "sofas" },
    { title: "Lavatory", category: "lavatory" },
    { title: "Shelves", category: "shelves" },
    { title: "Living Room", category: "livingRoom" },
    { title: "Bedroom", category: "bedroom" },
    { title: "Dining Room", category: "diningRoom" },
    { title: "Kitchen", category: "kitchen" },
    { title: "Bathroom", category: "bathroom" },
    { title: "Office", category: "office" },
] as const satisfies readonly {
    title: string;
    category: FurnitureCategory;
}[];