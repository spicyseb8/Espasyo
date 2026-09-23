import { BuildTool } from "../context/BuildTool";
import type { Asset } from "./Asset";

export const AssetLibrary = {
    doors: [
        {
            id: "d-sd01",
            name: "Single Door",
            thumbnail: "/uploads/doors/single-door.png",
            model: "/uploads/doors/single-door.glb",
            type: BuildTool.Door,
            rotationOffsetY: Math.PI / 2,
            price: 5000
        }
    ] satisfies Asset[],

    windows: [
        {
            id: "w-sw02",
            name: "Slim Intersection Sliding Window",
            thumbnail: "/uploads/doors/single-door.png",
            model: "/uploads/windows/slim_Intersection_i.glb",
            type: BuildTool.Window,
            price: 600,
            rotationOffsetY: Math.PI / 2,
            scale: 0.6
        },
        {
            id: "w-sw03",
            name: "Glass Window",
            thumbnail: "/uploads/doors/single-door.png",
            model: "/uploads/windows/glass_window.glb",
            type: BuildTool.Window,
            price: 500,
            rotationOffsetY: 0,
            scale: 0.6
        }
    ] satisfies Asset[],

    openings: [
        {
            id: "opening-rectangle",
            name: "Rectangle Opening",
            thumbnail: "...",
            model: "",
            type: BuildTool.Opening,
            price: 0,
            openingShape: "rectangle"
        },
        {
            id: "opening-arch",
            name: "Arch Opening",
            thumbnail: "...",
            model: "",
            type: BuildTool.Opening,
            price: 0,
            openingShape: "arch"
        }
    ] satisfies Asset[],

    furniture: [
        {
            id: "test-chair",
            name: "Chair",
            thumbnail: "/uploads/furniture/chair.png",
            model: "/uploads/furniture/chair.glb",
            type: BuildTool.Furniture,
            price: 2500,
            furnitureCategory: "livingRoom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "bed1",
            name: "Bed",
            thumbnail: "/uploads/furniture/bed.png",
            model: "/uploads/furniture/bed.glb",
            type: BuildTool.Furniture,
            price: 6500,
            furnitureCategory: "bedroom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "round-side-table",
            name: "Round Side Table",
            thumbnail: "/uploads/furniture/round-side-table.png",
            model: "/uploads/furniture/round-side-table.glb",
            type: BuildTool.Furniture,
            price: 3000,
            furnitureCategory: "diningRoom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "desk-for-room",
            name: "Room Desk",
            thumbnail: "/uploads/furniture/desk-for-room.png",
            model: "/uploads/furniture/desk_for_room.glb",
            type: BuildTool.Furniture,
            price: 6500,
            furnitureCategory: "office",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "test-tv-stand",
            name: "TV Stand",
            thumbnail: "/uploads/furniture/tv-stand.png",
            model: "/uploads/furniture/TVstand.glb",
            type: BuildTool.Furniture,
            price: 5500,
            furnitureCategory: "livingRoom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "test-sofa",
            name: "Sofa",
            thumbnail: "/uploads/furniture/sofa.png",
            model: "/uploads/furniture/sofa.glb",
            type: BuildTool.Furniture,
            price: 7000,
            furnitureCategory: "livingRoom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        },

        {
            id: "chair2",
            name: "WhiteChair",
            thumbnail: "/uploads/furniture/chair2.png",
            model: "/uploads/furniture/chair2.glb",
            type: BuildTool.Furniture,
            price: 2500,
            furnitureCategory: "diningRoom",
            placementSurfaces: ["floor"],
            snapTargets: ["wall", "furniture"]
        }
    ] satisfies Asset[]
};

export function findAsset(id: string): Asset | undefined {
    return [
        ...AssetLibrary.doors,
        ...AssetLibrary.windows,
        ...AssetLibrary.openings,
        ...AssetLibrary.furniture
    ].find(asset => asset.id === id);
}
