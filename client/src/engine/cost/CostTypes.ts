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

    quantity: number;
    unit: string;

    rate: number;
    subtotal: number;
}

export interface CostEstimate {
    items: CostItem[];

    subtotal: number;

    total: number;
}