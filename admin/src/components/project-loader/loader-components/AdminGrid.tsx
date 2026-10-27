import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
varying vec3 vWorld;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = `
varying vec3 vWorld;
uniform vec3 uCellColor;
uniform vec3 uSectionColor;
uniform float uCellSize;
uniform float uSectionSize;
uniform float uCellWidth;
uniform float uSectionWidth;
uniform float uFadeStart;
uniform float uFadeEnd;

float gridLine(vec2 uv, float widthUv) {
    vec2 deriv = vec2(length(vec2(dFdx(uv.x), dFdy(uv.x))), length(vec2(dFdx(uv.y), dFdy(uv.y))));
    vec2 drawWidth = clamp(vec2(widthUv), deriv, vec2(0.5));
    vec2 aa = deriv * 1.5;
    vec2 g = 1.0 - abs(fract(uv) * 2.0 - 1.0);
    vec2 line = 1.0 - smoothstep(drawWidth - aa, drawWidth + aa, g);
    line *= clamp(widthUv / drawWidth, 0.0, 1.0);
    return mix(line.x, 1.0, line.y);
}

void main() {
    vec2 p = vWorld.xz;
    float cell = gridLine(p / uCellSize, uCellWidth);
    float section = gridLine(p / uSectionSize, uSectionWidth);
    vec3 color = mix(uCellColor, uSectionColor, section);
    float alpha = clamp(max(cell, section), 0.0, 1.0);
    float distanceFromCamera = distance(p, cameraPosition.xz);
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distanceFromCamera);
    alpha *= fade * fade;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color, alpha);
}
`;

export default function AdminGrid() {
    const group = useRef<THREE.Group>(null);
    const uniforms = useMemo(() => ({
        uCellColor: { value: new THREE.Color("#D6D6D6") },
        uSectionColor: { value: new THREE.Color("#BDBDBD") },
        uCellSize: { value: 0.1 },
        uSectionSize: { value: 1 },
        uCellWidth: { value: 0.006 / 0.1 },
        uSectionWidth: { value: 0.02 },
        uFadeStart: { value: 8 },
        uFadeEnd: { value: 60 }
    }), []);

    useFrame(({ camera }) => {
        if (!group.current) return;
        group.current.position.x = camera.position.x;
        group.current.position.z = camera.position.z;
    });

    return (
        <group ref={group}>
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} renderOrder={-2} frustumCulled={false}>
                <planeGeometry args={[400, 400]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} renderOrder={-1} frustumCulled={false}>
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