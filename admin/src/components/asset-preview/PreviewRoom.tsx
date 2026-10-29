import {
  useEffect,
  useMemo,
} from "react";
import {
  BoxGeometry,
  Float32BufferAttribute,
} from "three";
import {
  Edges,
  Line,
} from "@react-three/drei";

import type { Asset } from "@/services/assets/asset-types";
import {
  DEFAULT_FLOOR_GROUT_WIDTH_M,
  createFloorPatternLayout,
  getFloorPatternUV,
  isHerringboneTileRatio,
  isFloorPattern,
} from "../../../../shared/flooring/patterns";

import {
  FloorMaterial,
  WallMaterial,
  SOLID_MATERIAL_PROPS,
} from "./PreviewMaterials";
import { PREVIEW_ROOM_DIMENSIONS } from "./previewRoomDimensions";

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
  const wallHeight = PREVIEW_ROOM_DIMENSIONS.wallHeight;
  const roomWidth = PREVIEW_ROOM_DIMENSIONS.width;
  const roomDepth = PREVIEW_ROOM_DIMENSIONS.depth;
  const floorThickness = PREVIEW_ROOM_DIMENSIONS.floorThickness;
  const wallThickness = PREVIEW_ROOM_DIMENSIONS.wallThickness;

  const floorTopY =
    floorThickness;

  const floorPatternLayout = useMemo(() => {
    if (
      asset?.asset_type !== "floor" ||
      asset.floorMaterialMode !== "single-tile" ||
      !isFloorPattern(asset.floorPattern) ||
      typeof asset.length !== "number" ||
      !Number.isFinite(asset.length) ||
      asset.length <= DEFAULT_FLOOR_GROUT_WIDTH_M ||
      typeof asset.width !== "number" ||
      !Number.isFinite(asset.width) ||
      asset.width <= DEFAULT_FLOOR_GROUT_WIDTH_M ||
      (asset.floorPattern === "herringbone" &&
        !isHerringboneTileRatio(asset.length, asset.width))
    ) {
      return null;
    }

    return createFloorPatternLayout(
      asset.floorPattern,
      asset.length,
      asset.width
    );
  }, [
    asset?.asset_type,
    asset?.floorMaterialMode,
    asset?.floorPattern,
    asset?.length,
    asset?.width,
  ]);

  const floorGeometry = useMemo(() => {
    const geometry = new BoxGeometry(
      roomWidth,
      floorThickness,
      roomDepth
    );

    if (!floorPatternLayout) {
      return geometry;
    }

    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uvValues = new Float32Array(positions.count * 2);
    const originalUVs = geometry.getAttribute("uv");

    for (let index = 0; index < positions.count; index += 1) {
      uvValues[index * 2] = originalUVs.getX(index);
      uvValues[index * 2 + 1] = originalUVs.getY(index);

      if (normals.getY(index) < 0.5) {
        continue;
      }

      const uv = getFloorPatternUV(
        positions.getX(index),
        -positions.getZ(index),
        floorPatternLayout
      );
      uvValues[index * 2] = uv.x;
      uvValues[index * 2 + 1] = uv.y;
    }

    geometry.setAttribute(
      "uv",
      new Float32BufferAttribute(uvValues, 2)
    );
    return geometry;
  }, [
    roomWidth,
    roomDepth,
    floorThickness,
    floorPatternLayout,
  ]);

  useEffect(
    () => () => floorGeometry.dispose(),
    [floorGeometry]
  );

  const backWallCenterZ =
    -roomDepth / 2 +
    wallThickness / 2;

  const backWallInnerZ =
    -roomDepth / 2 +
    wallThickness;

  const leftWallCenterX =
    -roomWidth / 2 +
    wallThickness / 2;

  const leftWallInnerX =
    -roomWidth / 2 +
    wallThickness;

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
        <primitive
          object={floorGeometry}
          attach="geometry"
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
            wallThickness,
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
            wallThickness,
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