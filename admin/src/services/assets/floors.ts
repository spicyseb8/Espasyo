import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";

import {
    db
} from "@/firebase/firebase";

import type {
    Asset
} from "./asset-types";


export async function getFloorAssets(): Promise<Asset[]> {

    const q =
        query(
            collection(
                db,
                "assets"
            ),
            where(
                "asset_type",
                "==",
                "floor"
            )
        );


    const snapshot =
        await getDocs(
            q
        );


    return snapshot.docs.map(
        document => ({

            id:
                document.id,

            ...document.data()

        })
    ) as Asset[];

}