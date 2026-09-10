import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export interface UserRecord {
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRecord {
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

/**
 * Reads a single doc from `users/{id}` or `employees/{id}` depending on `type`.
 * Fields are explicitly whitelisted when mapping the snapshot into state —
 * password_hash (or anything else in the document) is never read in,
 * so there's no risk of it accidentally reaching the UI.
 */
export function useUserDetail(type: "user" | "employee", id?: string) {
  const [data, setData] = useState<UserRecord | EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const collectionName = type === "user" ? "users" : "employees";
    const ref = doc(db, collectionName, id);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setData(null);
          setError("No record found for this account.");
          setLoading(false);
          return;
        }

        const raw = snap.data();

        if (type === "user") {
          setData({
            full_name: raw.full_name ?? "",
            email: raw.email ?? "",
            phone_number: raw.phone_number ?? "",
            address: raw.address ?? "",
            created_at: raw.created_at ?? "",
            updated_at: raw.updated_at ?? "",
          });
        } else {
          setData({
            name: raw.name ?? "",
            email: raw.email ?? "",
            role: raw.role ?? "",
            created_at: raw.created_at ?? "",
            updated_at: raw.updated_at ?? "",
          });
        }

        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [type, id]);

  return { data, loading, error };
}