import { Html } from "@react-three/drei";
import { Vector3 } from "three";

interface WallMeasurementProps {
    start: Vector3;
    end: Vector3;
    height?: number;
    length?: number;
    color?: string;
}

export default function WallMeasurement({

    start,
    end,
    height = 3,
    length: providedLength,

    }: WallMeasurementProps) {

        const center = new Vector3(
            (start.x + end.x) / 2,
            height + 0.15,
            (start.z + end.z) / 2
        );

        const length = providedLength ?? start.distanceTo(end);

        return (

            <Html
                position={center}
                center
            >

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