import "./WalkthroughUI.css";

import { Accessibility } from "lucide-react";

import useEditor from "../../context/editor/useEditor";

interface WalkthroughUIProps {
    spawnConfirmed: boolean;
}

export default function WalkthroughUI({
    spawnConfirmed,
}: WalkthroughUIProps) {
    const {
        state,
        dispatch,
    } = useEditor();

function handleWalkthrough() {
    if (
        !state.walkthroughMode &&
        state.walls.length < 4
    ) {
        alert(
            "Create a room first before entering Walkthrough."
        );

        return;
    }

    dispatch({
        type: "TOGGLE_WALKTHROUGH",
    });
}

    return (
        <>
            {state.walkthroughMode && !spawnConfirmed && (
                <div className="walkthrough-ui-message">
                    <div className="walkthrough-ui-message-card">
                        <div className="walkthrough-ui-message-title">
                            Choose your starting point
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                className={`walkthrough-ui-button ${
                    state.walkthroughMode
                        ? "active"
                        : ""
                }`}
                onClick={handleWalkthrough}
                title={
                    state.walkthroughMode
                        ? "Exit Walkthrough"
                        : "Start Walkthrough"
                }
                aria-label={
                    state.walkthroughMode
                        ? "Exit Walkthrough"
                        : "Start Walkthrough"
                }
                aria-pressed={
                    state.walkthroughMode
                }
            >
                <Accessibility
                    size={18}
                    strokeWidth={1.9}
                />
            </button>
        </>
    );
}
