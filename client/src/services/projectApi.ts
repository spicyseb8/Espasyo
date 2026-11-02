import { auth } from "../firebase/firebase";

const API_BASE_URL = "http://localhost:5000/api";

export async function projectApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new Error("Please log in before saving a project.");

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
        throw new Error(result.message || "The project request failed.");
    }
    return result;
}
