import {
  onAuthStateChanged,
  reload,
  signOut,
  type User,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
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

const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "Auth state changed:",
          firebaseUser
        );

        try {
          // =============================================
          // NO FIREBASE USER
          // =============================================

          if (!firebaseUser) {
            console.log("No Firebase user.");

            setUser(null);
            setRole(null);
            setLoading(false);

            return;
          }

          console.log(
            "Firebase user UID:",
            firebaseUser.uid
          );

          console.log(
            "Email verified:",
            firebaseUser.emailVerified
          );


          // =============================================
          // RELOAD USER
          // =============================================

          await reload(firebaseUser);

          const currentUser = auth.currentUser;

          if (!currentUser) {
            console.log(
              "No current user after reload."
            );

            setUser(null);
            setRole(null);

            return;
          }

          console.log(
            "Current user UID:",
            currentUser.uid
          );


          // =============================================
          // EMAIL VERIFICATION
          // =============================================

          if (!currentUser.emailVerified) {
            console.log(
              "Email is NOT verified."
            );

            await signOut(auth);

            setUser(null);
            setRole(null);

            return;
          }

          console.log(
            "Email is verified."
          );


          // =============================================
          // FIND EMPLOYEE BY FIREBASE UID
          // =============================================

          console.log(
            "Searching adminEmployees by Firebase UID:",
            currentUser.uid
          );

          const employeeQuery = query(
            collection(db, "adminEmployees"),
            where(
              "uid",
              "==",
              currentUser.uid
            )
          );

          const employeeSnapshot =
            await getDocs(employeeQuery);

          console.log(
            "Firestore read completed."
          );

          console.log(
            "Employee document count:",
            employeeSnapshot.size
          );


          // =============================================
          // NO EMPLOYEE FOUND
          // =============================================

          if (employeeSnapshot.empty) {
            console.log(
              "No adminEmployees document found for this Firebase UID."
            );

            await signOut(auth);

            setUser(null);
            setRole(null);

            return;
          }


          // =============================================
          // GET EMPLOYEE
          // =============================================

          const employeeDocument =
            employeeSnapshot.docs[0];

          const employeeData =
            employeeDocument.data();

          console.log(
            "Employee document ID:",
            employeeDocument.id
          );

          console.log(
            "Employee data:",
            employeeData
          );


          // =============================================
          // CHECK ROLE
          // =============================================

          const employeeRole =
            employeeData.role as AdminRole;

          console.log(
            "Employee role:",
            employeeRole
          );

          if (
            employeeRole !== "admin" &&
            employeeRole !== "superadmin"
          ) {
            console.log(
              "Invalid employee role."
            );

            await signOut(auth);

            setUser(null);
            setRole(null);

            return;
          }


          // =============================================
          // SUCCESS
          // =============================================

          console.log(
            "Valid admin employee found."
          );

          console.log(
            "Firestore employee ID:",
            employeeDocument.id
          );

          console.log(
            "Firebase Auth UID:",
            currentUser.uid
          );

          console.log(
            "Authentication completed successfully."
          );

          setUser(currentUser);
          setRole(employeeRole);

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
      }
    );

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