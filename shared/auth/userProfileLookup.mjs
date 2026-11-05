export function resolveUserProfileByAuthUid(uid, matchingProfiles, legacyProfile) {
  if (matchingProfiles.length > 1) {
    throw new Error("More than one account profile is linked to this login.");
  }
  if (matchingProfiles.length === 1) return matchingProfiles[0];
  if (!legacyProfile) return null;
  if (typeof legacyProfile.uid === "string" && legacyProfile.uid !== uid) return null;
  return legacyProfile;
}
