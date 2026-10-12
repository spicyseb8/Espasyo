import {
    collection,
    onSnapshot,
    query,
    where
} from "firebase/firestore";
import {
    db
} from "@/firebase/firebase";
import type {
    AdminCommentTargetType
} from "./adminCommentEvents";

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

export function subscribeToAdminComments(
    projectId: string,
    callback: (
        comments: AdminComment[]
    ) => void,
    onError?: (
        error: unknown
    ) => void
) {
    const commentsQuery =
        query(
            collection(
                db,
                "adminComments"
            ),
            where(
                "projectId",
                "==",
                projectId
            )
        );

    return onSnapshot(
        commentsQuery,
        snapshot => {
            const comments =
                snapshot.docs.map(
                    document => {
                        const data =
                            document.data();

                        return {
                            id:
                                document.id,
                            projectId:
                                typeof data.projectId ===
                                "string"
                                    ? data.projectId
                                    : projectId,
                            targetType:
                                data.targetType as AdminCommentTargetType,
                            targetId:
                                typeof data.targetId ===
                                "string"
                                    ? data.targetId
                                    : null,
                            targetLabel:
                                typeof data.targetLabel ===
                                "string"
                                    ? data.targetLabel
                                    : "Project",
                            regionId:
                                typeof data.regionId ===
                                "string"
                                    ? data.regionId
                                    : undefined,
                            text:
                                typeof data.text ===
                                "string"
                                    ? data.text
                                    : "",
                            adminId:
                                typeof data.adminId ===
                                "string"
                                    ? data.adminId
                                    : "",
                            adminName:
                                typeof data.adminName ===
                                "string"
                                    ? data.adminName
                                    : "Admin",
                            createdAt:
                                data.createdAt,
                            status:
                                typeof data.status ===
                                "string"
                                    ? data.status
                                    : undefined
                        } satisfies AdminComment;
                    }
                );

            comments.sort(
                (
                    first,
                    second
                ) =>
                    getTimestamp(
                        first.createdAt
                    ) -
                    getTimestamp(
                        second.createdAt
                    )
            );

            callback(
                comments
            );
        },
        error => {
            console.error(
                "Failed to load admin comments:",
                error
            );

            onError?.(
                error
            );
        }
    );
}

function getTimestamp(
    value: unknown
): number {
    if (
        value &&
        typeof value ===
            "object" &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis:
                    () => number;
            }
        ).toMillis ===
            "function"
    ) {
        return (
            value as {
                toMillis:
                    () => number;
            }
        ).toMillis();
    }

    if (
        value instanceof Date
    ) {
        return value.getTime();
    }

    if (
        typeof value ===
        "number"
    ) {
        return value;
    }

    if (
        typeof value ===
        "string"
    ) {
        const date =
            new Date(
                value
            );

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {
            return date.getTime();
        }
    }

    return 0;
}