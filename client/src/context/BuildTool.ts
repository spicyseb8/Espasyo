export type BuildTool = "none" | "opening" | "door" | "window" | "furniture";

// Optional: create a const object for the values
export const BuildTool = {
    None: "none" as const,
    Opening: "opening" as const,
    Door: "door" as const,
    Window: "window" as const,
    Furniture: "furniture" as const
} as const;

// Usage:
// type: BuildTool = "none" | "opening" | "door" | "window"
// value: BuildTool.None = "none"