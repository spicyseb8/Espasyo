import {
  onAuthStateChanged,
  reload,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { auth, db } from "@/firebase/firebase";

type AdminRole = "admin" | "superadmin";

interface AuthContextType {
  user: User | null;
  role: AdminRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {

      // DEBUG 1
      console.log("Auth state changed:", firebaseUser);

      try {
        if (!firebaseUser) {
          console.log("No Firebase user.");

          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        console.log("Firebase user UID:", firebaseUser.uid);
        console.log(
          "Email verified:",
          firebaseUser.emailVerified
        );

        // Make sure the latest emailVerified state is loaded.
        await reload(firebaseUser);

        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.log("No current user after reload.");

          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        console.log(
          "Current user UID:",
          currentUser.uid
        );

        // Admin accounts must have verified emails.
        if (!currentUser.emailVerified) {
          console.log("Email is NOT verified.");

          await signOut(auth);

          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        console.log("Email is verified.");

        // Find the employee/admin record using the Firebase Auth UID.
        const employeeRef = doc(
          db,
          "adminEmployees",
          currentUser.uid
        );

        console.log(
          "Reading adminEmployees:",
          currentUser.uid
        );

        const employeeSnapshot = await getDoc(employeeRef);

        console.log("Firestore read completed");

console.log(
  "Employee document exists:",
  employeeSnapshot.exists()
);

        if (!employeeSnapshot.exists()) {
          console.log(
            "No adminEmployees document found."
          );

          // Authenticated user exists, but is not an Admin/Superadmin.
          await signOut(auth);

          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        const employeeData = employeeSnapshot.data();

        console.log(
          "Employee data:",
          employeeData
        );

        const employeeRole = employeeData.role;

        console.log(
          "Employee role:",
          employeeRole
        );

        if (
          employeeRole !== "admin" &&
          employeeRole !== "superadmin"
        ) {
          console.log("Invalid employee role.");

          await signOut(auth);

          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        console.log(
          "Valid role. Setting user and role."
        );

        setUser(currentUser);
        setRole(employeeRole);

        console.log(
          "Authentication completed successfully."
        );

      } catch (error) {
        console.error(
          "Authentication error:",
          error
        );

        setUser(null);
        setRole(null);

        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out errors.
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider"
    );
  }

  return context;
}