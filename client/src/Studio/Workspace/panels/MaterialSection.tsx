import "./MaterialSection.css";

import {
    Check
} from "lucide-react";

import type {
    Material
} from "../../../engine/materials/MaterialTypes";

import MaterialCard
    from "./MaterialCard";

interface Props {

    title: string;

    materials: Material[];

    selectedMaterialId:
        string | null;

    onSelect:
        (materialId: string) => void;

    onApply?:
        () => void;

    onApplyToRoom?:
        () => void;

    onApplyToAll?:
        () => void;

    canApply?: boolean;

    canApplyToRoom?: boolean;

    canApplyToAll?: boolean;

    applyLabel?: string;

    applyToRoomLabel?: string;

    applyToAllLabel?: string;

}

export default function MaterialSection({

    title,

    materials,

    selectedMaterialId,

    onSelect,

    onApply,

    onApplyToRoom,

    onApplyToAll,

    canApply = false,

    canApplyToRoom = false,

    canApplyToAll = false,

    applyLabel = "Apply",

    applyToRoomLabel = "Apply to Room",

    applyToAllLabel = "Apply to All"

}: Props) {

    return (

        <section
            className="material-section"
        >

            {/* =========================================
                HEADER
                ========================================= */}

            <div
                className="material-section-header"
            >

                <span
                    className="material-section-title"
                >

                    {title}

                    <span
                        className="material-section-count"
                    >
                        {
                            materials.length
                        }
                    </span>

                </span>

            </div>

            {/* =========================================
                SCROLLABLE MATERIAL AREA
                ========================================= */}

            <div
                className="material-scroll"
            >

                {
                    materials.length > 0

                        ? (

                            <div
                                className="material-grid"
                            >

                                {
                                    materials.map(
                                        material => (

                                            <MaterialCard

                                                key={
                                                    material.id
                                                }

                                                material={
                                                    material
                                                }

                                                selected={
                                                    selectedMaterialId ===
                                                    material.id
                                                }

                                                onClick={() =>
                                                    onSelect(
                                                        material.id
                                                    )
                                                }

                                            />

                                        )
                                    )
                                }

                            </div>

                        )

                        : (

                            <p
                                className="material-empty"
                            >
                                No materials available.
                            </p>

                        )
                }

            </div>

            {/* =========================================
                ACTION BUTTONS
                ========================================= */}

            {
                (
                    onApply ||
                    onApplyToRoom ||
                    onApplyToAll
                ) && (

                    <div
                        className="material-actions"
                    >

                        {
                            onApply && (

                                <button

                                    type="button"

                                    className="material-apply-button"

                                    disabled={
                                        !canApply
                                    }

                                    onClick={
                                        onApply
                                    }

                                >

                                    <Check
                                        size={15}
                                    />

                                    {
                                        applyLabel
                                    }

                                </button>

                            )
                        }

                        {
                            onApplyToRoom && (

                                <button

                                    type="button"

                                    className="material-apply-room-button"

                                    disabled={
                                        !canApplyToRoom
                                    }

                                    onClick={
                                        onApplyToRoom
                                    }

                                >

                                    {
                                        applyToRoomLabel
                                    }

                                </button>

                            )
                        }

                        {
                            onApplyToAll && (

                                <button

                                    type="button"

                                    className="material-apply-all-button"

                                    disabled={
                                        !canApplyToAll
                                    }

                                    onClick={
                                        onApplyToAll
                                    }

                                >

                                    {
                                        applyToAllLabel
                                    }

                                </button>

                            )
                        }

                    </div>

                )
            }

        </section>
    );
}