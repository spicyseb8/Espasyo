import { auth } from "@/firebase/firebase";
import { API_BASE_URL, projectApi } from "./projectApi";
import type { AdminCommentTargetType } from "./adminCommentEvents";

export interface CreateAdminCommentInput {
    projectId: string;
    targetType: AdminCommentTargetType;
    targetId: string | null;
    targetLabel: string;
    regionId?: string;
    text: string;
}

export interface AdminComment {
    id: string;
    projectId: string;
    targetType: AdminCommentTargetType;
    targetId: string | null;
    targetLabel: string;
    regionId?: string;
    text: string;
    adminId: string;
    adminName: string;
    createdAt: unknown;
    status?: string;
}

export async function createAdminComment(
    input: CreateAdminCommentInput
): Promise<string> {
    const text = input.text.trim();

    if (!input.projectId.trim()) {
        throw new Error("Project ID is required.");
    }

    if (!text) {
        throw new Error("Comment cannot be empty.");
    }

    const user = auth.currentUser;
    if (!user) {
        throw new Error("Sign in with an admin account to comment.");
    }

    const token = await user.getIdToken();
    const response = await fetch(
        `${API_BASE_URL}/projects/${encodeURIComponent(input.projectId.trim())}/comments`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                targetType: input.targetType,
                targetId: input.targetId,
                targetLabel: input.targetLabel,
                regionId: input.regionId,
                text
            })
        }
    );

    const result = await response.json() as {
        success?: boolean;
        message?: string;
        commentId?: string;
    };

    if (!response.ok || !result.success || !result.commentId) {
        throw new Error(result.message || "Failed to save comment.");
    }

    return result.commentId;
}

export function subscribeToAdminComments(
    projectId: string,
    callback: (comments: AdminComment[]) => void,
    onError?: (error: unknown) => void
) {
    let active = true;
    const load = async () => {
        try {
            const result = await projectApi<{ comments: AdminComment[] }>(
                `/admin/projects/${encodeURIComponent(projectId)}/comments`
            );
            if (active) {
                callback(result.comments.sort(
                    (first, second) =>
                        getTimestamp(first.createdAt) - getTimestamp(second.createdAt)
                ));
            }
        } catch (error) {
            if (active) {
            console.error(
                "Failed to load admin comments:",
                error
            );
            onError?.(error);
            }
        }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
        active = false;
        window.clearInterval(timer);
    };
}

function getTimestamp(
    value: unknown
): number {
    if (
        value &&
        typeof value === "object" &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis: () => number;
            }
        ).toMillis === "function"
    ) {
        return (
            value as {
                toMillis: () => number;
            }
        ).toMillis();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {
        const timestamp = new Date(value).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    return 0;
}