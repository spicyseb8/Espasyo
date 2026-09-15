export type AssetType =
  | "furniture"
  | "wall"
  | "floor";

export type AssetStatus =
  | "available"
  | "not_available";

export interface Asset {
  id: string;
  name: string;

  asset_type: AssetType;
  category: string;
  price: number;

  asset_status: AssetStatus;

  // Furniture / Wall
  thumbnail_path?: string;
  model_path?: string;

  // Floor material files
  storage_path?: string;
  ao_path?: string;
  diffuse_path?: string;
  normal_path?: string;
  rough_path?: string;

  // Optional material properties
  color?: string;
  roughness?: number;
  metalness?: number;

  // Firestore timestamps
  created_at?: unknown;
  updated_at?: unknown;
}