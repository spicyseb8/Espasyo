import { createContext } from "react";

export type AssetFavoriteType =
    | "furniture"
    | "flooring"
    | "wallPaint";

export type AssetFavorites = Record<AssetFavoriteType, string[]>;

export const EMPTY_FAVORITES: AssetFavorites = {
    furniture: [],
    flooring: [],
    wallPaint: []
};

export interface AssetFavoritesContextValue {
    favorites: AssetFavorites;
    isLoading: boolean;
    isFavorite: (type: AssetFavoriteType, assetId: string) => boolean;
    toggleFavorite: (
        type: AssetFavoriteType,
        assetId: string
    ) => Promise<void>;
}

export const AssetFavoritesContext =
    createContext<AssetFavoritesContextValue | null>(null);
