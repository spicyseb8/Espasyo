import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,  // Add 'type' keyword
} from "react";

import {
  type User,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/firebase";
import { hasCustomerProfile } from "../firebase/user";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let authStateVersion = 0;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const currentVersion = ++authStateVersion;
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const isCustomer = await hasCustomerProfile(currentUser.uid);

        if (
          currentVersion !== authStateVersion ||
          auth.currentUser?.uid !== currentUser.uid
        ) {
          return;
        }

        if (isCustomer) {
          setUser(currentUser);
          return;
        }

        const pendingProfile = localStorage.getItem(
          "pendingEspasyoProfile"
        );
        let isPendingSignup = false;

        if (pendingProfile) {
          try {
            const profile: unknown = JSON.parse(pendingProfile);
            isPendingSignup =
              typeof profile === "object" &&
              profile !== null &&
              "email" in profile &&
              profile.email === currentUser.email;
          } catch (error) {
            console.error("Unable to read pending customer profile:", error);
          }
        }

        if (isPendingSignup && !currentUser.emailVerified) {
          setUser(currentUser);
          return;
        }

        setUser(null);
        await signOut(auth);
      } catch (error) {
        if (currentVersion !== authStateVersion) {
          return;
        }

        console.error("Unable to verify client customer account:", error);
        setUser(null);

        if (auth.currentUser?.uid === currentUser.uid) {
          await signOut(auth).catch((signOutError) => {
            console.error(
              "Unable to sign out a non-customer account:",
              signOutError
            );
          });
        }
      } finally {
        if (currentVersion === authStateVersion) {
          setLoading(false);
        }
      }
    });

    return () => {
      authStateVersion += 1;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}