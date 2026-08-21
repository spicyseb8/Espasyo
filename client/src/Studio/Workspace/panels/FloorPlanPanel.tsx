import "./FloorPlanPanel.css";
import { MousePointer2, PenLine, Square } from "lucide-react";
import useEditor from "../../../context/editor/useEditor";
import { Tool } from "../../../context/editor/tools";
import { solveRegions } from "../../../engine/regions/RegionSolver";

// NOTE: this assumes `Tool.Room` exists in ../../../context/editor/tools.
// If your Tool enum doesn't have a "draw rooms" tool yet, add one there
// (or swap TOOLS below to point at whatever the equivalent action is).
const TOOLS = [
  { tool: Tool.Select, label: "Select", icon: MousePointer2 },
  { tool: Tool.Wall, label: "Walls", icon: PenLine },
  { tool: Tool.Room, label: "Rooms", icon: Square }
] as const;

export default function FloorPlanPanel() {
  const { state, dispatch } = useEditor();

  const locked = state.layoutConfirmed;

  // ==========================================================
  // Measurement section - live drag length, or the selected
  // wall/floor's measurement.
  //
  // NOTE: the fields read below aren't ones I've seen in your
  // editor state yet, so I'm guessing reasonable names. Rename
  // these to match your actual reducer, or tell me the real
  // field names and I'll wire it up exactly:
  //
  // - state.draftWallLength: number | null
  //     Set by WallDrawer.tsx on every frame while a wall is
  //     actively being dragged out (e.g.
  //     dispatch({ type: "SET_DRAFT_WALL_LENGTH", payload: length })),
  //     and cleared back to null when the drag ends/finishes.
  //     Without this dispatch added to WallDrawer.tsx, this will
  //     just stay null and the section falls through to the
  //     selection case below.
  //
  // - state.selectedWallId / state.selectedRegionId: string | null
  //     Whatever your <ClearSelection /> component (seen in
  //     Scene.tsx) already manages.
  // ==========================================================

  const draftWallLength = state.draftWallLength ?? null;

  const selectedWallId = state.selectedWallId ?? null;
  const selectedRegionId = state.selectedRegionId ?? null;

  const selectedWall = selectedWallId
    ? state.walls.find((wall) => wall.id === selectedWallId) ?? null
    : null;

  const selectedWallLength = selectedWall
    ? selectedWall.start.position.distanceTo(selectedWall.end.position)
    : null;

  const selectedRegionArea = selectedRegionId
    ? solveRegions(state.corners, state.walls).find((region) => region.id === selectedRegionId)?.area ?? null
    : null;

  let measurementCaption: string | null = null;
  let measurementValue: string | null = null;
  let isLive = false;

  const handleConfirmLayout = () => {
  const confirmed = window.confirm(
    "Once you confirm the layout, walls and rooms can no longer be edited.\n\nContinue?"
  );

  if (!confirmed) return;

  dispatch({
    type: "CONFIRM_LAYOUT"
  });

  dispatch({
    type: "SET_ACTIVE_TOOL",
    payload: Tool.None
  });
};

  if (draftWallLength !== null) {
    measurementCaption = "Drawing Wall";
    measurementValue = `${draftWallLength.toFixed(2)} m`;
    isLive = true;
  } else if (selectedWallLength !== null) {
    measurementCaption = "Selected Wall";
    measurementValue = `${selectedWallLength.toFixed(2)} m`;
  } else if (selectedRegionArea !== null) {
    measurementCaption = "Selected Floor";
    measurementValue = `${selectedRegionArea.toFixed(2)} m²`;
  }

  return (
    <div className="panel">

      {/* ========================= */}
      {/* Tools */}
      {/* ========================= */}

      <div className="panel-group">
        <h3>Tools</h3>

        <div className="tool-switcher" role="group" aria-label="Drawing tools">
          {TOOLS.map(({ tool, label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              disabled={locked}
              className={`tool-switch-button ${state.activeTool === tool ? "active" : ""}`}
              aria-pressed={state.activeTool === tool}
              onClick={() =>
                dispatch({
                  type: "SET_ACTIVE_TOOL",
                  payload: tool
                })
              }
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================= */}
      {/* Wall Settings */}
      {/* ========================= */}

      <div className="panel-group">

        <h3>Wall Settings</h3>

        <div className="field-grid">

          <div className="field">
            <label htmlFor="wall-height">Height</label>
            <div className="field-input">
              <input
                id="wall-height"
                disabled={locked}
                type="number"
                value={state.wallHeight}
                step="0.1"
                onChange={(e) =>
                  dispatch({
                    type: "SET_WALL_HEIGHT",
                    payload: Number(e.target.value)
                  })
                }
              />
              <span className="field-unit">m</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="wall-thickness">Thickness</label>
            <div className="field-input">
              <input
                id="wall-thickness"
                disabled={locked}
                type="number"
                value={state.wallThickness}
                step="0.05"
                onChange={(e) =>
                  dispatch({
                    type: "SET_WALL_THICKNESS",
                    payload: Number(e.target.value)
                  })
                }
              />
              <span className="field-unit">m</span>
            </div>
          </div>

        </div>

        <div className="toggle-row">
          <span className="toggle-row-label" id="show-wall-measurements-label">
            Show Wall Measurements
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={state.showWallMeasurements}
            aria-labelledby="show-wall-measurements-label"
            className={`toggle-switch ${state.showWallMeasurements ? "on" : ""}`}
            onClick={() =>
              dispatch({
                type: "SET_SHOW_WALL_MEASUREMENTS",
                payload: !state.showWallMeasurements
              })
            }
          />
        </div>

      </div>

      {/* ========================= */}
      {/* Measurement */}
      {/* ========================= */}

      <div className="panel-group">
        <h3>Measurement</h3>

        {measurementCaption && measurementValue ? (
          <div className="measurement-row">
            <span className="measurement-caption">
              {isLive && <span className="live-dot" />}
              {measurementCaption}
            </span>
            <span className="measurement-value">{measurementValue}</span>
          </div>
        ) : (
          <div className="measurement-empty">
            Draw a wall or select a wall/floor
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* Confirm Layout */}
      {/* ========================= */}

      {!locked && (
        <button
          type="button"
          className="start-button"
          onClick={handleConfirmLayout}
        >
          Confirm Layout
        </button>
      )}

    </div>
  );
}