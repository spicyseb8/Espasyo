export function getLoginErrorMessage(code, fallback = "Unable to sign in. Please try again.") {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "permission-denied":
    case "unavailable":
      return "Unable to load your account profile. Please try again or contact support.";
    default:
      return fallback;
  }
}
