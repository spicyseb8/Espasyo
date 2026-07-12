export const WallMode = {
    Default: "default",
    Join: "join",
    Split: "split",
} as const;

export type WallMode =
    (typeof WallMode)[keyof typeof WallMode];