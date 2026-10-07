import {
    useEffect,
    useRef
} from "react";
import {
    useNavigate,
    useSearchParams
} from "react-router-dom";
import useEditor
    from "../../context/editor/useEditor";
import {
    getDraft
} from "../../services/projectDraftService";
import {
    clearProjectSession
} from "../../services/projectEditSessionService";
export default function DraftLoader() {
    const {
        dispatch
    } = useEditor();

    const [
        searchParams
    ] = useSearchParams();

    const navigate =
        useNavigate();

    const loadedDraftRef =
        useRef<string | null>(
            null
        );

    const draftId =
        searchParams.get(
            "draft"
        );

    useEffect(() => {
        if (!draftId) {
            return;
        }

        if (
            loadedDraftRef.current ===
            draftId
        ) {
            return;
        }

        const userId =
            localStorage.getItem(
                "espasyo_current_user_uid"
            );

        if (!userId) {
            navigate(
                "/studio",
                {
                    replace:
                        true
                }
            );
            return;
        }

        const draft =
            getDraft(
                userId,
                draftId
            );

        if (!draft) {
            navigate(
                "/studio",
                {
                    replace:
                        true
                }
            );
            return;
        }

        loadedDraftRef.current =
            draftId;

        localStorage.setItem(
            "espasyo_project_name",
            draft.projectName
        );
        clearProjectSession();
        dispatch({
            type:
                "LOAD_PROJECT",
            payload:
                draft.projectData
        });
    }, [
        dispatch,
        draftId,
        navigate
    ]);

    return null;
}