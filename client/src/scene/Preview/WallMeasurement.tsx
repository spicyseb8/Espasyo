import { Html } from "@react-three/drei";
import { Vector3 } from "three";

import type { MeasurementGroup } from "../../engine/walls/Measurement";

interface WallMeasurementProps {
    start?: Vector3;
    end?: Vector3;
    height?: number;
    length?: number;
    color?: string;
    measurement?: MeasurementGroup;
}

export default function WallMeasurement({
    start: providedStart,
    end: providedEnd,
    height = 3,
    length: providedLength,
    measurement,
}: WallMeasurementProps) {
    const start = providedStart ?? measurement?.start ?? new Vector3();
    const end = providedEnd ?? measurement?.end ?? new Vector3();
    const length = providedLength ?? measurement?.length ?? start.distanceTo(end);

    const center = new Vector3(
        (start.x + end.x) / 2,
        height + 0.15,
        (start.z + end.z) / 2
    );

    return (
        <Html position={center} center>
            <div
                style={{
                    background: "white",
                    border: "1px solid #999",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    userSelect: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,.15)"
                }}
            >
                {length.toFixed(2)} m
            </div>
        </Html>
    );
}