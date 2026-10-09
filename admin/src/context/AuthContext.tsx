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
import { isAdminRole, type AdminRole } from "@/lib/adminRole";

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
        setLoading(true);

        try {
          if (!firebaseUser) {
            setUser(null);
            setRole(null);
            return;
          }

          await reload(firebaseUser);

          const currentUser = auth.currentUser;

          if (!currentUser) {
            setUser(null);
            setRole(null);
            return;
          }

          if (!currentUser.emailVerified) {
            await signOut(auth);
            setUser(null);
            setRole(null);
            return;
          }

          const employeeQuery = query(
            collection(db, "adminEmployees"),
            where("uid", "==", currentUser.uid)
          );

          const employeeSnapshot =
            await getDocs(employeeQuery);

          const employee = employeeSnapshot.docs.find(
            (document) => isAdminRole(document.data().role)
          );
          const employeeRole = employee?.data().role;

          if (!isAdminRole(employeeRole)) {
            await signOut(auth);
            setUser(null);
            setRole(null);
            return;
          }

          setUser(currentUser);
          setRole(employeeRole);
        } catch (error) {
          console.error("Authentication error:", error);
          setUser(null);
          setRole(null);

          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error(
              "Unable to sign out after authentication failed:",
              signOutError
            );
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