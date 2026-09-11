export type AssetType = "furniture" | "wall" | "floor";

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  category: string;
  price: number;

  thumbnail_path?: string;
  model_path?: string;

  color?: string;
  roughness?: number;
  metalness?: number;

  base_color_path?: string;
  normal_path?: string;
  roughness_path?: string;
}