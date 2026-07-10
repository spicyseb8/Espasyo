export const Tool = {

    Select: "select",

    Wall: "wall",

    RectangleRoom: "rectangle",


} as const;

export type Tool = typeof Tool[keyof typeof Tool];