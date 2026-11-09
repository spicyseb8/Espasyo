import type { DesignInspiration } from "../services/designInspirations";

export type DesignInspirationsState =
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "empty" }
    | { kind: "populated"; designs: DesignInspiration[] };

export const NO_DESIGN_INSPIRATIONS_MESSAGE = "No design inspirations yet";

export function getDesignInspirationsState(
    loading: boolean,
    error: boolean,
    designs: DesignInspiration[],
): DesignInspirationsState {
    if (loading) return { kind: "loading" };
    if (error) return { kind: "error" };
    if (designs.length === 0) return { kind: "empty" };
    return { kind: "populated", designs };
}
