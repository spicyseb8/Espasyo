export function captureSceneThumbnail(): string {
    const canvas =
        document.querySelector(
            ".viewport canvas"
        ) as HTMLCanvasElement | null;

    if (
        !canvas
    ) {
        return "";
    }

    try {
        return canvas.toDataURL(
            "image/jpeg",
            0.85
        );
    } catch {
        return "";
    }
}