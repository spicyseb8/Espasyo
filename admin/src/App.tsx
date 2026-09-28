import { Routes, Route } from "react-router-dom";

import DashboardLayout from "@/components/layout/DashboardLayout";

import UserTable
  from "@/components/pages/UserTable/UserTable";

import AccountSettings
  from "@/components/pages/AccountSettings/AccountSettings";

import AssetLibrary
  from "@/components/pages/AssetLibrary/AssetLibrary";

import ProjectsTab
  from "@/components/pages/AccountSettings/ProjectsTab";

import AdminProjectLoader
  from "@/components/project-loader/AdminProjectLoader";

import Login
  from "@/components/auth/Login";


function App() {

  return (

    <Routes>

      {/*==================================================
          LOGIN
      ==================================================*/}
      <Route
        path="/login"
        element={
          <Login />
        }
      />


      {/*==================================================
          ADMIN PROJECT VIEWER
          
          This is intentionally outside DashboardLayout
          because the project viewer will be a full-screen
          read-only 3D view.
      ==================================================*/}
      <Route
        path="/projects/view/:projectId"
        element={
          <AdminProjectLoader />
        }
      />


      {/*==================================================
          CUSTOMER ACCOUNT
      ==================================================*/}
      <Route
        path="/users/:id"
        element={

          <DashboardLayout>

            {() => (
              <AccountSettings
                type="user"
              />
            )}

          </DashboardLayout>

        }
      />


      {/*==================================================
          EMPLOYEE ACCOUNT
      ==================================================*/}
      <Route
        path="/employees/:id"
        element={

          <DashboardLayout>

            {() => (
              <AccountSettings
                type="employee"
              />
            )}

          </DashboardLayout>

        }
      />


      {/*==================================================
          MAIN ADMIN DASHBOARD
      ==================================================*/}
      <Route
        path="*"
        element={

          <DashboardLayout>

            {(selectedPage) => {

              {/*------------------------------------------
                  CUSTOMERS
              ------------------------------------------*/}
              if (
                selectedPage === "customers"
              ) {

                return (
                  <UserTable
                    type="customers"
                  />
                );

              }


              {/*------------------------------------------
                  EMPLOYEES
              ------------------------------------------*/}
              if (
                selectedPage === "employees"
              ) {

                return (
                  <UserTable
                    type="employees"
                  />
                );

              }


              {/*------------------------------------------
                  FURNITURE
              ------------------------------------------*/}
              if (
                selectedPage === "furniture"
              ) {

                return (
                  <AssetLibrary
                    type="furniture"
                  />
                );

              }


              {/*------------------------------------------
                  FLOORS
              ------------------------------------------*/}
              if (
                selectedPage === "floors"
              ) {

                return (
                  <AssetLibrary
                    type="floor"
                  />
                );

              }


              {/*------------------------------------------
                  WALLS
              ------------------------------------------*/}
              if (
                selectedPage === "walls"
              ) {

                return (
                  <AssetLibrary
                    type="wall"
                  />
                );

              }


              {/*------------------------------------------
                  PROJECTS
              ------------------------------------------*/}
              if (
                selectedPage === "projects"
              ) {

                return (
                  <ProjectsTab />
                );

              }


              {/*------------------------------------------
                  DASHBOARD
              ------------------------------------------*/}
              return (

                <div>

                  <h1 className="text-lg font-semibold">
                    Dashboard
                  </h1>

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