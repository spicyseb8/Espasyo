import { auth } from "@/firebase/firebase";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
if (!configuredApiBaseUrl && !import.meta.env.DEV) {
    throw new Error("VITE_API_BASE_URL must be configured for production.");
}

export const API_BASE_URL = (configuredApiBaseUrl || "http://localhost:5000/api")
    .replace(/\/+$/, "");

export async function projectApi<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in with an admin account before managing floor plans.");

    const token = await user.getIdToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers
    });
    const result = await response.json() as {
        success?: boolean;
        message?: string;
    } & T;

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "The floor-plan request failed.");
    }

    return result;
}
