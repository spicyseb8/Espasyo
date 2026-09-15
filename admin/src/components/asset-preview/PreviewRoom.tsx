import {
  Edges,
  Line,
} from "@react-three/drei";

import type { Asset } from "@/services/assets/asset-types";

import {
  FloorMaterial,
  WallMaterial,
  SOLID_MATERIAL_PROPS,
} from "./PreviewMaterials";

function VisibleEdges() {
  return (
    <Edges
      threshold={1}
      color="#666666"
      linewidth={1}
    />
  );
}

export default function PreviewRoom({
  asset,
}: {
  asset: Asset | null;
}) {
  const wallHeight =
    3;

  const roomWidth =
    4.6;

  const roomDepth =
    5.5;

  const floorThickness =
    0.3;

  const backWallThickness =
    0.2;

  const leftWallThickness =
    1.0;

  const floorTopY =
    floorThickness;

  const backWallCenterZ =
    -roomDepth / 2 +
    backWallThickness / 2;

  const backWallInnerZ =
    -roomDepth / 2 +
    backWallThickness;

  const leftWallCenterX =
    -roomWidth / 2 +
    leftWallThickness / 2;

  const leftWallInnerX =
    -roomWidth / 2 +
    leftWallThickness;

  const leftWallLength =
    roomDepth / 2 -
    backWallInnerZ;

  const leftWallCenterZ =
    backWallInnerZ +
    leftWallLength / 2;

  const backTrimDepth =
    0.08;

  const backTrimHeight =
    0.28;

  const leftTrimDepth =
    0.08;

  const leftTrimHeight =
    0.28;

  const backTrimCenterZ =
    backWallInnerZ +
    backTrimDepth / 2;

  const backTrimInnerZ =
    backWallInnerZ +
    backTrimDepth;

  const leftTrimCenterX =
    leftWallInnerX +
    leftTrimDepth / 2;

  const leftTrimLength =
    roomDepth / 2 -
    backTrimInnerZ;

  const leftTrimCenterZ =
    backTrimInnerZ +
    leftTrimLength / 2;

  return (
    <group>
      {/* FLOOR */}
      <mesh
        receiveShadow
        castShadow
        position={[
          0,
          floorThickness / 2,
          0,
        ]}
        name="preview-floor"
      >
        <boxGeometry
          args={[
            roomWidth,
            floorThickness,
            roomDepth,
          ]}
        />

        <FloorMaterial
          asset={asset}
        />

        <VisibleEdges />
      </mesh>

      {/* BACK WALL */}
      <mesh
        castShadow
        receiveShadow
        position={[
          0,
          floorTopY +
            wallHeight / 2,
          backWallCenterZ,
        ]}
      >
        <boxGeometry
          args={[
            roomWidth,
            wallHeight,
            backWallThickness,
          ]}
        />

        <WallMaterial
          asset={asset}
        />

        <VisibleEdges />
      </mesh>

      {/* LEFT WALL */}
      <mesh
        castShadow
        receiveShadow
        position={[
          leftWallCenterX,
          floorTopY +
            wallHeight / 2,
          leftWallCenterZ,
        ]}
      >
        <boxGeometry
          args={[
            leftWallThickness,
            wallHeight,
            leftWallLength,
          ]}
        />

        <WallMaterial
          asset={asset}
        />

        <VisibleEdges />
      </mesh>

      {/* INNER CORNER LINE */}
      <Line
        points={[
          [
            leftWallInnerX,
            floorTopY,
            backWallInnerZ,
          ],

          [
            leftWallInnerX,
            floorTopY +
              wallHeight,
            backWallInnerZ,
          ],
        ]}
        color="#666666"
        lineWidth={1}
      />

      {/* BACK TRIM */}
      <mesh
        castShadow
        position={[
          0,
          backTrimHeight / 2 +
            floorTopY,
          backTrimCenterZ,
        ]}
      >
        <boxGeometry
          args={[
            roomWidth,
            backTrimHeight,
            backTrimDepth,
          ]}
        />

        <meshStandardMaterial
          color="#e9e6dd"
          roughness={0.75}
          {...SOLID_MATERIAL_PROPS}
        />

        <VisibleEdges />
      </mesh>

      {/* LEFT TRIM */}
      <mesh
        castShadow
        position={[
          leftTrimCenterX,
          leftTrimHeight / 2 +
            floorTopY,
          leftTrimCenterZ,
        ]}
      >
        <boxGeometry
          args={[
            leftTrimDepth,
            leftTrimHeight,
            leftTrimLength,
          ]}
        />

        <meshStandardMaterial
          color="#e9e6dd"
          roughness={0.75}
          {...SOLID_MATERIAL_PROPS}
        />

        <VisibleEdges />
      </mesh>
    </group>
  );
}