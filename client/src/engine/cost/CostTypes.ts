export type CostCategory =
    | "furniture"
    | "flooring"
    | "wallFinish"
    | "doors"
    | "windows";

export interface CostRate {
    category: CostCategory;
    name: string;
    rate: number;
    unit: string;
}

export interface CostItem {
    category: CostCategory;
    name: string;
    floorId?: string;

    quantity: number;
    unit: string;
    coats?: number;
    rate: number;
    subtotal: number;
    length?: number;
width?: number;
}

export interface CostEstimate {
    items: CostItem[];

    subtotal: number;

    total: number;
    floors: CostFloorEstimate[];
    incompleteItems?: string[];
}

export interface CostFloorEstimate {
    floorId: string;
    name: string;
    items: CostItem[];
    subtotal: number;
}