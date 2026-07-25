import "./FloorPlanPanel.css";
import { Square, Columns2, SquareSplitHorizontal, Play, Octagon } from "lucide-react";
import useEditor from "../../../context/editor/useEditor";
import { Tool } from "../../../context/editor/tools";
import { WallMode } from "../../../context/WallMode";

const WALL_MODES = [
    { mode: WallMode.Default, icon: Square, label: "Straight" },
    { mode: WallMode.Join, icon: Columns2, label: "Join" },
    { mode: WallMode.Split, icon: SquareSplitHorizontal, label: "Split" },
];

export default function FloorPlanPanel() {
  const { state, dispatch } = useEditor();

  const isDrawing = state.activeTool === "wall";
  const locked = state.layoutConfirmed;

  return (
    <div className="panel">


      <section className="panel-section">

        <h3>Drawing Tools</h3>

        <div className="wall-actions">
          {WALL_MODES.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              disabled={locked}
              title={label}
              aria-label={label}
              className={`wall-icon-button ${state.wallMode === mode ? "active" : ""}`}
              onClick={() => dispatch({ type: "SET_WALL_MODE", payload: mode })}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </div>

      </section>

      <section className="panel-section">

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

      </section>

      {/* ========================= */}
      {/* Start Drawing */}
      {/* ========================= */}

      <button
        disabled={locked}
        className={`start-button ${isDrawing ? "stop" : ""}`}
        onClick={() =>
          dispatch({
            type: "SET_ACTIVE_TOOL",
            payload:
              isDrawing
                ? Tool.Select
                : Tool.Wall
          })
        }
      >
        {isDrawing ? <Octagon size={16} /> : <Play size={16} />}
        {isDrawing ? "Stop Drawing" : "Start Drawing"}
        {isDrawing && <span className="pulse-dot" />}
      </button>

    </div>
  );
}