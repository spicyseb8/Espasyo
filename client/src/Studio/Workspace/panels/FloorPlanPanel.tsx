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
  const regions = solveRegions(state.corners, state.walls);
  const regionDebug = regions.length
    ? regions.map((region) => ({
        id: region.id,
        parent: region.parentRegionId ?? "root",
        children: region.childRegionIds.length,
        shares: region.relationshipSummary.join(",") || "none"
      }))
    : [];

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

        {regionDebug.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#7a7a7a" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Regions</div>
            {regionDebug.map((region) => (
              <div key={region.id} style={{ lineHeight: 1.4 }}>
                {region.id.slice(0, 8)} · parent: {region.parent} · children: {region.children} · {region.shares}
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}