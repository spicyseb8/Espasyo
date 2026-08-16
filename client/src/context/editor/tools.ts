export const Tool = {

    Select: "select",

    Wall: "wall",

    Room: "room"

} as const;

export type Tool = typeof Tool[keyof typeof Tool];