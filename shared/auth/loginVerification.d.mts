export interface VerificationUser {
  emailVerified: boolean;
}

export function ensureEmailVerified<T extends VerificationUser>(
  user: T,
  sendVerification: (user: T) => Promise<unknown>,
  signOut: () => Promise<unknown>,
): Promise<{
  verified: boolean;
  verificationSent: boolean;
  verificationError?: unknown;
}>;
