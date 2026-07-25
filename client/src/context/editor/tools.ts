export const Tool = {

    Select: "select",

    Wall: "wall"


} as const;

export type Tool = typeof Tool[keyof typeof Tool];