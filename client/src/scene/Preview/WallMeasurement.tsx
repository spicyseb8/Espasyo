
import { useEffect, useMemo } from "react";
import {
    CanvasTexture,
    DoubleSide,
    SRGBColorSpace,
    Vector3,
} from "three";

import type { MeasurementGroup } from "../../engine/walls/Measurement";

interface WallMeasurementProps {
    measurement?: MeasurementGroup;
}

export default function WallMeasurement({
    measurement,
}: WallMeasurementProps) {
    // Keep hooks in the same order, even if measurement is unavailable.
    const center = measurement?.center ?? new Vector3();
    const direction = measurement?.direction ?? new Vector3(1, 0, 0);
    const normal = measurement?.normal ?? new Vector3(0, 0, 1);

    const length = measurement?.length ?? 0;
    const height = measurement?.height ?? 0;
    const thickness = measurement?.thickness ?? 0;

    // Align the text with the wall direction.
    const angle = Math.atan2(-direction.z, direction.x);

    // Larger default label, scaled down proportionally for short walls.
    const WALL_LABEL_WIDTH = 1.4;
    const WALL_LABEL_HEIGHT = 0.55;

    const labelScale = Math.min(
        1,
        Math.max(0, (length * 0.85) / WALL_LABEL_WIDTH),
        Math.max(0, (height * 0.6) / WALL_LABEL_HEIGHT)
    );

    const labelWidth = WALL_LABEL_WIDTH * labelScale;
    const labelHeight = WALL_LABEL_HEIGHT * labelScale;

    // Only update the texture when the displayed measurement changes.
    const label = measurement ? `${length.toFixed(2)} m` : "";

    const texture = useMemo(() => {
        const canvas = document.createElement("canvas");
        const size = 1024;

        canvas.width = size;
        canvas.height = 512;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return null;
        }

        ctx.clearRect(0, 0, size, 512);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 170px Arial";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // Dark outline improves readability on light and dark materials.
        ctx.lineWidth = 20;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
        ctx.strokeText(label, size / 2, 256);

        // Bright text stays readable against the wall finish.
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(label, size / 2, 256);

        const canvasTexture = new CanvasTexture(canvas);
        canvasTexture.colorSpace = SRGBColorSpace;
        canvasTexture.needsUpdate = true;

        return canvasTexture;
    }, [label]);

    // Release old GPU textures when the label changes or unmounts.
    useEffect(() => {
        return () => {
            texture?.dispose();
        };
    }, [texture]);

    if (!measurement || !texture || labelScale <= 0) {
        return null;
    }

    // Position the labels just outside the wall faces.
    const offset = thickness / 2 + 0.04;
    const y = height / 2;

    const insidePosition = new Vector3(
        center.x + normal.x * offset,
        y,
        center.z + normal.z * offset
    );

    const outsidePosition = new Vector3(
        center.x - normal.x * offset,
        y,
        center.z - normal.z * offset
    );

    return (
        <>
            {/* Wall's inside face */}
            <mesh
                position={insidePosition}
                rotation={[0, angle, 0]}
                renderOrder={1000}
                frustumCulled={false}
            >
                <planeGeometry
                    args={[labelWidth, labelHeight]}
                />

               <meshBasicMaterial
    map={texture}
    transparent
    depthTest={true}
    depthWrite={false}
    toneMapped={false}
    alphaTest={0.05}
    side={DoubleSide}
/>
            </mesh>

            {/* Wall's outside face: text remains readable from either side */}
            <mesh
                position={outsidePosition}
                rotation={[0, angle + Math.PI, 0]}
                renderOrder={1000}
                frustumCulled={false}
            >
                <planeGeometry
                    args={[labelWidth, labelHeight]}
                />

                <meshBasicMaterial
    map={texture}
    transparent
    depthTest={true}
    depthWrite={false}
    toneMapped={false}
    alphaTest={0.05}
    side={DoubleSide}
/>
            </mesh>
        </>
    );
}
