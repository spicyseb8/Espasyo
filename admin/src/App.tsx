import { Routes, Route } from "react-router-dom";

import DashboardLayout from "@/components/layout/DashboardLayout";
import UserTable from "@/components/pages/UserTable/UserTable";
import AccountSettings from "@/components/pages/AccountSettings/AccountSettings";
import Login from "@/components/auth/Login";

function App() {
  return (
    
    <Routes>

       <Route path="/login" element={<Login />} />
      {/* Customer Account */}
      <Route
        path="/users/:id"
        element={
          <DashboardLayout>
            {() => <AccountSettings type="user" />}
          </DashboardLayout>
        }
      />

      {/* Employee Account */}
      <Route
        path="/employees/:id"
        element={
          <DashboardLayout>
            {() => <AccountSettings type="employee" />}
          </DashboardLayout>
        }
      />

      {/* Main Dashboard */}
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
                return (
                  <div>
                    <h1 className="text-lg font-semibold">Furniture</h1>
                  </div>
                );
              }

              if (selectedPage === "materials") {
                return (
                  <div>
                    <h1 className="text-lg font-semibold">Materials</h1>
                  </div>
                );
              }

              if (selectedPage === "textures") {
                return (
                  <div>
                    <h1 className="text-lg font-semibold">Textures</h1>
                  </div>
                );
              }

              if (selectedPage === "projects") {
                return (
                  <div>
                    <h1 className="text-lg font-semibold">Projects</h1>
                  </div>
                );
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