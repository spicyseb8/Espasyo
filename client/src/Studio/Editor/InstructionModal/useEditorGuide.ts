import { useCallback, useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { getUserProfileByAuthUid } from "../../../firebase/user";
import { db } from "../../../firebase/firebase";

export default function useEditorGuide(userId: string | undefined, eligible: boolean) {
    const [autoOpenUserId, setAutoOpenUserId] = useState<string | null>(null);
    const resolvedUserId = useRef<string | null>(null);
    const activeRead = useRef<{ userId: string; token: symbol } | null>(null);
    const profileDocumentId = useRef<string | null>(null);

    useEffect(() => {
        if (!userId) {
            resolvedUserId.current = null;
            activeRead.current = null;
            profileDocumentId.current = null;
            return;
        }
        if (
            !eligible ||
            resolvedUserId.current === userId ||
            activeRead.current?.userId === userId
        ) return;

        const token = Symbol(userId);
        activeRead.current = { userId, token };
        let cancelled = false;

        void getUserProfileByAuthUid(userId)
            .then(profile => {
                if (cancelled || activeRead.current?.token !== token) return;
                if (!profile) {
                    throw new Error("The client profile could not be found.");
                }

                resolvedUserId.current = userId;
                activeRead.current = null;
                profileDocumentId.current = profile.id;
                const guides = profile.guides;
                const editorGuideSeenAt =
                    guides && typeof guides === "object" && "editorGuideSeenAt" in guides
                        ? guides.editorGuideSeenAt
                        : null;
                setAutoOpenUserId(editorGuideSeenAt ? null : userId);
            })
            .catch(error => {
                if (cancelled || activeRead.current?.token !== token) return;
                resolvedUserId.current = userId;
                activeRead.current = null;
                console.error("Unable to check whether the editor guide was seen:", error);
                setAutoOpenUserId(null);
            });

        return () => {
            cancelled = true;
            if (activeRead.current?.token === token) activeRead.current = null;
        };
    }, [eligible, userId]);

    const markSeen = useCallback(() => {
        setAutoOpenUserId(null);
        if (!userId) return;

        void (async () => {
            let documentId = profileDocumentId.current;
            if (!documentId) {
                const profile = await getUserProfileByAuthUid(userId);
                if (!profile) {
                    throw new Error("The client profile could not be found.");
                }
                documentId = profile.id;
                profileDocumentId.current = documentId;
            }

            await updateDoc(doc(db, "users", documentId), {
                "guides.editorGuideSeenAt": serverTimestamp(),
            });
        })().catch(error => {
            console.error("Unable to save that the editor guide was seen:", error);
        });
    }, [userId]);

    return {
        autoOpen: Boolean(userId && autoOpenUserId === userId),
        markSeen,
    };
}
