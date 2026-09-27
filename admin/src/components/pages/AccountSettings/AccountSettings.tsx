import {
  useParams,
  useNavigate,
} from "react-router-dom";

import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  User,
  FolderKanban,
  Clock3,
} from "lucide-react";

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

import { db } from "@/firebase/firebase";

import AccountTab from "./AccountTab";
import ProjectsTab from "./ProjectsTab";
import RecentActivitiesTab from "./RecentActivitiesTab";


//==================================================
// PROPS
//==================================================

interface AccountSettingsProps {
  type:
    | "user"
    | "employee";
}


//==================================================
// TAB STYLE
//==================================================

const tabTriggerClass =
  "gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";


//==================================================
// ACCOUNT SETTINGS
//==================================================

export default function AccountSettings({
  type,
}: AccountSettingsProps) {


  //==================================================
  // ROUTER
  //==================================================

  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();


  //==================================================
  // ACCOUNT DATA
  //==================================================

  const {
    data,
    loading,
    error,
  } = useUserDetail(
    type,
    id
  );


  //==================================================
  // DISPLAY NAME
  //==================================================

  const displayName =
    type === "user"

      ? (
          data as
            UserRecord |
            null
        )?.full_name

      : (
          data as
            EmployeeRecord |
            null
        )?.name;


  //==================================================
  // NAVIGATION
  //==================================================

  const listLabel =
    type === "user"
      ? "Customers"
      : "Employees";


  const listPath =
    type === "user"
      ? "/customers"
      : "/employees";


  //==================================================
  // PROJECT OWNER
  //==================================================

  /*
   * Projects are connected to the Firebase
   * Authentication UID.
   */

  const ownerId =
    data?.uid ??
    id ??
    "";


  //==================================================
  // SUSPEND ACCOUNT
  //==================================================

  async function handleSuspend() {

    if (!id) {

      throw new Error(
        "No account ID was found."
      );

    }


    /*
     * Determine which Firestore collection
     * this account belongs to.
     */

    const collectionName =
      type === "user"
        ? "users"
        : "adminEmployees";


    /*
     * Reference the user's Firestore document.
     */

    const accountReference =
      doc(
        db,
        collectionName,
        id
      );


    /*
     * Update the account status.
     *
     * The user's projects and other data
     * remain untouched.
     */

    await updateDoc(
      accountReference,
      {
        account_status:
          "suspended",

        updated_at:
          serverTimestamp(),
      }
    );

  }


  //==================================================
  // RENDER
  //==================================================

  return (

    <Card
      className="
        border-border
        bg-background
        text-foreground
      "
    >

      {/*==================================================
          HEADER
      ================================================== */}

      <CardHeader
        className="
          border-b
          border-dashed
          border-border
          pb-4
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <CardTitle
            className="text-base"
          >
            Account Setting
          </CardTitle>


          {/*==================================================
              BREADCRUMB
          ================================================== */}

          <Breadcrumb>

            <BreadcrumbList>

              <BreadcrumbItem>

                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() =>
                    navigate(listPath)
                  }
                >

                  {listLabel}

                </BreadcrumbLink>

              </BreadcrumbItem>


              <BreadcrumbSeparator />


              <BreadcrumbItem>

                <BreadcrumbPage>
                  Account Settings
                </BreadcrumbPage>

              </BreadcrumbItem>

            </BreadcrumbList>

          </Breadcrumb>

        </div>

      </CardHeader>


      {/*==================================================
          CONTENT
      ================================================== */}

      <CardContent
        className="pt-4"
      >

        <Tabs
          defaultValue="account"
        >


          {/*==================================================
              TAB NAVIGATION
          ================================================== */}

          <TabsList
            className="
              h-auto
              w-full
              justify-start
              gap-8
              rounded-none
              border-b
              border-border
              bg-transparent
              p-0
            "
          >

            {/* ACCOUNT */}

            <TabsTrigger
              value="account"
              className={
                tabTriggerClass
              }
            >

              <User
                className="h-4 w-4"
              />

              Account

            </TabsTrigger>


            {/* PROJECTS */}

            <TabsTrigger
              value="projects"
              className={
                tabTriggerClass
              }
            >

              <FolderKanban
                className="h-4 w-4"
              />

              Projects

            </TabsTrigger>


            {/* RECENT ACTIVITIES */}

            <TabsTrigger
              value="activity"
              className={
                tabTriggerClass
              }
            >

              <Clock3
                className="h-4 w-4"
              />

              Recent Activities

            </TabsTrigger>

          </TabsList>


          {/*==================================================
              ACCOUNT TAB
          ================================================== */}

          <TabsContent
            value="account"
            className="mt-6"
          >

            <AccountTab

              type={type}

              data={data}

              loading={loading}

              error={error}

              onSuspend={
                handleSuspend
              }

            />

          </TabsContent>


          {/*==================================================
              PROJECTS TAB
          ================================================== */}

          <TabsContent
            value="projects"
            className="mt-6"
          >

            <ProjectsTab
              ownerId={ownerId}
            />

          </TabsContent>


          {/*==================================================
              RECENT ACTIVITIES
          ================================================== */}

          <TabsContent
            value="activity"
            className="mt-6"
          >

            <RecentActivitiesTab
              displayName={
                displayName
              }
            />

          </TabsContent>


        </Tabs>

      </CardContent>

    </Card>

  );

}