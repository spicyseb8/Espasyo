import { auth } from "../firebase/firebase";
import type { User } from "firebase/auth";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
if (!configuredApiBaseUrl && !import.meta.env.DEV) {
    throw new Error("VITE_API_BASE_URL must be configured for production.");
}

const API_BASE_URL = (configuredApiBaseUrl || "http://localhost:5000/api")
    .replace(/\/+$/, "");

export async function projectApi<T>(
    path: string,
    init: RequestInit = {},
    user: User | null = auth.currentUser,
): Promise<T> {
    if (!user) throw new Error("Please log in before saving a project.");

    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid) {
        throw new Error("Your session changed. Please retry the request.");
    }
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
        throw new Error(result.message || "The project request failed.");
    }
    return result;
}
