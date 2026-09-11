import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Sun,
  Moon,
  Home,
  User,
  FileText,
  CreditCard,
  Settings,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";

import { auth, db } from "@/firebase/firebase";
import { useAuth } from "@/context/AuthContext";

interface TopBarProps {
  theme: "light" | "dark";
  onThemeToggle: () => void;
}

interface EmployeeProfile {
  name?: string;
  email?: string;
  avatar?: string;
  role?: "admin" | "superadmin";
}

const menuItems = [
  { icon: Home, label: "Home" },
  { icon: User, label: "Profile" },
  { icon: FileText, label: "Invoice", badge: 4 },
  { icon: CreditCard, label: "Subscription" },
  { icon: Settings, label: "Account settings" },
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function TopBar({
  theme,
  onThemeToggle,
}: TopBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);

  const { user, role } = useAuth();

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const employeeRef = doc(db, "adminEmployees", user.uid);

    const unsubscribe = onSnapshot(
      employeeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as EmployeeProfile;

          setProfile({
            name: data.name || user.displayName || "Admin",
            email: data.email || user.email || "",
            avatar: data.avatar || "",
            role: data.role || role || "admin",
          });

          return;
        }

        // Fallback to Firebase Auth data
        setProfile({
          name: user.displayName || "Admin",
          email: user.email || "",
          avatar: "",
          role: role || "admin",
        });
      },
      (error) => {
        console.error("Error loading admin profile:", error);

        setProfile({
          name: user.displayName || "Admin",
          email: user.email || "",
          avatar: "",
          role: role || "admin",
        });
      }
    );

    return () => unsubscribe();
  }, [user, role]);

  const displayName = profile?.name || "Admin";
  const displayEmail = profile?.email || user?.email || "";
  const avatarUrl = profile?.avatar || "";

  const initials = getInitials(displayName) || "A";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSheetOpen(false);
      window.location.href = "/login";
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <div className="h-16 flex items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-foreground flex items-center justify-center">
          <span className="text-background font-semibold text-sm">
            E
          </span>
        </div>

        <div className="leading-tight">
          <p className="text-sm font-semibold">
            Espasyo
          </p>

          <p className="text-xs text-muted-foreground -mt-0.5">
            Admin
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>

        {/* Profile */}
        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        >
          <SheetTrigger
            render={
              <button
                type="button"
                className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open profile menu"
              />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
              />

              <AvatarFallback>
                {initials}
              </AvatarFallback>
            </Avatar>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-80 p-0 flex flex-col bg-background text-foreground"
          >
            <SheetHeader className="p-0">
              <div className="flex flex-col items-center gap-2 pt-10 pb-6">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={avatarUrl}
                    alt={displayName}
                  />

                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <p className="text-sm font-semibold">
                  {displayName}
                </p>

                <p className="text-xs text-muted-foreground">
                  {displayEmail}
                </p>

                {profile?.role && (
                  <Badge
                    variant="secondary"
                    className="capitalize"
                  >
                    {profile.role}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <Separator />

            <nav className="flex flex-col py-2">
              {menuItems.map(
                ({ icon: Icon, label, badge }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex items-center justify-between px-6 py-2.5 text-sm hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{label}</span>
                    </span>

                    {badge !== undefined && (
                      <Badge
                        variant="secondary"
                        className="h-5 px-2"
                      >
                        {badge}
                      </Badge>
                    )}
                  </button>
                )
              )}
            </nav>

            {/* Bottom */}
            <div className="mt-auto flex flex-col items-center gap-3 p-6">
              <Separator className="mb-2" />

              <p className="text-sm font-medium">
                Espasyo Admin
              </p>

              <p className="text-xs text-muted-foreground -mt-2">
                Manage your workspace
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}