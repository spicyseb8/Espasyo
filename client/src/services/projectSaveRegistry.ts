export type ProjectSaveHandler = () => Promise<boolean>;

let saveHandler: ProjectSaveHandler | null = null;
let saveErrorReader: (() => string) | null = null;

export function registerProjectSave(
    handler: ProjectSaveHandler,
    readError: () => string
): () => void {
    saveHandler = handler;
    saveErrorReader = readError;

    return () => {
        if (saveHandler !== handler) return;
        saveHandler = null;
        saveErrorReader = null;
    };
}

export async function saveRegisteredProject(): Promise<boolean> {
    return saveHandler ? saveHandler() : false;
}

export function getRegisteredProjectSaveError(): string {
    return saveErrorReader?.() ?? "";
}
