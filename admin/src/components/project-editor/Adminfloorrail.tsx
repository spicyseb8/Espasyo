import { Plus, Trash2 } from "lucide-react";
import type { ManagedEditorFloor } from "./structureTypes";
import "./AdminFloorRail.css";

interface AdminFloorRailProps {
    floors: ManagedEditorFloor[];
    activeFloorId: string | null;
    canAdd: boolean;
    canDelete: boolean;
    onSelect: (floorId: string) => void;
    onAdd: () => void;
    onDelete: () => void;
}

/** Vertical floor switcher pinned to the right-middle of the scene: 1F, 2F, … then "+". */
export default function AdminFloorRail({
    floors,
    activeFloorId,
    canAdd,
    canDelete,
    onSelect,
    onAdd,
    onDelete
}: AdminFloorRailProps) {
    return (
        <nav className="admin-floor-rail" aria-label="Floors">
            {floors.map((floor, index) => {
                const active = floor.floorId === activeFloorId;
                return (
                    <button
                        key={floor.floorId}
                        type="button"
                        className={`admin-floor-rail-box${active ? " active" : ""}`}
                        aria-current={active ? "true" : undefined}
                        aria-label={floor.name}
                        title={floor.name}
                        onClick={() => onSelect(floor.floorId)}
                    >
                        {index + 1}F
                    </button>
                );
            })}
            <button
                type="button"
                className="admin-floor-rail-box delete"
                aria-label={`Delete ${floors.find(floor => floor.floorId === activeFloorId)?.name ?? "selected floor"}`}
                title={canDelete ? "Delete selected floor" : "A project must have at least one floor"}
                disabled={!canDelete}
                onClick={onDelete}
            >
                <Trash2 size={17} />
            </button>
            <button
                type="button"
                className="admin-floor-rail-box add"
                aria-label="Add floor"
                title="Add floor"
                disabled={!canAdd}
                onClick={onAdd}
            >
                <Plus size={18} />
            </button>
        </nav>
    );
}