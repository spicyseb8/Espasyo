import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from "react";
import {
    doc,
    getDoc,
    onSnapshot,
    runTransaction,
    type DocumentData
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";
import {
    AssetFavoritesContext,
    EMPTY_FAVORITES,
    type AssetFavoriteType,
    type AssetFavorites
} from "./AssetFavoritesContext";

interface StoredFavorites {
    userId: string | null;
    favorites: AssetFavorites;
}

function parseFavorites(data?: DocumentData): AssetFavorites {
    const stored = data?.asset_favorites;
    if (!stored || typeof stored !== "object") {
        return EMPTY_FAVORITES;
    }

    return {
        furniture: Array.isArray(stored.furniture)
            ? stored.furniture.filter(
                (id: unknown): id is string => typeof id === "string"
            )
            : [],
        flooring: Array.isArray(stored.flooring)
            ? stored.flooring.filter(
                (id: unknown): id is string => typeof id === "string"
            )
            : [],
        wallPaint: Array.isArray(stored.wallPaint)
            ? stored.wallPaint.filter(
                (id: unknown): id is string => typeof id === "string"
            )
            : []
    };
}

function toggleAssetId(
    favorites: AssetFavorites,
    type: AssetFavoriteType,
    assetId: string
): AssetFavorites {
    const nextIds = favorites[type].includes(assetId)
        ? favorites[type].filter(id => id !== assetId)
        : [...favorites[type], assetId];

    return { ...favorites, [type]: nextIds };
}

export function AssetFavoritesProvider({
    children
}: {
    children: ReactNode;
}) {
    const { user, loading: authLoading } = useAuth();
    const [storedFavorites, setStoredFavorites] =
        useState<StoredFavorites | null>(null);
    const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
    const writeQueue = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => {
        if (authLoading || !user) {
            return;
        }

        const userId = user.uid;
        return onSnapshot(
            doc(db, "users", userId),
            snapshot => {
                setStoredFavorites({
                    userId,
                    favorites: parseFavorites(snapshot.data())
                });
                setLoadedUserId(userId);
            },
            error => {
                console.error("Failed to load asset favorites:", error);
                setStoredFavorites({
                    userId,
                    favorites: EMPTY_FAVORITES
                });
                setLoadedUserId(userId);
            }
        );
    }, [authLoading, user]);

    const userId = user?.uid ?? null;
    const favorites =
        storedFavorites?.userId === userId
            ? storedFavorites.favorites
            : EMPTY_FAVORITES;
    const isLoading =
        authLoading || Boolean(userId && loadedUserId !== userId);

    const isFavorite = useCallback(
        (type: AssetFavoriteType, assetId: string) =>
            favorites[type].includes(assetId),
        [favorites]
    );

    const toggleFavorite = useCallback(
        (type: AssetFavoriteType, assetId: string) => {
            const targetUserId = user?.uid ?? null;
            setStoredFavorites(current => {
                const currentFavorites =
                    current?.userId === targetUserId
                        ? current.favorites
                        : EMPTY_FAVORITES;
                return {
                    userId: targetUserId,
                    favorites: toggleAssetId(
                        currentFavorites,
                        type,
                        assetId
                    )
                };
            });

            if (!targetUserId) {
                return Promise.resolve();
            }

            const write = writeQueue.current.then(async () => {
                const userRef = doc(db, "users", targetUserId);
                const savedFavorites = await runTransaction(
                    db,
                    async transaction => {
                        const snapshot = await transaction.get(userRef);
                        const next = toggleAssetId(
                            parseFavorites(snapshot.data()),
                            type,
                            assetId
                        );

                        transaction.set(
                            userRef,
                            { asset_favorites: next },
                            { merge: true }
                        );

                        return next;
                    }
                );

                if (auth.currentUser?.uid === targetUserId) {
                    setStoredFavorites({
                        userId: targetUserId,
                        favorites: savedFavorites
                    });
                }
            }).catch(async error => {
                console.error("Failed to save asset favorite:", error);
                if (auth.currentUser?.uid === targetUserId) {
                    try {
                        const snapshot = await getDoc(
                            doc(db, "users", targetUserId)
                        );
                        setStoredFavorites({
                            userId: targetUserId,
                            favorites: parseFavorites(snapshot.data())
                        });
                    } catch (readError) {
                        console.error(
                            "Failed to reload asset favorites after save error:",
                            readError
                        );
                    }
                }
            });

            writeQueue.current = write.then(() => undefined);
            return write;
        },
        [user]
    );

    const value = useMemo(
        () => ({ favorites, isLoading, isFavorite, toggleFavorite }),
        [favorites, isLoading, isFavorite, toggleFavorite]
    );

    return (
        <AssetFavoritesContext.Provider value={value}>
            {children}
        </AssetFavoritesContext.Provider>
    );
}
