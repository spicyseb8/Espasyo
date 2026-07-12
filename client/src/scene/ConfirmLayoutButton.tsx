import "./ConfirmLayoutButton.css";
import useEditor from "../context/editor/useEditor";
import { CircleCheck } from "lucide-react";

export default function ConfirmLayoutButton() {
    const { state, dispatch } = useEditor();

    if (
        state.layoutConfirmed ||
        state.activeTab !== "floorplan"
    ) {
        return null;
    }

    const handleConfirm = () => {
        const confirmed = window.confirm(
            "Once you confirm the layout, walls and rooms can no longer be edited.\n\nContinue?"
        );

        if (!confirmed) return;

        dispatch({
            type: "CONFIRM_LAYOUT",
        });
    };

    return (
        <button
            className="confirm-layout-button"
            onClick={handleConfirm}
        >
            <span>Confirm Layout</span>
            <CircleCheck size={18} />
        </button>
    );
}