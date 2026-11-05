const ACCOUNT_ID_PATTERN = /^U-\d{5,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_STATUSES = new Set(["active", "suspended"]);

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isClientAccountRecord(document, data, employeeIdentifiers) {
  const accountId = normalizedString(document.id);
  const uid = normalizedString(data.uid);
  const email = normalizedString(data.email).toLowerCase();
  const fullName = normalizedString(data.full_name);

  return ACCOUNT_ID_PATTERN.test(accountId) &&
    normalizedString(data.id) === accountId &&
    uid.length > 0 &&
    EMAIL_PATTERN.test(email) &&
    fullName.length > 0 &&
    CLIENT_STATUSES.has(data.account_status) &&
    !Object.hasOwn(data, "role") &&
    !employeeIdentifiers.has(accountId) &&
    !employeeIdentifiers.has(uid);
}

function matchesClientIdentity(authUser, data) {
  return authUser.uid === normalizedString(data.uid) &&
    normalizedString(authUser.email).toLowerCase() ===
      normalizedString(data.email).toLowerCase();
}

export async function migrateClientEmailVerification({
  adminAuth,
  adminDb,
  apply = false,
}) {
  const [usersSnapshot, employeesSnapshot] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("adminEmployees").get(),
  ]);
  const employeeIdentifiers = new Set();
  for (const document of employeesSnapshot.docs) {
    const data = document.data();
    employeeIdentifiers.add(document.id);
    const uid = normalizedString(data.uid);
    if (uid) employeeIdentifiers.add(uid);
  }

  const result = {
    inspected: usersSnapshot.size,
    eligible: 0,
    alreadyVerified: 0,
    migrated: 0,
    skipped: 0,
  };

  for (const document of usersSnapshot.docs) {
    const profile = document.data();
    if (!isClientAccountRecord(document, profile, employeeIdentifiers)) {
      result.skipped += 1;
      continue;
    }

    const uid = normalizedString(profile.uid);
    let authUser;
    try {
      authUser = await adminAuth.getUser(uid);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        result.skipped += 1;
        continue;
      }
      throw error;
    }

    if (!matchesClientIdentity(authUser, profile)) {
      result.skipped += 1;
      continue;
    }
    if (authUser.emailVerified) {
      result.alreadyVerified += 1;
      continue;
    }

    result.eligible += 1;
    if (!apply) continue;

    const currentProfileSnapshot = await document.ref.get();
    const currentProfile = currentProfileSnapshot.data();
    if (
      !currentProfileSnapshot.exists ||
      !isClientAccountRecord(
        document,
        currentProfile,
        employeeIdentifiers
      ) ||
      !matchesClientIdentity(authUser, currentProfile)
    ) {
      result.skipped += 1;
      result.eligible -= 1;
      continue;
    }

    const latestAuthUser = await adminAuth.getUser(uid);
    if (!matchesClientIdentity(latestAuthUser, currentProfile)) {
      result.skipped += 1;
      result.eligible -= 1;
      continue;
    }
    if (latestAuthUser.emailVerified) {
      result.alreadyVerified += 1;
      result.eligible -= 1;
      continue;
    }

    await adminAuth.updateUser(uid, { emailVerified: true });
    const verifiedAuthUser = await adminAuth.getUser(uid);
    if (
      !verifiedAuthUser.emailVerified ||
      !matchesClientIdentity(verifiedAuthUser, currentProfile)
    ) {
      throw new Error(
        `Could not verify the updated Auth identity for client account ${document.id}.`
      );
    }
    result.migrated += 1;
  }

  return result;
}
