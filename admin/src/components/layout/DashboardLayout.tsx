import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import TopBar from "@/components/layout/TopBar";
import Navigation from "@/components/layout/Navigation";

interface DashboardLayoutProps {
  children: (selectedPage: string) => React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedPage, setSelectedPage] = useState("dashboard");

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div
      className={
        theme === "dark"
          ? "min-h-screen w-full bg-zinc-950 text-zinc-100"
          : "min-h-screen w-full bg-background text-foreground"
      }
    >
      <div
        className={
          theme === "dark"
            ? "sticky top-0 z-50 bg-zinc-950"
            : "sticky top-0 z-50 bg-background"
        }
      >
        <TopBar
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />

        <Separator />

        <Navigation
          selectedPage={selectedPage}
          onPageChange={setSelectedPage}
        />

        <Separator />
      </div>

      <main className="px-6 py-6">
        {children(selectedPage)}
      </main>
    </div>
  );
}