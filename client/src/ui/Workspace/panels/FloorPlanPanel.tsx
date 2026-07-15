import "./FloorPlanPanel.css";
import { Square, Columns2, SquareSplitHorizontal} from "lucide-react";
import useEditor from "../../../context/editor/useEditor";
import { Tool } from "../../../context/editor/tools";
import { WallMode } from "../../../context/WallMode";
export default function FloorPlanPanel() {
  const { state, dispatch } = useEditor();

  return (
    <div className="panel">

      <h2>Floor Plan</h2>


      <section className="panel-section">

        <h3>Drawing Tools</h3>
         
          <div className="wall-actions">
          <button disabled={state.layoutConfirmed}
          className={`wall-icon-button ${ state.wallMode === WallMode.Default ? "active" : ""}`}
          onClick={() => dispatch({  type: "SET_WALL_MODE",  payload: WallMode.Default})}>
            <Square size={18} />
          </button>

          <button disabled={state.layoutConfirmed}
          className={`wall-icon-button ${ state.wallMode === WallMode.Join ? "active" : ""}`}
          onClick={() => dispatch({  type: "SET_WALL_MODE",  payload: WallMode.Join})}>
            <Columns2 size={18} />
          </button>

          <button disabled={state.layoutConfirmed}
          className={`wall-icon-button ${ state.wallMode === WallMode.Split ? "active" : ""}`}
          onClick={() => dispatch({  type: "SET_WALL_MODE",  payload: WallMode.Split})}>
            <SquareSplitHorizontal size={18} />
          </button>
        </div>
    </section>


      <section className="panel-section">

        <h3>Wall Settings</h3>

        <label>Height (m)</label>

<input disabled={state.layoutConfirmed}
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
        <label>Thickness (m)</label>

<input disabled={state.layoutConfirmed}
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

      </section>




      {/* ========================= */}
      {/* Start Drawing */}
      {/* ========================= */}

      <button disabled={state.layoutConfirmed} 
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