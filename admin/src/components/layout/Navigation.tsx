import {
  LayoutDashboard,
  Users,
  Package,
  FolderKanban,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

interface NavigationProps {
  selectedPage: string;
  onPageChange: (page: string) => void;
}

export default function Navigation({
  selectedPage,
  onPageChange,
}: NavigationProps) {
  return (
    <nav className="h-14 flex items-center px-6">
      <NavigationMenu>
        <NavigationMenuList className="gap-1">
          <NavigationMenuItem>
            <NavigationMenuLink
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                selectedPage === "dashboard"
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => onPageChange("dashboard")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavigationMenuLink>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger className="h-9 gap-2 px-3 text-sm font-medium">
              <Users className="h-4 w-4" />
              Users
            </NavigationMenuTrigger>

            <NavigationMenuContent>
              <div className="w-[140px] p-1">
                <NavigationMenuLink
                  onClick={() => onPageChange("customers")}
                  className={`block cursor-pointer rounded-md px-3 py-2 text-sm ${
                    selectedPage === "customers"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Customers
                </NavigationMenuLink>

                <NavigationMenuLink
                  onClick={() => onPageChange("employees")}
                  className={`block cursor-pointer rounded-md px-3 py-2 text-sm ${
                    selectedPage === "employees"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Employees
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger className="h-9 gap-2 px-3 text-sm font-medium">
              <Package className="h-4 w-4" />
              Assets
            </NavigationMenuTrigger>

            <NavigationMenuContent>
              <div className="w-[140px] p-1">
                <NavigationMenuLink
                  onClick={() => onPageChange("furniture")}
                  className={`block cursor-pointer rounded-md px-3 py-2 text-sm ${
                    selectedPage === "furniture"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Furniture
                </NavigationMenuLink>

                <NavigationMenuLink
                  onClick={() => onPageChange("materials")}
                  className={`block cursor-pointer rounded-md px-3 py-2 text-sm ${
                    selectedPage === "materials"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Materials
                </NavigationMenuLink>

                <NavigationMenuLink
                  onClick={() => onPageChange("textures")}
                  className={`block cursor-pointer rounded-md px-3 py-2 text-sm ${
                    selectedPage === "textures"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  Textures
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                selectedPage === "projects"
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => onPageChange("projects")}
            >
              <FolderKanban className="h-4 w-4" />
              Projects
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}