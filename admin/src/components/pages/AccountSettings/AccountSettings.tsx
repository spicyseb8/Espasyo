import { useParams, useNavigate } from "react-router-dom";
import { User, FolderKanban, Clock3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  useUserDetail,
  type UserRecord,
  type EmployeeRecord,
} from "@/hooks/useUserDetails";

import AccountTab from "./AccountTab";
import ProjectsTab from "./ProjectsTab";
import RecentActivitiesTab from "./RecentActivitiesTab";

interface AccountSettingsProps {
  type: "user" | "employee";
}

const tabTriggerClass =
  "gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

export default function AccountSettings({
  type,
}: AccountSettingsProps) {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, loading, error } = useUserDetail(type, id);

  const displayName =
    type === "user"
      ? (data as UserRecord | null)?.full_name
      : (data as EmployeeRecord | null)?.name;

  const listLabel = type === "user" ? "Customers" : "Employees";
  // Adjust this route to match wherever your table actually lives
  const listPath = type === "user" ? "/customers" : "/employees";

  return (
    <Card className="bg-background text-foreground border-border">
      <CardHeader className="border-b border-dashed border-border pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Account Setting
          </CardTitle>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => navigate(listPath)}
                >
                  {listLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Account Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs defaultValue="account">
          <TabsList className="h-auto w-full justify-start gap-8 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="account" className={tabTriggerClass}>
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>

            <TabsTrigger value="projects" className={tabTriggerClass}>
              <FolderKanban className="h-4 w-4" />
              Projects
            </TabsTrigger>

            <TabsTrigger value="activity" className={tabTriggerClass}>
              <Clock3 className="h-4 w-4" />
              Recent Activities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6">
            <AccountTab
              type={type}
              data={data}
              loading={loading}
              error={error}
            />
          </TabsContent>

          <TabsContent value="projects" className="mt-6">
            <ProjectsTab />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <RecentActivitiesTab displayName={displayName} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}