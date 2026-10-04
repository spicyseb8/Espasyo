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

  asset_status?:
    | AssetStatus
    | null;

  storage_path?:
    | string
    | null;

  model_path?:
    | string
    | null;

  model_url?:
    | string
    | null;

  diffuse_url?:
    | string
    | null;

  base_color_path?:
    | string
    | null;

  base_color_url?:
    | string
    | null;

  roughness_path?:
    | string
    | null;

  placement_surface?:
    | "floor"
    | "wall"
    | "furniture"
    | null;

  rotation_offset_y?:
    | number
    | null;

  depth_offset?:
    | number
    | null;

  snap_targets?:
    | string[]
    | null;

  thumbnail_path?:
    | string
    | null;

  ao_path?:
    | string
    | null;

  diffuse_path?:
    | string
    | null;

  normal_path?:
    | string
    | null;

  rough_path?:
    | string
    | null;

  color?:
    | string
    | null;

  roughness?:
    | number
    | null;

  metalness?:
    | number
    | null;

  created_at?: unknown;

  updated_at?: unknown;
}