import { useEffect, useMemo } from "react";
import { CanvasTexture, DoubleSide, Vector3 } from "three";

import type { MeasurementGroup } from "../../engine/walls/Measurement";

interface WallMeasurementProps {
    measurement?: MeasurementGroup;
}

/**
 * Renders a wall's length as text baked into a plane that sits flush
 * against the wall face - i.e. "painted on" rather than a floating
 * screen-space tooltip.
 */
export default function WallMeasurement({ measurement }: WallMeasurementProps) {
    // Defensive guard: this component now requires a full MeasurementGroup
    // (center/direction/normal/length/height/thickness). If something is
    // still calling <WallMeasurement /> without one - e.g. a leftover call
    // site from before this refactor - fail silently instead of crashing
    // the whole scene. If you're seeing this in practice, the real fix is
    // updating that call site, not relying on this guard.
    if (!measurement) {
        return null;
    }

    const { center, direction, normal, length, height, thickness } = measurement;

    // Rotate a default XY-facing plane so its local X axis lines up with
    // the wall's direction and its local Z (normal) axis lines up with
    // `normal`. See calculateMeasurementData() in Measurement.ts - normal
    // is always (-direction.z, 0, direction.x), which is exactly what this
    // angle produces.
    const angle = Math.atan2(-direction.z, direction.x);

    // Fixed, small label size in world units - does NOT scale with the
    // wall's length or height. Only shrinks below that fixed size for
    // genuinely short walls, so the label never overhangs past the wall.
    const WALL_LABEL_WIDTH = 0.9;
    const WALL_LABEL_HEIGHT = 0.45;

    const labelWidth = Math.min(WALL_LABEL_WIDTH, length * 0.85);
    const labelHeight = Math.min(WALL_LABEL_HEIGHT, height * 0.6);

    // Key on the rounded, DISPLAYED value rather than the raw float. While
    // actively dragging a wall, `length` changes on nearly every frame -
    // keying on the 2-decimal string means we only rebuild the texture
    // when the visible text would actually change.
    const label = `${length.toFixed(2)} m`;

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
        ctx.font = "800 140px Arial";
        ctx.lineJoin = "round";

        // Dark outline first so the small text stays legible over any
        // wall color/material, then a bright fill on top - like it's
        // painted directly onto the surface rather than sitting in a
        // card.
        ctx.lineWidth = 14;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.strokeText(label, size / 2, 256);

        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.fillText(label, size / 2, 256);

        const canvasTexture = new CanvasTexture(canvas);
        canvasTexture.needsUpdate = true;
        return canvasTexture;
    }, [label]);

    // CRITICAL: dispose the GPU-side texture whenever it's replaced or
    // this component unmounts. Without this, every new CanvasTexture
    // created above leaks VRAM - during active dragging (label changing
    // most frames) this exhausts GPU memory in seconds and crashes the
    // WebGL context ("Context Lost").
    useEffect(() => {
        return () => {
            texture?.dispose();
        };
    }, [texture]);

    if (!texture) {
        return null;
    }

    // Sit just outside the wall's actual face, not its centerline - the
    // wall mesh is centered on `center` and extends thickness/2 either
    // side of it, so anything less than that gets buried inside the
    // solid wall and depth-tested away (this was why labels weren't
    // showing). A small extra margin avoids z-fighting on the face itself.
    const offset = thickness / 2 + 0.03;
    const y = height / 2;

    // Two independent planes, one per face of the wall - each rotated to
    // face outward on its own side. Rotating the second one 180° (rather
    // than reusing the same rotation with DoubleSide) is what keeps the
    // text reading correctly instead of mirrored: it's the same as
    // physically spinning a sign around to face the other way, not
    // flattening it against glass.
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
            <mesh position={insidePosition} rotation={[0, angle, 0]}>
                <planeGeometry args={[labelWidth, labelHeight]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    depthWrite={false}
                    alphaTest={0.05}
                    side={DoubleSide}
                />
            </mesh>
            <mesh position={outsidePosition} rotation={[0, angle + Math.PI, 0]}>
                <planeGeometry args={[labelWidth, labelHeight]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    depthWrite={false}
                    alphaTest={0.05}
                    side={DoubleSide}
                />
            </mesh>
        </>
    );
}