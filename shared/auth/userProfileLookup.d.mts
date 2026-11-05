export interface UserProfileRecord {
  id: string;
  uid?: unknown;
  [field: string]: unknown;
}

export function resolveUserProfileByAuthUid(
  uid: string,
  matchingProfiles: UserProfileRecord[],
  legacyProfile: UserProfileRecord | null,
): UserProfileRecord | null;
