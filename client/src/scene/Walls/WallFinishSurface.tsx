import { useEffect, useMemo, useState } from "react";
import { ExtrudeGeometry, MeshStandardMaterial, RepeatWrapping, Shape, Texture, Vector3 } from "three";
import type { WallPiece } from "../../engine/walls/WallPiece";
import type { Material } from "../../engine/materials/MaterialTypes";
import {
    findCachedWallMaterial,
    getCachedWallTexture,
    getWallMaterials,
    preloadWallTexture
} from "../../engine/materials/walls";
import {
    getCachedFloorPatternTexture,
    preloadFloorPatternTexture
} from "../../engine/materials/floors";
import {
    createFloorPatternLayout,
    getFloorPatternCellSize,
    isFloorPattern
} from "../../../../shared/flooring/patterns";
import type { WallFinishSide } from "../../engine/walls/WallFinishUtils";

interface Props {
    piece: WallPiece;
    finish: WallFinishSide;
}

const FINISH_THICKNESS = 0.004;
const FINISH_GAP = 0.002;

export default function WallFinishSurface({ piece, finish }: Props) {
    const [material, setMaterial] = useState<Material | null>(() => findCachedWallMaterial(finish.materialId) ?? null);
    const [loadedTexture, setLoadedTexture] = useState<{
        url: string;
        texture: Texture;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadMaterial() {
            try {
                const materials = await getWallMaterials();
                if (cancelled) {
                    return;
                }
                const found = materials.find(item => item.id === finish.materialId) ?? null;
                setMaterial(found);
            } catch (error) {
                console.error("Failed to load wall material:", error);
                if (!cancelled) {
                    setMaterial(null);
                }
            }
        }
        loadMaterial();
        return () => {
            cancelled = true;
        };
    }, [finish.materialId]);

    const activeMaterial = material?.id === finish.materialId
        ? material
        : null;
    const textureUrl = activeMaterial?.texture;
    const cachedTexture = textureUrl
        ? getCachedWallTexture(textureUrl)
        : undefined;
    const patternCellSize = useMemo(() => {
        if (
            activeMaterial?.floorMaterialMode !== "single-tile" ||
            !isFloorPattern(activeMaterial.floorPattern) ||
            typeof activeMaterial.length !== "number" ||
            !Number.isFinite(activeMaterial.length) ||
            activeMaterial.length <= 0 ||
            typeof activeMaterial.width !== "number" ||
            !Number.isFinite(activeMaterial.width) ||
            activeMaterial.width <= 0
        ) {
            return null;
        }

        return getFloorPatternCellSize(
            createFloorPatternLayout(
                activeMaterial.floorPattern,
                activeMaterial.length,
                activeMaterial.width
            )
        );
    }, [activeMaterial]);
    const cachedPatternTexture =
        textureUrl && patternCellSize && activeMaterial
            ? getCachedFloorPatternTexture(textureUrl, activeMaterial)
            : undefined;

    const cachedSurfaceTexture = useMemo(() => {
        if (!textureUrl) {
            return null;
        }

        const source = cachedPatternTexture ?? (
            patternCellSize ? undefined : cachedTexture
        );
        if (!source) {
            return null;
        }

        const texture = source.clone();
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        if (patternCellSize) {
            texture.repeat.set(
                piece.width / patternCellSize.widthM,
                piece.height / patternCellSize.heightM
            );
        } else {
            texture.repeat.set(
                Math.max(1, piece.width),
                Math.max(1, piece.height)
            );
        }
        texture.needsUpdate = true;
        return texture;
    }, [
        textureUrl,
        cachedPatternTexture,
        cachedTexture,
        patternCellSize,
        piece.width,
        piece.height
    ]);

    useEffect(() => {
        return () => cachedSurfaceTexture?.dispose();
    }, [cachedSurfaceTexture]);

    useEffect(() => {
        if (!textureUrl || cachedSurfaceTexture) {
            return;
        }

        let cancelled = false;
        let surfaceTexture: Texture | null = null;

        const texturePromise = patternCellSize && activeMaterial
            ? preloadFloorPatternTexture(textureUrl, activeMaterial)
            : preloadWallTexture(textureUrl);
        void texturePromise
            .then(async sourceTexture => {
                if (cancelled) {
                    return;
                }

                const patternGenerated = Boolean(sourceTexture && patternCellSize);
                const source = sourceTexture ??
                    await preloadWallTexture(textureUrl);
                if (cancelled) {
                    return;
                }
                surfaceTexture = source.clone();
                surfaceTexture.wrapS = RepeatWrapping;
                surfaceTexture.wrapT = RepeatWrapping;
                if (patternGenerated && patternCellSize) {
                    surfaceTexture.repeat.set(
                        piece.width / patternCellSize.widthM,
                        piece.height / patternCellSize.heightM
                    );
                } else if (
                    patternCellSize &&
                    activeMaterial?.length &&
                    activeMaterial.width
                ) {
                    surfaceTexture.repeat.set(
                        piece.width / activeMaterial.length,
                        piece.height / activeMaterial.width
                    );
                } else {
                    surfaceTexture.repeat.set(
                        Math.max(1, piece.width),
                        Math.max(1, piece.height)
                    );
                }
                surfaceTexture.needsUpdate = true;
                setLoadedTexture({
                    url: textureUrl,
                    texture: surfaceTexture
                });
            })
            .catch(error => {
                console.error("Failed to load wall texture:", textureUrl, error);
            });

        return () => {
            cancelled = true;
            surfaceTexture?.dispose();
        };
    }, [
        textureUrl,
        cachedSurfaceTexture,
        activeMaterial,
        patternCellSize,
        piece.width,
        piece.height
    ]);

    const texture = cachedSurfaceTexture ?? (
        loadedTexture && loadedTexture.url === textureUrl
            ? loadedTexture.texture
            : null
    );

    const normal = useMemo(() => {
        return new Vector3(-Math.sin(piece.rotationY), 0, Math.cos(piece.rotationY)).normalize();
    }, [piece.rotationY]);

    const position = useMemo(() => {
        return piece.position.clone().add(normal.clone().multiplyScalar(finish.side * (piece.thickness * 0.5 + FINISH_GAP + FINISH_THICKNESS * 0.5)));
    }, [piece.position, piece.thickness, finish.side, normal]);

    const archGeometry = useMemo(() => {
        if (piece.kind !== "arch" || !piece.arch) {
            return null;
        }
        const openingWidth = piece.arch.openingWidth;
        const openingHeight = piece.arch.openingHeight;
        const radius = openingWidth * 0.5;
        const shape = new Shape();
        shape.moveTo(-openingWidth * 0.5, openingHeight);
        shape.lineTo(-openingWidth * 0.5, piece.height);
        shape.lineTo(openingWidth * 0.5, piece.height);
        shape.lineTo(openingWidth * 0.5, openingHeight);
        const segments = 24;
        for (let i = segments; i >= 0; i--) {
            const angle = Math.PI * (i / segments);
            const x = Math.cos(angle) * radius;
            const y = openingHeight + Math.sin(angle) * radius;
            shape.lineTo(x, y);
        }
        shape.closePath();
        const geometry = new ExtrudeGeometry(shape, {
            depth: FINISH_THICKNESS,
            bevelEnabled: false,
            steps: 1
        });
        geometry.center();
        return geometry;
    }, [piece.kind, piece.arch, piece.height]);

    const finishMaterial = useMemo(() => {
        return new MeshStandardMaterial({
            ...(texture ? { map: texture } : {}),
            color: activeMaterial?.color ?? "#FFFFFF",
            roughness: activeMaterial?.roughness ?? 0.92,
            metalness: activeMaterial?.metalness ?? 0,
            visible: !activeMaterial?.texture || Boolean(texture),
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
    }, [activeMaterial, texture]);

    useEffect(() => {
        return () => {
            finishMaterial.dispose();
        };
    }, [finishMaterial]);

    if (!activeMaterial) {
        return null;
    }

    if (piece.kind === "arch" && archGeometry) {
        return (
            <mesh
                geometry={archGeometry}
                position={position}
                rotation={[0, -piece.rotationY, 0]}
                userData={{ isWallFinish: true }}
                castShadow={false}
                receiveShadow
                raycast={() => {}}
                material={finishMaterial}
            />
        );
    }

    return (
        <mesh
            position={position}
            rotation={[0, -piece.rotationY, 0]}
            userData={{ isWallFinish: true }}
            castShadow={false}
            receiveShadow
            raycast={() => {}}
            material={finishMaterial}
        >
            <boxGeometry args={[piece.width, piece.height, FINISH_THICKNESS]} />
        </mesh>
    );
}