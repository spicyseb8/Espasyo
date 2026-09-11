import { adminAuth } from "./firebase-admin.js";

const uid = "dZvdijPVLhNXTAQjhoCDWAJ80nX2";

try {
  const user = await adminAuth.getUser(uid);

  console.log("Current user:");
  console.log("Email:", user.email);
  console.log("UID:", user.uid);
  console.log("Email verified:", user.emailVerified);

  if (user.emailVerified) {
    console.log("This email is already verified.");
    process.exit(0);
  }

  const updatedUser = await adminAuth.updateUser(uid, {
    emailVerified: true,
  });

  console.log("");
  console.log("Superadmin email successfully verified.");
  console.log("Email:", updatedUser.email);
  console.log("UID:", updatedUser.uid);
  console.log("Email verified:", updatedUser.emailVerified);

  process.exit(0);
} catch (error) {
  console.error("");
  console.error("Failed to verify Superadmin email.");
  console.error(error);

  process.exit(1);
}