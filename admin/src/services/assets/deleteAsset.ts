import { auth } from "@/firebase/firebase";
import { API_BASE_URL } from "./projectApi";

export async function deleteAsset(assetId: string): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sign in with a superadmin account to delete assets.");
  }

  const token = await user.getIdToken();
  const response = await fetch(
    `${API_BASE_URL}/assets/${encodeURIComponent(assetId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
  } | null;

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Failed to delete asset.");
  }
}
