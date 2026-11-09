import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import EditorProvider from "../context/EditorProvider";
import useEditor from "../context/editor/useEditor";
import { preloadProjectAssets } from "../engine/AssetPreloader";
import LoadingScreen from "../scene/LoadingScreen";
import Editor from "../Studio/Editor/Editor";
import { ProjectApiError } from "../services/projectApi";
import {
    getPublicProjectPreview,
    toEditorProjectData
} from "../services/publicProjectPreview";

const REVALIDATION_INTERVAL_MS = 3 * 60 * 1000;

type PreviewStatus = "loading" | "ready" | "unavailable" | "error";

function StudioInspirationPreviewContent() {
    const { publicId } = useParams<{ publicId: string }>();
    const { dispatch } = useEditor();
    const [attempt, setAttempt] = useState(0);
    const [loadedPreview, setLoadedPreview] = useState<{
        publicId: string | undefined;
        attempt: number;
        status: PreviewStatus;
        title: string;
    }>({
        publicId,
        attempt: 0,
        status: "loading",
        title: ""
    });
    const revalidationInFlight = useRef(false);
    const loadGeneration = useRef(0);
    const status = !publicId
        ? "unavailable"
        : loadedPreview.publicId === publicId && loadedPreview.attempt === attempt
            ? loadedPreview.status
            : "loading";
    const title = loadedPreview.publicId === publicId
        ? loadedPreview.title
        : "";

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const generation = ++loadGeneration.current;
        dispatch({ type: "CLEAR_PROJECT" });

        if (!publicId) {
            return () => controller.abort();
        }

        void (async () => {
            try {
                const preview = await getPublicProjectPreview(publicId, controller.signal);
                await preloadProjectAssets(preview.projectData);
                if (cancelled || generation !== loadGeneration.current) return;
                const editorProjectData = toEditorProjectData(preview);
                dispatch({
                    type: "LOAD_PROJECT",
                    payload: editorProjectData
                });
                setLoadedPreview({
                    publicId,
                    attempt,
                    status: "ready",
                    title: preview.title
                });
            } catch (error) {
                if (
                    cancelled ||
                    controller.signal.aborted ||
                    generation !== loadGeneration.current
                ) return;
                if (error instanceof ProjectApiError && error.status === 404) {
                    dispatch({ type: "CLEAR_PROJECT" });
                    setLoadedPreview({
                        publicId,
                        attempt,
                        status: "unavailable",
                        title: ""
                    });
                    return;
                }
                console.error("Unable to load public design preview:", error);
                setLoadedPreview({
                    publicId,
                    attempt,
                    status: "error",
                    title: ""
                });
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [attempt, dispatch, publicId]);

    const revalidate = useCallback(async () => {
        if (!publicId || revalidationInFlight.current) return;
        revalidationInFlight.current = true;
        const generation = loadGeneration.current;
        try {
            await getPublicProjectPreview(publicId);
            if (generation !== loadGeneration.current) return;
        } catch (error) {
            if (generation !== loadGeneration.current) return;
            if (error instanceof ProjectApiError && error.status === 404) {
                dispatch({ type: "CLEAR_PROJECT" });
                setLoadedPreview({
                    publicId,
                    attempt,
                    status: "unavailable",
                    title: ""
                });
                return;
            }
            console.error("Unable to revalidate public design preview:", error);
        } finally {
            revalidationInFlight.current = false;
        }
    }, [attempt, dispatch, publicId]);

    useEffect(() => {
        if (status !== "ready") return;
        const timer = window.setInterval(
            () => void revalidate(),
            REVALIDATION_INTERVAL_MS
        );
        return () => window.clearInterval(timer);
    }, [revalidate, status]);

    if (status === "loading") {
        return <LoadingScreen label="Loading design inspiration" />;
    }

    if (status === "unavailable") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] p-6 text-[#1b1b1b]">
                <section className="max-w-lg text-center">
                    <p role="status" className="text-lg font-semibold">
                        This design is no longer available.
                    </p>
                    <Link
                        to="/studio"
                        className="mt-5 inline-flex rounded-lg bg-[#1b1b1b] px-4 py-2.5 text-sm font-medium text-white"
                    >
                        Back to Studio
                    </Link>
                </section>
            </main>
        );
    }

    if (status === "error") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] p-6 text-[#1b1b1b]">
                <section className="max-w-lg text-center">
                    <p role="alert" className="text-lg font-semibold">
                        Unable to load this design right now.
                    </p>
                    <div className="mt-5 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => setAttempt(value => value + 1)}
                            className="rounded-lg bg-[#1b1b1b] px-4 py-2.5 text-sm font-medium text-white"
                        >
                            Try again
                        </button>
                        <Link
                            to="/studio"
                            className="rounded-lg border border-black/15 px-4 py-2.5 text-sm"
                        >
                            Back to Studio
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return <Editor viewOnly viewOnlyTitle={title} />;
}

export default function StudioInspirationPreview() {
    return (
        <EditorProvider viewOnly>
            <StudioInspirationPreviewContent />
        </EditorProvider>
    );
}
