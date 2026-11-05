import { useContext } from "react";

import {
    AssetFavoritesContext,
    type AssetFavoritesContextValue
} from "./AssetFavoritesContext";

export function useAssetFavorites(): AssetFavoritesContextValue {
    const context = useContext(AssetFavoritesContext);
    if (!context) {
        throw new Error(
            "useAssetFavorites must be used within AssetFavoritesProvider."
        );
    }

    return context;
}
