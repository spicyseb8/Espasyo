import type { Material } from "./MaterialTypes";

export const MaterialLibrary: Material[] = [

    //==================================================
    // FLOORING
    //==================================================
 {
        id: "floor-wood-oak",

        name: "Oak Wood",

        category: "flooring",

        pricePerSquareMeter: 1200,

        thumbnail:
            "/uploads/materials/flooring/wood-oak.png",

        texture:
            "/uploads/materials/flooring/wood-oak.png"
    },
    {
        id: "floor-ceramic-white",

        name: "White Ceramic Tile",

        category: "flooring",

        pricePerSquareMeter: 850,

        thumbnail:
            "/uploads/materials/flooring/ceramic-white.png",

        texture:
            "/uploads/materials/flooring/ceramic-white.png"
    },


    {
        id: "floor-concrete",

        name: "Polished Concrete",

        category: "flooring",

        pricePerSquareMeter: 950,

        thumbnail:
            "/uploads/materials/flooring/concrete.png",

        texture:
            "/uploads/materials/flooring/concrete.png"
    },


    {
    id: "wall-paint-white",
    name: "White Paint",
    category: "wallFinish",
    pricePerSquareMeter: 300,
    thumbnail: "/uploads/materials/walls/white-paint.jpg",
    color: "#F5F5F5"
},
{
    id: "wall-paint-gray",
    name: "Gray Paint",
    category: "wallFinish",
    pricePerSquareMeter: 320,
    thumbnail: "/uploads/materials/walls/gray-paint.jpg",
    color: "#494848"
},
{
    id: "wall-paint-beige",
    name: "Beige Paint",
    category: "wallFinish",
    pricePerSquareMeter: 310,
    thumbnail: "/uploads/materials/walls/beige-paint.jpg",
    color: "#c9ae64"
}

];