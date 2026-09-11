import {
    collection,
    getDocs,
    query,
    where,
  } from "firebase/firestore";
  
  import { db } from "@/firebase/firebase";
  import type { Asset } from "./asset-types";
  
  export async function getWallAssets(): Promise<Asset[]> {
    const q = query(
      collection(db, "assets"),
      where("asset_type", "==", "wall")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Asset[];
  }