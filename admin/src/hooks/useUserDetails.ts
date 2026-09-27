import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/firebase/firebase";


//==================================================
// ACCOUNT STATUS
//==================================================

export type AccountStatus =
  | "active"
  | "suspended";


//==================================================
// USER RECORD
//==================================================

export interface UserRecord {

  uid?: string;

  full_name: string;

  email: string;

  phone_number: string;

  address: string;

  account_status: AccountStatus;

  created_at: string;

  updated_at: string;

}


//==================================================
// EMPLOYEE RECORD
//==================================================

export interface EmployeeRecord {

  uid?: string;

  name: string;

  email: string;

  role: string;

  account_status: AccountStatus;

  created_at: string;

  updated_at: string;

}


//==================================================
// USER DETAIL HOOK
//==================================================

export function useUserDetail(
  type: "user" | "employee",
  id?: string
) {

  const [
    data,
    setData,
  ] = useState<
    UserRecord |
    EmployeeRecord |
    null
  >(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState<string | null>(null);


  //==================================================
  // FETCH ACCOUNT
  //==================================================

  useEffect(() => {

    if (!id) {

      setData(null);

      setError(
        "No account was selected."
      );

      setLoading(false);

      return;

    }


    setLoading(true);

    setError(null);


    //--------------------------------------------------
    // Determine collection
    //--------------------------------------------------

    const collectionName =
      type === "user"
        ? "users"
        : "adminEmployees";


    const accountReference =
      doc(
        db,
        collectionName,
        id
      );


    //--------------------------------------------------
    // Listen for changes
    //--------------------------------------------------

    const unsubscribe =
      onSnapshot(

        accountReference,

        (snapshot) => {

          if (!snapshot.exists()) {

            setData(null);

            setError(
              "No record found for this account."
            );

            setLoading(false);

            return;

          }


          const raw =
            snapshot.data();


          //==================================================
          // USER
          //==================================================

          if (type === "user") {

            const userData: UserRecord = {

              uid:
                typeof raw.uid === "string"
                  ? raw.uid
                  : snapshot.id,

              full_name:
                typeof raw.full_name === "string"
                  ? raw.full_name
                  : "",

              email:
                typeof raw.email === "string"
                  ? raw.email
                  : "",

              phone_number:
                typeof raw.phone_number === "string"
                  ? raw.phone_number
                  : "",

              address:
                typeof raw.address === "string"
                  ? raw.address
                  : "",

              account_status:
                raw.account_status === "suspended"
                  ? "suspended"
                  : "active",

              created_at:
                raw.created_at ?? "",

              updated_at:
                raw.updated_at ?? "",

            };


            setData(userData);

          }


          //==================================================
          // EMPLOYEE
          //==================================================

          else {

            const employeeData:
              EmployeeRecord = {

              uid:
                typeof raw.uid === "string"
                  ? raw.uid
                  : snapshot.id,

              name:
                typeof raw.name === "string"
                  ? raw.name
                  : "",

              email:
                typeof raw.email === "string"
                  ? raw.email
                  : "",

              role:
                typeof raw.role === "string"
                  ? raw.role
                  : "",

              account_status:
                raw.account_status === "suspended"
                  ? "suspended"
                  : "active",

              created_at:
                raw.created_at ?? "",

              updated_at:
                raw.updated_at ?? "",

            };


            setData(employeeData);

          }


          setError(null);

          setLoading(false);

        },


        //--------------------------------------------------
        // FIRESTORE ERROR
        //--------------------------------------------------

        (snapshotError) => {

          console.error(
            "Failed to load account:",
            snapshotError
          );


          setError(
            snapshotError.message
          );

          setData(null);

          setLoading(false);

        }

      );


    //--------------------------------------------------
    // CLEANUP
    //--------------------------------------------------

    return () => {

      unsubscribe();

    };

  }, [
    type,
    id,
  ]);


  return {

    data,

    loading,

    error,

  };

}