import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import TopBar from "@/components/layout/TopBar";
import Navigation from "@/components/layout/Navigation";

interface DashboardLayoutProps {
  children: (selectedPage: string) => React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedPage, setSelectedPage] = useState("dashboard");

  const handlePageChange = (page: string) => {
    setSelectedPage(page);

    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="sticky top-0 z-50 bg-background">
        <TopBar />
        <Separator />
        <Navigation selectedPage={selectedPage} onPageChange={handlePageChange} />
        <Separator />
      </div>

      <main className="px-6 py-6">
        {children(selectedPage)}
      </main>
    </div>
  );
}