export type AssetType =
  | "floor"
  | "wall"
  | "furniture";

export type AssetStatus =
  | "available"
  | "not_available";

export interface Asset {
  id: string;

  name: string;
  asset_type: AssetType;
  category: string;
  price: number;

  asset_status?: AssetStatus | null;

  // Firebase Storage paths
  storage_path?: string | null;
  thumbnail_path?: string | null;

  // Optional texture maps
  ao_path?: string | null;
  diffuse_path?: string | null;
  normal_path?: string | null;
  rough_path?: string | null;

  // Optional material properties
  color?: string | null;
  roughness?: number | null;
  metalness?: number | null;

  created_at?: unknown;
  updated_at?: unknown;
}