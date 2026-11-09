import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
    ArrowUp,
    Check,
    Eye,
    EyeOff,
    Hammer,
    Image as ImageIcon,
    Lock,
    MousePointer2,
    PenLine,
    Ruler,
    SlidersHorizontal,
    Square,
    Trash2,
    Unlock,
    Upload
} from "lucide-react";
import type { ManagedStructure } from "./structureTypes";
import type { StaircaseShape, StaircaseTurnDirection } from "../../../../shared/staircaseGeometry.ts";
import "./AdminToolDock.css";

export type AdminStructuralTool =
    | "select"
    | "wall"
    | "room"
    | "door"
    | "window"
    | "opening"
    | "staircase";

type CalibrationStep =
    | "idle"
    | "first-point"
    | "second-point"
    | "enter-measurement";

type DockPopover = "blueprint" | "wall" | "build" | "stairs";

interface AdminToolDockProps {
    structure: ManagedStructure;
    readOnly: boolean;
    tool: AdminStructuralTool;
    blueprintUrl: string | null;
    blueprintName: string;
    blueprintVisible: boolean;
    blueprintOpacity: number;
    blueprintLocked: boolean;
    calibrationStep: CalibrationStep;
    measuredBlueprintLength: number | null;
    actualBlueprintLength: string;
    showWallMeasurements: boolean;
    staircaseStepCount: number;
    staircaseRailings: boolean;
    staircaseShape: StaircaseShape;
    staircaseTurnDirection: StaircaseTurnDirection;
    staircasePlacementMessage: string | null;
    onToolChange: (tool: AdminStructuralTool) => void;
    onBlueprintUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onBlueprintRemove: () => void;
    onBlueprintVisibilityChange: () => void;
    onBlueprintOpacityChange: (opacity: number) => void;
    onBlueprintLockChange: () => void;
    onCalibrationStart: () => void;
    onCalibrationCancel: () => void;
    onCalibrationLengthChange: (value: string) => void;
    onCalibrationApply: () => void;
    onWallHeightChange: (height: number) => void;
    onWallThicknessChange: (thickness: number) => void;
    onShowWallMeasurementsChange: (show: boolean) => void;
    onConfirmLayout: () => void;
    onStaircaseStepCountChange: (count: number) => void;
    onStaircaseRailingsChange: (enabled: boolean) => void;
    onStaircaseShapeChange: (shape: StaircaseShape) => void;
    onStaircaseTurnDirectionChange: (direction: StaircaseTurnDirection) => void;
    /** Content of the Build library popover. Call `close` after an asset is activated. */
    renderBuildLibrary: (close: () => void) => ReactNode;
}

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "wall", label: "Walls", icon: PenLine },
    { id: "room", label: "Rooms", icon: Square },
    { id: "staircase", label: "Stairs", icon: ArrowUp }
] as const;

const STAIRCASE_SHAPES = [
    { value: "straight", label: "Straight" },
    { value: "l-shaped", label: "L-shape" },
    { value: "u-shaped", label: "U-shape" }
] as { value: StaircaseShape; label: string }[];

const TURN_DIRECTIONS = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" }
] as { value: StaircaseTurnDirection; label: string }[];

const CALIBRATION_INSTRUCTIONS: Record<CalibrationStep, string> = {
    idle: "",
    "first-point": "Click the first point of a known length.",
    "second-point": "Click the other end of that length.",
    "enter-measurement": "Enter the real distance between the points."
};

interface DockButtonProps {
    label: string;
    icon: ReactNode;
    active?: boolean;
    expanded?: boolean;
    disabled?: boolean;
    variant?: "confirm";
    title?: string;
    onClick: () => void;
}

