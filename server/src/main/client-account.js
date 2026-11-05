import { isFloorPlanClientAccount } from "./floorplan-client-eligibility.js";

export async function findClientAccountByIdentifier(
  db,
  ownerId,
  { requireActive = true } = {},
) {
  const [usersByUid, userById, employeesByUid, employeeById] = await Promise.all([
    db.collection("users").where("uid", "==", ownerId).limit(1).get(),
    db.collection("users").doc(ownerId).get(),
    db.collection("adminEmployees").where("uid", "==", ownerId).limit(1).get(),
    db.collection("adminEmployees").doc(ownerId).get(),
  ]);
  const document = usersByUid.docs[0] ?? (userById.exists ? userById : null);
  if (!document || employeesByUid.docs.length > 0 || employeeById.exists) return null;

  const data = document.data();
  const uid = typeof data.uid === "string" && data.uid.trim()
    ? data.uid.trim()
    : document.id;
  const resolvedEmployee = uid === ownerId
    ? null
    : await db.collection("adminEmployees").where("uid", "==", uid).limit(1).get();
  if (
    resolvedEmployee?.docs.length ||
    !isFloorPlanClientAccount(data, [uid, document.id], new Set()) ||
    (requireActive && data.account_status !== "active")
  ) {
    return null;
  }
  return { id: document.id, uid, document, data };
}
