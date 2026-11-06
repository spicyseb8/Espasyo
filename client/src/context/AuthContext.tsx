import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { type User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { getLegalAcceptance } from "../services/legalAcceptance";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  agreement: {
    uid: string;
    status: "checking" | "accepted" | "required" | "error";
    error: string | null;
  } | null;
  verifyAgreement: (user: User, retry?: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  agreement: null,
  verifyAgreement: async () => false,
});

interface AgreementCheck {
  result?: boolean;
  promise?: Promise<boolean>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<AuthContextType["agreement"]>(null);
  const agreementChecks = useRef(new Map<string, AgreementCheck>());

  const verifyAgreement = useCallback(async (currentUser: User, retry = false) => {
    const uid = currentUser.uid;
    let cached = agreementChecks.current.get(uid);

    if (retry) {
      agreementChecks.current.delete(uid);
      cached = undefined;
    }

    if (cached?.result !== undefined) {
      setAgreement({
        uid,
        status: cached.result ? "accepted" : "required",
        error: null,
      });
      return cached.result;
    }
    if (cached?.promise) return cached.promise;

    setAgreement({ uid, status: "checking", error: null });
    const check = getLegalAcceptance(currentUser)
      .then((accepted) => {
        if (auth.currentUser?.uid === uid) {
          agreementChecks.current.set(uid, { result: accepted });
          setAgreement({
            uid,
            status: accepted ? "accepted" : "required",
            error: null,
          });
        }
        return accepted;
      })
      .catch((error: unknown) => {
        agreementChecks.current.delete(uid);
        if (auth.currentUser?.uid === uid) {
          setAgreement({
            uid,
            status: "error",
            error: error instanceof Error
              ? error.message
              : "Unable to verify your agreement. Please retry.",
          });
        }
        throw error;
      });
    agreementChecks.current.set(uid, { promise: check });
    return check;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        agreementChecks.current.clear();
        setAgreement(null);
        return;
      }

      void verifyAgreement(currentUser).catch((error: unknown) => {
        console.error("Unable to verify access agreement:", error);
      });
    });

    return unsubscribe;
  }, [verifyAgreement]);

  return (
    <AuthContext.Provider value={{ user, loading, agreement, verifyAgreement }}>
      {children}
    </AuthContext.Provider>
  );
}

// The provider and its hook intentionally share one context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}