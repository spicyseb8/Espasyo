import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useAuth } from "./AuthContext";

type RequestProtectedNavigation = (destination: string) => void;

const ProtectedNavigationContext = createContext<RequestProtectedNavigation | null>(null);

export function ProtectedNavigationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  const requestNavigation = useCallback((path: string) => {
    if (user) {
      navigate(path);
      return;
    }
    setDestination(path);
  }, [navigate, user]);

  const handleLogin = () => {
    if (destination) {
      navigate("/auth", { state: { from: destination } });
      setDestination(null);
    }
  };

  return (
    <ProtectedNavigationContext.Provider value={requestNavigation}>
      {children}
      <AlertDialog
        open={destination !== null}
        onOpenChange={(open) => {
          if (!open) setDestination(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Login required</AlertDialogTitle>
            <AlertDialogDescription>
              Please log in to access this section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogin}>Login</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedNavigationContext.Provider>
  );
}

// The provider and its hook intentionally share one context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useProtectedNavigation() {
  const requestNavigation = useContext(ProtectedNavigationContext);
  if (!requestNavigation) {
    throw new Error("useProtectedNavigation must be used within ProtectedNavigationProvider.");
  }
  return requestNavigation;
}
