export function createRequireRole({ authClient, dbClient }) {
  return (...allowedRoles) => async (req, res, next) => {
    const authorization = req.get("authorization") ?? "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Sign in with an authorized admin account.",
      });
    }

    let decodedToken;

    try {
      decodedToken = await authClient.verifyIdToken(match[1], true);
    } catch (error) {
      console.error("Admin token verification failed:", error);
      return res.status(401).json({
        success: false,
        message: "Your admin session is invalid. Sign in again and retry.",
      });
    }

    if (decodedToken.email_verified !== true) {
      return res.status(403).json({
        success: false,
        message: "Verify your admin account email before continuing.",
      });
    }

    try {
      const employeeSnapshot = await dbClient
        .collection("adminEmployees")
        .where("uid", "==", decodedToken.uid)
        .limit(1)
        .get();
      const employee = employeeSnapshot.docs[0]?.data();

      if (!employee || employee.account_status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your account is not authorized to perform this action.",
        });
      }

      if (!allowedRoles.includes(employee.role)) {
        return res.status(403).json({
          success: false,
          message: "Your account is not authorized to perform this action.",
        });
      }

      req.adminUser = {
        uid: decodedToken.uid,
        name: typeof employee.name === "string" ? employee.name : "",
        role: employee.role,
      };

      return next();
    } catch (error) {
      console.error("Admin role lookup failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to verify your admin permissions.",
      });
    }
  };
}