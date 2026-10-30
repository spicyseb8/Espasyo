import { useState } from "react";
import type { ChangeEvent } from "react";
import {
    ChevronDown,
    ArrowUp,
    Lock,
    MousePointer2,
    PenLine,
    Ruler,
    Square,
    Trash2,
    Unlock,
    Upload
} from "lucide-react";
import type { ManagedStructure } from "./structureTypes";
import type { StaircaseShape, StaircaseTurnDirection } from "../../../../shared/staircaseGeometry.ts";
import "./AdminFloorPlanPanel.css";

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

interface AdminFloorPlanPanelProps {
    structure: ManagedStructure;
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
    status: string;
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
}

const TOOLS = [
    { id: "select", label: "Select", icon: MousePointer2 },
    { id: "wall", label: "Walls", icon: PenLine },
    { id: "room", label: "Rooms", icon: Square },
    { id: "staircase", label: "Staircase", icon: ArrowUp }
] as const;

export default function AdminFloorPlanPanel({
    structure,
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
    status,
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
    onStaircaseTurnDirectionChange
}: AdminFloorPlanPanelProps) {
    const [blueprintOpen, setBlueprintOpen] = useState(true);
    const layoutLocked = structure.layoutConfirmed;
    const calibrationInstructions: Record<CalibrationStep, string> = {
        idle: "",
        "first-point": "Select the first point of a known length.",
        "second-point": "Select the other end of that length.",
        "enter-measurement": "Enter the real distance between the points."
    };

    return (
        <div className="admin-floor-plan-panel" data-tool={tool}>
            <div className="admin-floor-plan-scroll">
            <section className={`admin-floor-group ${layoutLocked ? "is-locked" : ""}`}>
                <h3>Tools</h3>
                <div className="admin-floor-tools" role="group" aria-label="Floor plan tools">
                    {TOOLS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            className={tool === id ? "active" : ""}
                            aria-pressed={tool === id}
                            disabled={layoutLocked && id !== "staircase"}
                            onClick={() => onToolChange(id)}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
                {layoutLocked && (
                    <p className="admin-floor-note">The layout is confirmed and can no longer be edited.</p>
                )}
            </section>

            <section className="admin-floor-group admin-floor-blueprint">
                <button
                    type="button"
                    className="admin-floor-section-toggle"
                    aria-expanded={blueprintOpen}
                    onClick={() => setBlueprintOpen(open => !open)}
                >
                    <span>Blueprint</span>
                    <ChevronDown size={16} className={blueprintOpen ? "open" : ""} />
                </button>
                {blueprintOpen && (
                    <div className="admin-floor-blueprint-content">
                        {!blueprintUrl ? (
                            <label className="admin-floor-upload">
                                <Upload size={16} /> Upload blueprint
                                <input type="file" accept="image/png,image/jpeg" onChange={onBlueprintUpload} />
                            </label>
                        ) : (
                            <>
                                <span className="admin-floor-blueprint-name" title={blueprintName}>
                                    {blueprintName}
                                </span>
                                <div className="admin-floor-blueprint-actions">
                                    <button type="button" onClick={onBlueprintVisibilityChange}>
                                        {blueprintVisible ? "Hide blueprint" : "Show blueprint"}
                                    </button>
                                    <button type="button" onClick={onBlueprintLockChange}>
                                        {blueprintLocked ? <Unlock size={15} /> : <Lock size={15} />}
                                        {blueprintLocked ? "Unlock" : "Lock"}
                                    </button>
                                </div>
                                <label className="admin-floor-field">
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
                                <p className="admin-floor-note">
                                    Drag to position; press R to rotate. Blueprint is temporary.
                                </p>
                                {calibrationStep === "idle" ? (
                                    <button
                                        type="button"
                                        onClick={onCalibrationStart}
                                        disabled={blueprintLocked}
                                    >
                                        <Ruler size={15} /> Calibrate scale
                                    </button>
                                ) : (
                                    <div className="admin-floor-calibration">
                                        <p>{calibrationInstructions[calibrationStep]}</p>
                                        {measuredBlueprintLength !== null && (
                                            <>
                                                <p>Measured distance: {measuredBlueprintLength.toFixed(2)} m</p>
                                                <label className="admin-floor-field">
                                                    <span>Real distance (m)</span>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.1"
                                                        value={actualBlueprintLength}
                                                        onChange={event => onCalibrationLengthChange(event.target.value)}
                                                    />
                                                </label>
                                                <button type="button" onClick={onCalibrationApply}>
                                                    Apply calibration
                                                </button>
                                            </>
                                        )}
                                        <button type="button" className="secondary" onClick={onCalibrationCancel}>
                                            Cancel calibration
                                        </button>
                                    </div>
                                )}
                                <button type="button" className="admin-floor-remove-blueprint" onClick={onBlueprintRemove}>
                                    <Trash2 size={15} /> Remove blueprint
                                </button>
                            </>
                        )}
                        {status && <p className="admin-floor-status">{status}</p>}
                    </div>
                )}
            </section>

            {tool === "staircase" && (
                <section className="admin-floor-group admin-floor-staircase-controls">
                    <h3>Staircase</h3>
                    <label className="admin-floor-field">
                        <span>Shape</span>
                        <select
                            value={staircaseShape}
                            onChange={event => onStaircaseShapeChange(event.target.value as StaircaseShape)}
                        >
                            <option value="straight">Straight</option>
                            <option value="l-shaped">L-shaped (90° turn)</option>
                            <option value="u-shaped">U-shaped (180° turn)</option>
                        </select>
                    </label>
                    {staircaseShape === "l-shaped" && (
                        <label className="admin-floor-field">
                            <span>Turn Direction</span>
                            <select
                                value={staircaseTurnDirection}
                                onChange={event =>
                                    onStaircaseTurnDirectionChange(event.target.value as StaircaseTurnDirection)
                                }
                            >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </select>
                        </label>
                    )}
                    <label className="admin-floor-field">
                        <span>Number of Steps</span>
                        <input
                            type="number"
                            min="2"
                            max="80"
                            step="1"
                            value={staircaseStepCount}
                            onChange={event => onStaircaseStepCountChange(Number(event.target.value))}
                        />
                    </label>
                    <label className="admin-floor-staircase-railing">
                        <input
                            type="checkbox"
                            checked={staircaseRailings}
                            onChange={event => onStaircaseRailingsChange(event.target.checked)}
                        />
                        <span>Include Railings</span>
                    </label>
                    {staircasePlacementMessage && (
                        <p className="admin-floor-note admin-floor-staircase-message" role="alert">
                            {staircasePlacementMessage}
                        </p>
                    )}
                </section>
            )}

            <section className={`admin-floor-group ${layoutLocked ? "is-locked" : ""}`}>
                <h3>Wall Settings</h3>
                <div className="admin-floor-wall-settings">
                    <label className="admin-floor-field">
                        <span>Height</span>
                        <span className="admin-floor-input-wrap">
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
                    <label className="admin-floor-field">
                        <span>Thickness</span>
                        <span className="admin-floor-input-wrap">
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
                <div className="admin-floor-measurement-toggle">
                    <span id="admin-show-wall-measurements-label">Show Wall Measurements</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showWallMeasurements}
                        aria-labelledby="admin-show-wall-measurements-label"
                        className={showWallMeasurements ? "on" : ""}
                        onClick={() => onShowWallMeasurementsChange(!showWallMeasurements)}
                        disabled={layoutLocked}
                    >
                        <span />
                    </button>
                </div>
            </section>

            </div>

            <section className="admin-floor-group admin-floor-confirm">
                <h3>Layout</h3>
                {layoutLocked ? (
                    <p>Layout confirmed</p>
                ) : (
                    <>
                        <p>Confirm when the wall and room layout is ready for building.</p>
                        <button type="button" onClick={onConfirmLayout}>
                            Confirm Layout
                        </button>
                    </>
                )}
            </section>
        </div>
    );
}