function DockButton({
    label,
    icon,
    active,
    expanded,
    disabled,
    variant,
    title,
    onClick
}: DockButtonProps) {
    return (
        <button
            type="button"
            className={`admin-dock-btn${active ? " active" : ""}${variant ? ` ${variant}` : ""}`}
            aria-pressed={expanded === undefined ? active : undefined}
            aria-expanded={expanded}
            disabled={disabled}
            title={title ?? label}
            onClick={onClick}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function Segmented<T extends string>({
    label,
    value,
    options,
    onChange
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    return (
        <div className="admin-dock-seg" role="group" aria-label={label}>
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    className={option.value === value ? "active" : ""}
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function Switch({
    label,
    checked,
    disabled,
    onChange
}: {
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="admin-dock-toggle-row">
            <span>{label}</span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                className={`admin-dock-switch${checked ? " on" : ""}`}
                disabled={disabled}
                onClick={() => onChange(!checked)}
            >
                <span />
            </button>
        </div>
    );
}

/**
 * Bottom-centre tool dock. Every floor-plan tool is its own button; Blueprint,
 * Wall size and Build open a small popover above the dock, and the Stairs
 * options appear automatically while the staircase tool is active.
 */
export default function AdminToolDock({
    structure,
    readOnly,
    tool,
    blueprintUrl,
    blueprintName,
    blueprintVisible,
    blueprintOpacity,
    blueprintLocked,
    calibrationStep,
    measuredBlueprintLength,
    actualBlueprintLength,
    showWallMeasurements,
    staircaseStepCount,
    staircaseRailings,
    staircaseShape,
    staircaseTurnDirection,
    staircasePlacementMessage,
    onToolChange,
    onBlueprintUpload,
    onBlueprintRemove,
    onBlueprintVisibilityChange,
    onBlueprintOpacityChange,
    onBlueprintLockChange,
    onCalibrationStart,
    onCalibrationCancel,
    onCalibrationLengthChange,
    onCalibrationApply,
    onWallHeightChange,
    onWallThicknessChange,
    onShowWallMeasurementsChange,
    onConfirmLayout,
    onStaircaseStepCountChange,
    onStaircaseRailingsChange,
    onStaircaseShapeChange,
    onStaircaseTurnDirectionChange,
    renderBuildLibrary
}: AdminToolDockProps) {
    const [openPopover, setOpenPopover] = useState<Exclude<DockPopover, "stairs"> | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const layoutLocked = structure.layoutConfirmed;
    const popover: DockPopover | null = openPopover ?? (tool === "staircase" ? "stairs" : null);
    const placingAsset = tool === "door" || tool === "window" || tool === "opening";

    // Dismiss popovers on outside click / Escape. Not while calibrating: the
    // user has to click the scene to pick points and the popover holds the next step.
    useEffect(() => {
        if (!openPopover || calibrationStep !== "idle") return;
        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
            setOpenPopover(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpenPopover(null);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [openPopover, calibrationStep]);

    const togglePopover = (name: Exclude<DockPopover, "stairs">) =>
        setOpenPopover(current => (current === name ? null : name));

    const selectTool = (id: AdminStructuralTool) => {
        setOpenPopover(null);
        onToolChange(id);
    };

    return (
        <div className={`admin-dock${readOnly ? " is-readonly" : ""}`} ref={rootRef}>
            {popover === "blueprint" && (
                <section className="admin-dock-popover" aria-label="Blueprint">
                    <h3 className="admin-dock-title">Blueprint</h3>
                    {!blueprintUrl ? (
                        <label className="admin-dock-upload">
                            <Upload size={20} />
                            <span>Upload blueprint</span>
                            <small>JPG or PNG</small>
                            <input
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={onBlueprintUpload}
                            />
                        </label>
                    ) : (
                        <>
                            <div className="admin-dock-file">
                                <span title={blueprintName}>{blueprintName}</span>
                                <button
                                    type="button"
                                    className="admin-dock-icon-btn danger"
                                    onClick={onBlueprintRemove}
                                    aria-label="Remove blueprint"
                                    title="Remove blueprint"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                            <div className="admin-dock-actions">
                                <button type="button" className="admin-dock-line" onClick={onBlueprintVisibilityChange}>
                                    {blueprintVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                                    {blueprintVisible ? "Hide" : "Show"}
                                </button>
                                <button type="button" className="admin-dock-line" onClick={onBlueprintLockChange}>
                                    {blueprintLocked ? <Unlock size={15} /> : <Lock size={15} />}
                                    {blueprintLocked ? "Unlock" : "Lock"}
                                </button>
                            </div>
                            <label className="admin-dock-field">
                                <span>Opacity</span>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="1"
                                    step="0.05"
                                    value={blueprintOpacity}
                                    onChange={event => onBlueprintOpacityChange(Number(event.target.value))}
                                />
                            </label>
                            {calibrationStep === "idle" ? (
                                <button
                                    type="button"
                                    className="admin-dock-line"
                                    onClick={onCalibrationStart}
                                    disabled={blueprintLocked}
                                >
                                    <Ruler size={15} /> Calibrate scale
                                </button>
                            ) : (
                                <div className="admin-dock-calibration">
                                    <p>{CALIBRATION_INSTRUCTIONS[calibrationStep]}</p>
                                    {measuredBlueprintLength !== null && (
                                        <>
                                            <label className="admin-dock-field">
                                                <span>
                                                    Real distance ({measuredBlueprintLength.toFixed(2)} m measured)
                                                </span>
                                                <span className="admin-dock-input">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.1"
                                                        value={actualBlueprintLength}
                                                        onChange={event => onCalibrationLengthChange(event.target.value)}
                                                    />
                                                    <small>m</small>
                                                </span>
                                            </label>
                                            <button type="button" className="admin-dock-solid" onClick={onCalibrationApply}>
                                                Apply
                                            </button>
                                        </>
                                    )}
                                    <button type="button" className="admin-dock-line" onClick={onCalibrationCancel}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                            <p className="admin-dock-hint">Drag to move, R to rotate. Not saved with the project.</p>
                        </>
                    )}
                </section>
            )}

            {popover === "wall" && (
                <section className="admin-dock-popover" aria-label="Wall size">
                    <h3 className="admin-dock-title">Wall size</h3>
                    <div className="admin-dock-grid-2">
                        <label className="admin-dock-field">
                            <span>Height</span>
                            <span className="admin-dock-input">
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={structure.wallHeight}
                                    onChange={event => onWallHeightChange(Number(event.target.value))}
                                    disabled={layoutLocked}
                                />
                                <small>m</small>
                            </span>
                        </label>
                        <label className="admin-dock-field">
                            <span>Thickness</span>
                            <span className="admin-dock-input">
                                <input
                                    type="number"
                                    min="0.05"
                                    step="0.05"
                                    value={structure.wallThickness}
                                    onChange={event => onWallThicknessChange(Number(event.target.value))}
                                    disabled={layoutLocked}
                                />
                                <small>m</small>
                            </span>
                        </label>
                    </div>
                    <Switch
                        label="Show measurements"
                        checked={showWallMeasurements}
                        onChange={onShowWallMeasurementsChange}
                    />
                </section>
            )}

            {popover === "stairs" && (
                <section className="admin-dock-popover" aria-label="Staircase options">
                    <h3 className="admin-dock-title">Staircase</h3>
                    <Segmented
                        label="Shape"
                        value={staircaseShape}
                        options={STAIRCASE_SHAPES}
                        onChange={onStaircaseShapeChange}
                    />
                    {staircaseShape === "l-shaped" && (
                        <Segmented
                            label="Turn direction"
                            value={staircaseTurnDirection}
                            options={TURN_DIRECTIONS}
                            onChange={onStaircaseTurnDirectionChange}
                        />
                    )}
                    <label className="admin-dock-field">
                        <span>Steps</span>
                        <span className="admin-dock-input">
                            <input
                                type="number"
                                min="2"
                                max="80"
                                step="1"
                                value={staircaseStepCount}
                                onChange={event => onStaircaseStepCountChange(Number(event.target.value))}
                            />
                        </span>
                    </label>
                    <Switch
                        label="Railings"
                        checked={staircaseRailings}
                        onChange={onStaircaseRailingsChange}
                    />
                    {staircasePlacementMessage && (
                        <p className="admin-dock-error" role="alert">{staircasePlacementMessage}</p>
                    )}
                </section>
            )}

            {popover === "build" && (
                <section className="admin-dock-popover library" aria-label="Build library">
                    {renderBuildLibrary(() => setOpenPopover(null))}
                </section>
            )}

            <div className="admin-dock-bar" role="toolbar" aria-label="Editor tools">
                {TOOLS.map(({ id, label, icon: Icon }) => (
                    <DockButton
                        key={id}
                        label={label}
                        icon={<Icon size={20} />}
                        active={tool === id}
                        disabled={layoutLocked && (id === "wall" || id === "room")}
                        onClick={() => selectTool(id)}
                    />
                ))}
                <span className="admin-dock-sep" aria-hidden="true" />
                <DockButton
                    label="Blueprint"
                    icon={<ImageIcon size={20} />}
                    active={popover === "blueprint"}
                    expanded={popover === "blueprint"}
                    onClick={() => togglePopover("blueprint")}
                />
                <DockButton
                    label="Wall size"
                    icon={<SlidersHorizontal size={20} />}
                    active={popover === "wall"}
                    expanded={popover === "wall"}
                    onClick={() => togglePopover("wall")}
                />
                <span className="admin-dock-sep" aria-hidden="true" />
                <DockButton
                    label="Build"
                    icon={<Hammer size={20} />}
                    active={popover === "build" || placingAsset}
                    expanded={popover === "build"}
                    onClick={() => togglePopover("build")}
                />
                {!layoutLocked && (
                    <>
                        <span className="admin-dock-sep" aria-hidden="true" />
                        <DockButton
                            label="Confirm layout"
                            icon={<Check size={20} />}
                            variant="confirm"
                            onClick={() => {
                                setOpenPopover(null);
                                onConfirmLayout();
                            }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}