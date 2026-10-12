import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AccountSettings from "@/components/pages/AccountSettings/AccountSettings";
import AssetLibrary from "@/components/pages/AssetLibrary/AssetLibrary";
import ProjectManagement from "@/components/pages/ProjectManagement/ProjectManagement";
import AdminProjectLoader from "@/components/project-loader/AdminProjectLoader";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Login from "@/components/auth/Login";
import UserTable from "@/components/pages/UserTable/UserTable";
import Home from "@/components/pages/Home";
import { useAuth } from "@/context/AuthContext";

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Checking access...
      </div>
    );
  }

  if (!user || !role) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/projects/view/:projectId"
        element={
          <RequireAdmin>
            <AdminProjectLoader />
          </RequireAdmin>
        }
      />

      <Route
        path="/users/:id"
        element={
          <RequireAdmin>
            <DashboardLayout>
              {() => <AccountSettings type="user" />}
            </DashboardLayout>
          </RequireAdmin>
        }
      />

      <Route
        path="/employees/:id"
        element={
          <RequireAdmin>
            <DashboardLayout>
              {() => <AccountSettings type="employee" />}
            </DashboardLayout>
          </RequireAdmin>
        }
      />

      <Route
        path="/"
        element={
          <RequireAdmin>
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

                return <Home />;
              }}
            </DashboardLayout>
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
