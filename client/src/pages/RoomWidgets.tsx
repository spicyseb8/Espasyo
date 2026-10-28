import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import "./RoomWidgets.css";

export type WidgetKind = "plan" | "finishes" | "estimate";

export function RoomWidget({ kind, active }: { kind: WidgetKind; active: boolean }) {
  if (kind === "plan") return <PlanWidget active={active} />;
  if (kind === "finishes") return <FinishesWidget />;
  return <EstimateWidget />;
}

const POP = { type: "spring", bounce: 0.25, duration: 0.4 } as const;

/* ------------------------------------------------------------------ */
/* 1. Plan & build: walls draw themselves, furniture is draggable       */
/* ------------------------------------------------------------------ */

const PIECES = [
  { id: "sofa", label: "Sofa", x: 8, y: 62, w: 34, h: 20, round: false },
  { id: "table", label: "Table", x: 46, y: 38, w: 16, h: 28, round: true },
  { id: "bed", label: "Bed", x: 66, y: 8, w: 26, h: 36, round: false },
  { id: "desk", label: "Desk", x: 8, y: 12, w: 24, h: 16, round: false },
] as const;

function PlanWidget({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const planRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<string[]>(["sofa", "table"]);
  const [layoutKey, setLayoutKey] = useState(0);

  const toggle = (id: string) =>
    setPlaced((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const draw = (delay: number) => ({
    duration: reduce ? 0 : 1,
    delay: reduce || !active ? 0 : delay,
    ease: "easeInOut" as const,
  });

  return (
    <div className="rw">
      <div className="rw-plan" ref={planRef}>
        <svg viewBox="0 0 300 150" className="rw-plan__walls" aria-hidden>
          {/* Outer walls with a door gap on the right */}
          <motion.path
            d="M6 6 H294 V58 M294 86 V144 H6 V6"
            initial={false}
            animate={{ pathLength: active ? 1 : 0 }}
            transition={draw(0.15)}
          />
          {/* Interior wall */}
          <motion.path
            d="M150 6 V66"
            initial={false}
            animate={{ pathLength: active ? 1 : 0 }}
            transition={draw(0.9)}
          />
          {/* Door swing */}
          <motion.path
            className="rw-plan__door"
            d="M294 58 A28 28 0 0 0 266 86"
            initial={false}
            animate={{ pathLength: active ? 1 : 0 }}
            transition={draw(1.5)}
          />
        </svg>

        <AnimatePresence>
          {PIECES.filter((p) => placed.includes(p.id)).map((p) => (
            <motion.div
              key={`${p.id}-${layoutKey}`}
              className={`rw-piece${p.round ? " rw-piece--round" : ""}`}
              drag
              dragConstraints={planRef}
              dragElastic={0}
              dragMomentum={false}
              whileDrag={{ scale: 1.06, zIndex: 5 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={POP}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}%`,
                height: `${p.h}%`,
              }}
            >
              {p.label}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="rw-row">
        <div className="rw-pills" role="group" aria-label="Furniture">
          {PIECES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rw-pill"
              aria-pressed={placed.includes(p.id)}
              onClick={() => toggle(p.id)}
            >
              {placed.includes(p.id) ? "✓ " : "+ "}
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="rw-icon-btn"
          aria-label="Reset layout"
          title="Reset layout"
          onClick={() => setLayoutKey((k) => k + 1)}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <p className="rw-hint">Add furniture, then drag it around the room.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Finishes: change wall colors and floor materials live             */
/* ------------------------------------------------------------------ */

const WALL_COLORS = [
  ["#f5f1e8", "Warm white"],
  ["#dedbd3", "Greige"],
  ["#a8b5a0", "Sage"],
  ["#9db7cf", "Sky blue"],
  ["#c27c5a", "Terracotta"],
  ["#2f4858", "Navy"],
] as const;

const FLOORS = [
  {
    id: "wood",
    label: "Oak wood",
    css: "repeating-linear-gradient(90deg, #b98a5e 0 34px, #a47649 34px 36px)",
  },
  {
    id: "tile",
    label: "Tile",
    css:
      "linear-gradient(rgba(0,0,0,0) 0 93%, rgba(0,0,0,.16) 93%) 0 0/44px 44px, " +
      "linear-gradient(90deg, rgba(0,0,0,0) 0 93%, rgba(0,0,0,.16) 93%) 0 0/44px 44px, #e4e0d8",
  },
  {
    id: "stone",
    label: "Stone",
    css:
      "radial-gradient(circle at 20% 30%, rgba(255,255,255,.28) 0 2px, transparent 3px) 0 0/22px 22px, " +
      "radial-gradient(circle at 70% 70%, rgba(0,0,0,.14) 0 2px, transparent 3px) 0 0/30px 30px, #9a9a96",
  },
] as const;

function FinishesWidget() {
  const [wallIdx, setWallIdx] = useState(2);
  const [floorIdx, setFloorIdx] = useState(0);
  const wall = WALL_COLORS[wallIdx];
  const floor = FLOORS[floorIdx];

  return (
    <div className="rw">
      <div className="rw-room" aria-hidden>
        <div className="rw-room__wall" style={{ backgroundColor: wall[0] }}>
          <span className="rw-room__window" />
          <span className="rw-room__art" />
        </div>

        <div className="rw-room__floor-wrap">
          <AnimatePresence initial={false}>
            <motion.div
              key={floor.id}
              className="rw-room__floor"
              style={{ background: floor.css }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          </AnimatePresence>
        </div>

        <span className="rw-room__sofa" />
        <span className="rw-room__lamp" />
      </div>

      <div className="rw-field">
        <span className="rw-label">Wall color</span>
        <div className="rw-swatches" role="group" aria-label="Wall color">
          {WALL_COLORS.map(([hex, name], i) => (
            <button
              key={hex}
              type="button"
              className="rw-swatch"
              style={{ backgroundColor: hex }}
              title={name}
              aria-label={name}
              aria-pressed={wallIdx === i}
              onClick={() => setWallIdx(i)}
            />
          ))}
        </div>
      </div>

      <div className="rw-field">
        <span className="rw-label">Floor finish</span>
        <div className="rw-pills" role="group" aria-label="Floor finish">
          {FLOORS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className="rw-pill"
              aria-pressed={floorIdx === i}
              onClick={() => setFloorIdx(i)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="rw-hint">
        {wall[1]} walls · {floor.label} floor
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Estimate: room area, tiles needed and cost                        */
/* ------------------------------------------------------------------ */

// Sample prices for the demo only; the app uses real material prices.
const TILE_SIZES = [
  { cm: 30, price: 45 },
  { cm: 40, price: 80 },
  { cm: 60, price: 180 },
] as const;

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (reduce) {
      current.current = value;
      setShown(value);
      return;
    }
    const controls = animate(current.current, value, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <>{format(shown)}</>;
}

function EstimateWidget() {
  const [length, setLength] = useState(5);
  const [width, setWidth] = useState(4);
  const [tileIdx, setTileIdx] = useState(1);
  const [waste, setWaste] = useState(true);

  const tile = TILE_SIZES[tileIdx];
  const area = length * width;
  const tileArea = (tile.cm / 100) ** 2;
  const pieces = Math.ceil((area * (waste ? 1.1 : 1)) / tileArea);
  const cost = pieces * tile.price;

  return (
    <div className="rw">
      <div className="rw-est__stage">
        <motion.div
          className="rw-est__rect"
          animate={{ width: `${(length / 12) * 100}%`, height: `${(width / 12) * 100}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          style={{
            backgroundSize: `${((tile.cm / 100) / length) * 100}% ${((tile.cm / 100) / width) * 100}%`,
          }}
        >
          <span className="rw-est__dims">
            {length.toFixed(1)} × {width.toFixed(1)} m
          </span>
        </motion.div>
      </div>

      <div className="rw-sliders">
        <label className="rw-slider">
          <span className="rw-label">Length</span>
          <input
            type="range"
            min={2}
            max={12}
            step={0.1}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            aria-label="Room length in meters"
          />
        </label>
        <label className="rw-slider">
          <span className="rw-label">Width</span>
          <input
            type="range"
            min={2}
            max={12}
            step={0.1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            aria-label="Room width in meters"
          />
        </label>
      </div>

      <div className="rw-row">
        <div className="rw-pills" role="group" aria-label="Tile size">
          {TILE_SIZES.map((t, i) => (
            <button
              key={t.cm}
              type="button"
              className="rw-pill"
              aria-pressed={tileIdx === i}
              onClick={() => setTileIdx(i)}
            >
              {t.cm}×{t.cm} cm
            </button>
          ))}
        </div>

        <button
          type="button"
          className="rw-pill"
          aria-pressed={waste}
          onClick={() => setWaste((w) => !w)}
        >
          +10% waste
        </button>
      </div>

      <dl className="rw-stats">
        <div>
          <dt>Area</dt>
          <dd>
            <AnimatedNumber value={area} format={(n) => `${n.toFixed(1)} m²`} />
          </dd>
        </div>
        <div>
          <dt>Tiles</dt>
          <dd>
            <AnimatedNumber value={pieces} format={(n) => Math.round(n).toLocaleString("en-US")} />
          </dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd>
            <AnimatedNumber
              value={cost}
              format={(n) => `₱${Math.round(n).toLocaleString("en-US")}`}
            />
          </dd>
        </div>
      </dl>

      <p className="rw-hint">Sample prices. Espasyo uses your real material prices.</p>
    </div>
  );
}