export async function ensureEmailVerified(user, sendVerification, signOut) {
  if (user.emailVerified) {
    return { verified: true, verificationSent: false };
  }

  let verificationError;
  try {
    await sendVerification(user);
  } catch (error) {
    verificationError = error;
  }
  await signOut();
  return {
    verified: false,
    verificationSent: verificationError === undefined,
    ...(verificationError === undefined ? {} : { verificationError }),
  };
}
