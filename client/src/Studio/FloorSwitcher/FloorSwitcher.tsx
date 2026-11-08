import "./FloorSwitcher.css";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

import useEditor from "../../context/editor/useEditor";

interface Props {
    materialPanelOpen: boolean;
}

function ordinalFloorName(index: number) {
    const number = index + 1;
    const remainder = number % 100;
    const suffix = remainder >= 11 && remainder <= 13
        ? "th"
        : number % 10 === 1
            ? "st"
            : number % 10 === 2
                ? "nd"
                : number % 10 === 3
                    ? "rd"
                    : "th";

    return `${number}${suffix} Floor`;
}

export default function FloorSwitcher({ materialPanelOpen }: Props) {
    const { state, dispatch } = useEditor();
    const floors = state.floors.length > 0
        ? state.floors
        : [{ floorId: state.activeFloorId, name: "1st Floor" }];
    const orderedFloors = floors.map((floor, index) => ({
        ...floor,
        label: floor.name || ordinalFloorName(index)
    })).reverse();
    const activeFloorIndex = orderedFloors.findIndex(
        floor => floor.floorId === state.activeFloorId
    );
    const activeIndex = activeFloorIndex >= 0 ? activeFloorIndex : 0;
    const [focusedIndex, setFocusedIndex] = useState(activeIndex);
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        setFocusedIndex(activeIndex);
    }, [activeIndex]);

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number
    ) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        event.stopPropagation();

        const direction = event.key === "ArrowUp" ? -1 : 1;
        const nextIndex = (index + direction + orderedFloors.length) % orderedFloors.length;
        setFocusedIndex(nextIndex);
        buttonRefs.current[nextIndex]?.focus();
    };

    const stopPointerPropagation = (event: PointerEvent<HTMLElement>) => {
        event.stopPropagation();
    };

    return (
        <nav
            className={`floor-switcher${materialPanelOpen ? " material-panel-open" : ""}`}
            aria-label="Project floors"
            style={{ "--floor-count": orderedFloors.length } as CSSProperties}
            onPointerDown={stopPointerPropagation}
            onPointerUp={stopPointerPropagation}
            onClick={event => event.stopPropagation()}
        >
            {orderedFloors.map((floor, index) => (
                <button
                    key={floor.floorId}
                    ref={element => {
                        buttonRefs.current[index] = element;
                    }}
                    type="button"
                    className={`floor-switcher-tab${floor.floorId === state.activeFloorId ? " active" : ""}`}
                    aria-label={floor.label}
                    aria-pressed={floor.floorId === state.activeFloorId}
                    title={floor.label}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onKeyDown={event => handleKeyDown(event, index)}
                    onClick={() => dispatch({
                        type: "SWITCH_FLOOR",
                        payload: floor.floorId
                    })}
                >
                    {floors.length - index}F
                </button>
            ))}
        </nav>
    );
}
