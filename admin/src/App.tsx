import { Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import UserTable from "@/components/pages/UserTable/UserTable";
import AccountSettings from "@/components/pages/AccountSettings/AccountSettings";
import AssetLibrary from "@/components/pages/AssetLibrary/AssetLibrary";
import Login from "@/components/auth/Login";
import ProjectManagement from "@/components/pages/ProjectManagement/ProjectManagement";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/users/:id"
        element={
          <DashboardLayout>
            {() => <AccountSettings type="user" />}
          </DashboardLayout>
        }
      />

      <Route
        path="/employees/:id"
        element={
          <DashboardLayout>
            {() => <AccountSettings type="employee" />}
          </DashboardLayout>
        }
      />

      <Route
        path="*"
        element={
          <DashboardLayout>
            {(selectedPage) => {
              if (selectedPage === "customers") {
                return <UserTable type="customers" />;
              }

              if (selectedPage === "employees") {
                return <UserTable type="employees" />;
              }

              if (selectedPage === "furniture") {
                return <AssetLibrary type="furniture" />;
              }

              if (selectedPage === "floors") {
                return <AssetLibrary type="floor" />;
              }

              if (selectedPage === "walls") {
                return <AssetLibrary type="wall" />;
              }

              if (selectedPage === "projects") {
                return <ProjectManagement />;
              }

              return (
                <div>
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                </div>
              );
            }}
          </DashboardLayout>
        }
      />
    </Routes>
  );
}

export default App;