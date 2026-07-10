import "./FloorPlanPanel.css";

import useEditor from "../../../context/editor/useEditor";
import { Tool } from "../../../context/editor/tools";
export default function FloorPlanPanel() {
  const { state, dispatch } = useEditor();

  return (
    <div className="panel">

      <h2>Floor Plan</h2>


      <section className="panel-section">

        <h3>Drawing Tools</h3>

        <button
          className={`tool-button ${
            state.activeTool === Tool.Wall ? "active" : ""
          }`}
          onClick={() =>
            dispatch({
              type: "SET_ACTIVE_TOOL",
              payload: Tool.Wall,
            })
          }
        >
          Draw Walls
        </button>

        <button
          className={`tool-button ${
            state.activeTool === Tool.RectangleRoom ? "active" : ""
          }`}
          onClick={() =>
            dispatch({
              type: "SET_ACTIVE_TOOL",
              payload: Tool.RectangleRoom,
            })
          }
        >
          Rectangle Room
        </button>


      </section>


      <section className="panel-section">

        <h3>Wall Settings</h3>

        <label>Height (m)</label>

        <input
          type="number"
          value={state.wallHeight}
          step="0.1"
          readOnly
        />

        <label>Thickness (m)</label>

        <input
          type="number"
          value={state.wallThickness}
          step="0.05"
          readOnly
        />

      </section>



      <section className="panel-section">

        <h3>Grid</h3>

        <label className="checkbox">

          <input
            type="checkbox"
            checked={state.snapEnabled}
            readOnly
          />

          Snap to Grid

        </label>

        <label>Grid Size (m)</label>

        <input
          type="number"
          value={state.gridSize}
          step="0.05"
          readOnly
        />

      </section>

      {/* ========================= */}
      {/* Start Drawing */}
      {/* ========================= */}

      <button
        className="start-button"
        onClick={() =>
          dispatch({
            type: "SET_ACTIVE_TOOL",
            payload:
              state.activeTool === "wall"
                ? Tool.Select
                : Tool.Wall
          })
        }
      >
        {state.activeTool === "wall"
          ? "Stop Drawing"
          : "Start Drawing"}
      </button>

    </div>
  );
}