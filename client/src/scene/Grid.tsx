import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * Stable, anti-aliased grid.  1 scene unit = 1 metre.
 *   - Main squares:  1 m x 1 m   (section lines)
 *   - Inner squares: 10 cm       (10 x 10 per main square)
 *
 * Why not drei <Grid>? At low camera angles its thin lines alias and shimmer.
 * This shader widens/blends lines by the screen-space derivative and fades
 * sub-pixel cells to their average coverage, so nothing crawls when you orbit.
 * The plane follows the camera, so the grid looks infinite and fades out.
 */

// ── Look ───────────────────────────────────────────────────────────────
const CELL_SIZE = 0.1;
const SECTION_SIZE = 1;

const CELL_COLOR = "#D6D6D6";
const SECTION_COLOR = "#BDBDBD";

// Real-world line thickness (metres). Lines never draw thinner than 1px on
// screen, and fade to a faint haze when they get sub-pixel.
const CELL_WIDTH_M = 0.006;
const SECTION_WIDTH_M = 0.02;

const FADE_START = 8; // metres from the camera (on the floor plane)
const FADE_END = 60;

// ── Shaders ────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
    varying vec3 vWorld;

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const colorSpaceChunk =
    parseInt(THREE.REVISION, 10) >= 154
        ? "#include <colorspace_fragment>"
        : "#include <encodings_fragment>";

const fragmentShader = /* glsl */ `
    uniform vec3 uCellColor;
    uniform vec3 uSectionColor;
    uniform float uCellSize;
    uniform float uSectionSize;
    uniform float uCellWidth;
    uniform float uSectionWidth;
    uniform float uFadeStart;
    uniform float uFadeEnd;

    varying vec3 vWorld;

    // Pristine-grid style line: widthUv is the line width as a fraction of
    // one cell. Derivative-aware AA, and a blend to average coverage when
    // cells shrink below a pixel.
    float gridLine(vec2 uv, float widthUv) {
        vec2 deriv = vec2(
            length(vec2(dFdx(uv.x), dFdy(uv.x))),
            length(vec2(dFdx(uv.y), dFdy(uv.y)))
        );

        vec2 targetWidth = vec2(widthUv);
        vec2 drawWidth = clamp(targetWidth, deriv, vec2(0.5));
        vec2 aa = deriv * 1.5;

        vec2 g = 1.0 - abs(fract(uv) * 2.0 - 1.0);
        vec2 line = 1.0 - smoothstep(drawWidth - aa, drawWidth + aa, g);

        line *= clamp(targetWidth / drawWidth, 0.0, 1.0);
        line = mix(line, targetWidth, clamp(deriv * 2.0 - 1.0, 0.0, 1.0));

        return mix(line.x, 1.0, line.y);
    }

    void main() {
        vec2 p = vWorld.xz;

        float cell = gridLine(p / uCellSize, uCellWidth);
        float section = gridLine(p / uSectionSize, uSectionWidth);

        vec3 color = mix(uCellColor, uSectionColor, section);
        float alpha = clamp(max(cell, section), 0.0, 1.0);

        float d = distance(p, cameraPosition.xz);
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
        alpha *= fade * fade;

        if (alpha < 0.003) discard;

        gl_FragColor = vec4(color, alpha);

        #include <tonemapping_fragment>
        ${colorSpaceChunk}
    }
`;

// ── Component ──────────────────────────────────────────────────────────
export default function SceneGrid() {

    const group = useRef<THREE.Group>(null);

    const uniforms = useMemo(
        () => ({
            uCellColor: { value: new THREE.Color(CELL_COLOR) },
            uSectionColor: { value: new THREE.Color(SECTION_COLOR) },
            uCellSize: { value: CELL_SIZE },
            uSectionSize: { value: SECTION_SIZE },
            uCellWidth: { value: CELL_WIDTH_M / CELL_SIZE },
            uSectionWidth: { value: SECTION_WIDTH_M / SECTION_SIZE },
            uFadeStart: { value: FADE_START },
            uFadeEnd: { value: FADE_END }
        }),
        []
    );

    // Follow the camera on the floor plane so the grid never runs out.
    // The pattern is computed from world position, so it doesn't slide.
    useFrame(({ camera }) => {
        if (!group.current) return;
        group.current.position.x = camera.position.x;
        group.current.position.z = camera.position.z;
    });

    return (

        <group ref={group}>

        {/* White fill — flat, not tone-mapped, so it stays pure #ffffff */}
        <mesh
            rotation-x={-Math.PI / 2}
            position={[0, -0.02, 0]}
            renderOrder={-2}
            frustumCulled={false}
        >

            <planeGeometry args={[400, 400]} />

            <meshBasicMaterial color="#ffffff" toneMapped={false} />

        </mesh>

        {/* Grey lines on top */}
        <mesh
            rotation-x={-Math.PI / 2}
            position={[0, -0.01, 0]}
            renderOrder={-1}
            frustumCulled={false}
        >

            <planeGeometry args={[400, 400]} />

            <shaderMaterial
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
            />

        </mesh>

        </group>

    );

}