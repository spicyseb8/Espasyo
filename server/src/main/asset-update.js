const FLOOR_PATTERNS = new Set([
  "stack-bond",
  "brick-bond",
  "diagonal",
  "herringbone",
]);

const OPTIONAL_FURNITURE_PRICE_CATEGORIES = new Set([
  "decorations",
  "appliances",
]);

const DEFAULT_FLOOR_GROUT_WIDTH_M = 0.003;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isOptionalFurniturePrice(category) {
  return OPTIONAL_FURNITURE_PRICE_CATEGORIES.has(
    String(category).trim().toLowerCase().replace(/[\s_-]+/g, ""),
  );
}

export function buildAssetUpdate(asset, input, fieldValue) {
  if (!asset || !input || typeof input !== "object") {
    throw invalid("Asset update data is invalid.");
  }

  if (
    !["furniture", "floor", "wall"].includes(asset.asset_type) ||
    input.asset_type !== asset.asset_type
  ) {
    throw invalid("Asset type cannot be changed.");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const category = typeof input.category === "string"
    ? input.category.trim()
    : "";
  if (!name) throw invalid("Asset name is required.");
  if (!category) throw invalid("Asset category is required.");
  if (!["available", "not_available"].includes(input.asset_status)) {
    throw invalid("Asset status is invalid.");
  }

  const hasLength = input.length !== undefined;
  const hasWidth = input.width !== undefined;
  if (hasLength !== hasWidth) {
    throw invalid("Floor length and width must be provided together.");
  }

  const updates = {
    name,
    category,
    asset_status: input.asset_status,
  };

  if (input.shareWithWalls !== undefined) {
    if (
      asset.asset_type !== "floor" ||
      typeof input.shareWithWalls !== "boolean"
    ) {
      throw invalid("Share with Walls is only available for floor assets.");
    }
    updates.shareWithWalls = input.shareWithWalls;
  }

  if (hasLength && hasWidth) {
    if (
      asset.asset_type !== "floor" &&
      !(
        asset.asset_type === "wall" &&
        asset.floorMaterialMode === "single-tile"
      )
    ) {
      throw invalid("Only physical floor or wall textures can have material dimensions.");
    }

    if (
      typeof input.length !== "number" ||
      !Number.isFinite(input.length) ||
      input.length <= DEFAULT_FLOOR_GROUT_WIDTH_M
    ) {
      throw invalid("Floor length must be greater than the 3 mm grout width.");
    }
    if (
      typeof input.width !== "number" ||
      !Number.isFinite(input.width) ||
      input.width <= DEFAULT_FLOOR_GROUT_WIDTH_M
    ) {
      throw invalid("Floor width must be greater than the 3 mm grout width.");
    }

    updates.length = input.length;
    updates.width = input.width;
  }

  if (input.floorPattern !== undefined) {
    if (
      !(
        asset.asset_type === "floor" ||
        (asset.asset_type === "wall" &&
          asset.floorMaterialMode === "single-tile")
      ) ||
      !FLOOR_PATTERNS.has(input.floorPattern)
    ) {
      throw invalid("Material pattern is not supported.");
    }
    if (!hasLength || !hasWidth) {
      throw invalid("Floor dimensions are required when updating the pattern.");
    }
    if (
      input.floorPattern === "herringbone" &&
      Math.abs(input.length / input.width - 2) > 1e-6
    ) {
      throw invalid("Herringbone requires tile length to be twice the tile width.");
    }
    updates.floorPattern = input.floorPattern;
  }

  if (input.pricePerPiece !== undefined) {
    if (asset.asset_type !== "floor" || !hasLength || !hasWidth) {
      throw invalid("Floor dimensions are required when updating a price per tile.");
    }
    if (
      typeof input.pricePerPiece !== "number" ||
      !Number.isFinite(input.pricePerPiece) ||
      input.pricePerPiece < 0
    ) {
      throw invalid("Floor price per tile must be a valid number of 0 or more.");
    }
    updates.pricePerPiece = input.pricePerPiece;
  } else if (input.price !== undefined) {
    if (
      typeof input.price !== "number" ||
      !Number.isFinite(input.price) ||
      input.price < 0
    ) {
      throw invalid("Asset price must be a valid number of 0 or more.");
    }
    updates.price = input.price;
  } else if (
    asset.asset_type === "furniture" &&
    isOptionalFurniturePrice(category)
  ) {
    updates.price = fieldValue.deleteField();
  } else {
    throw invalid("Asset price must be a valid number of 0 or more.");
  }

  updates.updated_at = fieldValue.serverTimestamp();
  return updates;
}
