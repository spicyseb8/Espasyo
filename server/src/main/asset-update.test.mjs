import assert from "node:assert/strict";
import test from "node:test";

import { buildAssetUpdate } from "./asset-update.js";

const fieldValue = {
  deleteField: () => "DELETE_FIELD",
  serverTimestamp: () => "SERVER_TIMESTAMP",
};

test("builds a validated asset update", () => {
  const update = buildAssetUpdate(
    { asset_type: "furniture" },
    {
      asset_type: "furniture",
      name: "  Sofa  ",
      category: "sofas",
      price: 250,
      asset_status: "available",
      unexpected: "ignored",
    },
    fieldValue,
  );

  assert.deepEqual(update, {
    name: "Sofa",
    category: "sofas",
    asset_status: "available",
    price: 250,
    updated_at: "SERVER_TIMESTAMP",
  });
});

test("removes price for optional furniture categories when omitted", () => {
  const update = buildAssetUpdate(
    { asset_type: "furniture" },
    {
      asset_type: "furniture",
      name: "Lamp",
      category: "Decorations",
      asset_status: "available",
    },
    fieldValue,
  );

  assert.equal(update.price, "DELETE_FIELD");
});

test("validates floor dimensions and herringbone proportions", () => {
  const update = buildAssetUpdate(
    { asset_type: "floor" },
    {
      asset_type: "floor",
      name: "Tile",
      category: "tiles",
      asset_status: "available",
      pricePerPiece: 18,
      length: 0.6,
      width: 0.3,
      floorPattern: "herringbone",
    },
    fieldValue,
  );

  assert.equal(update.pricePerPiece, 18);
  assert.equal(update.floorPattern, "herringbone");
  assert.throws(
    () => buildAssetUpdate(
      { asset_type: "floor" },
      {
        asset_type: "floor",
        name: "Tile",
        category: "tiles",
        asset_status: "available",
        pricePerPiece: 18,
        length: 0.6,
        width: 0.4,
        floorPattern: "herringbone",
      },
      fieldValue,
    ),
    /twice the tile width/,
  );
});

test("updates Share with Walls only when a floor asset explicitly supplies it", () => {
  const asset = {
    asset_type: "floor",
    floorMaterialMode: "single-tile",
  };
  const base = {
    asset_type: "floor",
    name: "Tile",
    category: "tiles",
    asset_status: "available",
    pricePerPiece: 18,
    length: 0.6,
    width: 0.3,
    floorPattern: "stack-bond",
  };

  const shared = buildAssetUpdate(
    asset,
    { ...base, shareWithWalls: true },
    fieldValue,
  );
  assert.equal(shared.shareWithWalls, true);

  const unchanged = buildAssetUpdate(asset, base, fieldValue);
  assert.equal(Object.hasOwn(unchanged, "shareWithWalls"), false);

  assert.throws(
    () => buildAssetUpdate(
      { asset_type: "wall" },
      {
        ...base,
        asset_type: "wall",
        shareWithWalls: true,
      },
      fieldValue,
    ),
    /only available for floor assets/,
  );
});

test("allows dimensioned wall textures to update shared floor patterns", () => {
  const update = buildAssetUpdate(
    { asset_type: "wall", floorMaterialMode: "single-tile" },
    {
      asset_type: "wall",
      name: "Wall tile",
      category: "tile",
      price: 250,
      asset_status: "available",
      length: 0.6,
      width: 0.3,
      floorPattern: "brick-bond",
    },
    fieldValue,
  );
  assert.equal(update.length, 0.6);
  assert.equal(update.width, 0.3);
  assert.equal(update.floorPattern, "brick-bond");
});

test("rejects changing the asset type or invalid status", () => {
  const base = {
    asset_type: "furniture",
    name: "Sofa",
    category: "sofas",
    price: 250,
    asset_status: "available",
  };
  assert.throws(
    () => buildAssetUpdate(
      { asset_type: "furniture" },
      { ...base, asset_type: "floor" },
      fieldValue,
    ),
    /cannot be changed/,
  );
  assert.throws(
    () => buildAssetUpdate(
      { asset_type: "furniture" },
      { ...base, asset_status: "deleted" },
      fieldValue,
    ),
    /status is invalid/,
  );
});
