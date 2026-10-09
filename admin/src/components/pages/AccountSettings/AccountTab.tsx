import {
  useState,
} from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Separator,
} from "@/components/ui/separator";

import {
  Button,
} from "@/components/ui/button";

import {
  ShieldAlert,
} from "lucide-react";

import type {
  UserRecord,
  EmployeeRecord,
} from "@/hooks/useUserDetails";

import Field
  from "./field";


interface AccountTabProps {

  type:
    | "user"
    | "employee";

  data:
    | UserRecord
    | EmployeeRecord
    | null;

  loading:
    boolean;

  error:
    string | null;

  onSuspend?:
    () => void | Promise<void>;

}


export default function AccountTab({

  type,

  data,

  loading,

  error,

  onSuspend,

}: AccountTabProps) {


  //==================================================
  // DIALOG
  //==================================================

  const [
    showSuspendDialog,
    setShowSuspendDialog,
  ] =
    useState(false);


  const [
    suspending,
    setSuspending,
  ] =
    useState(false);

  const [
    suspendError,
    setSuspendError,
  ] =
    useState("");


  //==================================================
  // LOADING
  //==================================================

  if (loading) {

    return (

      <div
        className="
          rounded-lg
          border
          border-zinc-200
          bg-white
          p-6
          text-zinc-900
        "
      >

        <p
          className="
            text-sm
            text-zinc-500
          "
        >
          Loading account...
        </p>

      </div>

    );

  }


  //==================================================
  // ERROR
  //==================================================

  if (
    error ||
    !data
  ) {

    return (

      <div
        className="
          rounded-lg
          border
          border-zinc-200
          bg-white
          p-6
          text-zinc-900
        "
      >

        <p
          className="
            text-sm
            text-red-500
          "
        >

          {
            error ??
            "Could not load this account."
          }

        </p>

      </div>

    );

  }


  //==================================================
  // ACCOUNT TYPE
  //==================================================

  const isUser =
    type === "user";


  //==================================================
  // DISPLAY NAME
  //==================================================

  const displayName =
    isUser

      ? (
          data as UserRecord
        ).full_name

      : (
          data as EmployeeRecord
        ).name;


  //==================================================
  // ACCOUNT STATUS
  //==================================================

  const accountStatus =
    data.account_status;


  const isSuspended =
    accountStatus ===
    "suspended";


  //==================================================
  // CONFIRM SUSPENSION
  //==================================================

  async function handleConfirmSuspend() {

    if (!onSuspend) {

      setShowSuspendDialog(
        false
      );

      return;

    }


    try {

      setSuspending(true);
      setSuspendError("");


      await onSuspend();


      setShowSuspendDialog(
        false
      );

    }

    catch (
      suspendError
    ) {

      console.error(
        "Failed to suspend account:",
        suspendError
      );
      setSuspendError(
        suspendError instanceof Error
          ? suspendError.message
          : "Failed to suspend account. Please try again."
      );

    }

    finally {

      setSuspending(false);

    }

  }


  //==================================================
  // RENDER
  //==================================================

  return (

    <>

      <div
        className="
          flex
          items-stretch
          gap-8
          rounded-lg
          border
          border-zinc-200
          bg-white
          p-6
          text-zinc-900
        "
      >


        {/*==================================================
            LEFT
        ================================================== */}

<div
  className="
    flex
    w-56
    shrink-0
    flex-col
    items-center
    py-4
  "
>

  {/*==================================================
      PROFILE
  ================================================== */}

  <div
    className="
      flex
      flex-col
      items-center
      gap-3
      text-center
    "
  >

    <Avatar
      className="
        h-24
        w-24
      "
    >

      <AvatarImage
        src=""
        alt={displayName}
      />

      <AvatarFallback>

        {
          displayName?.[0] ??
          "?"
        }

      </AvatarFallback>

    </Avatar>


    <div>

      <p
        className="
          font-medium
        "
      >
        {displayName}
      </p>


      <p
        className="
          text-xs
          text-zinc-500
        "
      >
        {data.email}
      </p>

    </div>

  </div>


  {/*==================================================
      ACCOUNT STATUS
  ================================================== */}

  <div
    className="
      mt-auto
      w-full
      border-t
      border-zinc-200
      pt-4
    "
  >

    <div
      className="
        flex
        items-center
        justify-between
        gap-3
      "
    >

      {/* STATUS LABEL */}

      <span
        className="
          text-xs
          font-medium
          text-zinc-500
        "
      >
        Account Status
      </span>


      {/* STATUS VALUE */}

      <div
        className="
          flex
          items-center
          gap-2
        "
      >

        <span
          className={`
            h-2
            w-2
            rounded-full
            ${
              isSuspended
                ? "bg-red-500"
                : "bg-green-500"
            }
          `}
        />


        <span
          className={`
            text-xs
            font-medium
            ${
              isSuspended
                ? "text-red-600"
                : "text-green-600"
            }
          `}
        >

          {
            isSuspended
              ? "Suspended"
              : "Active"
          }

        </span>

      </div>

    </div>

  </div>

</div>


        <Separator
          orientation="vertical"
          className="bg-zinc-200"
        />


        {/*==================================================
            RIGHT
        ================================================== */}

        <div
          className="
            flex
            flex-1
            flex-col
          "
        >


          {/*==================================================
              DETAILS
          ================================================== */}

          <div
            className="
              grid
              flex-1
              grid-cols-2
              gap-4
              py-4
            "
          >

            {isUser ? (

              <>

                <Field
                  label="Full name"
                  value={
                    (
                      data as UserRecord
                    ).full_name
                  }
                />

                <Field
                  label="Email"
                  value={
                    data.email
                  }
                />

                <Field
                  label="Phone"
                  value={
                    (
                      data as UserRecord
                    ).phone_number
                  }
                />

                <Field
                  label="Created"
                  value={
                    data.created_at
                  }
                />

                <Field
                  label="Address"
                  value={
                    (
                      data as UserRecord
                    ).address
                  }
                />

                <Field
                  label="Last updated"
                  value={
                    data.updated_at
                  }
                />

              </>

            ) : (

              <>

                <Field
                  label="Name"
                  value={
                    (
                      data as EmployeeRecord
                    ).name
                  }
                />

                <Field
                  label="Email"
                  value={
                    data.email
                  }
                />

                <Field
                  label="Role"
                  value={
                    (
                      data as EmployeeRecord
                    ).role
                  }
                />

                <Field
                  label="Created"
                  value={
                    data.created_at
                  }
                />

                <Field
                  label="Last updated"
                  value={
                    data.updated_at
                  }
                />

              </>

            )}


            

          </div>


          {/*==================================================
              ACCOUNT ACTION
          ================================================== */}

          {isUser && onSuspend && (

            <div
              className="
                mt-4
                border-t
                border-zinc-200
                pt-4
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-4
                "
              >

                <div>

                  <p
                    className="
                      text-sm
                      font-medium
                      text-zinc-900
                    "
                  >
                    Account actions
                  </p>


                  <p
                    className="
                      text-xs
                      text-zinc-500
                    "
                  >

                    {
                      isSuspended
                        ? "This account is currently suspended."
                        : "Suspend this user's access to Espasyo."
                    }

                  </p>

                </div>


                {!isSuspended ? (

                  <Button
                    type="button"
                    variant="outline"
                    className="
                      gap-2
                      border-red-200
                      text-red-600
                      hover:bg-red-50
                      hover:text-red-700
                    "
                    onClick={() =>
                      {
                        setSuspendError("");
                        setShowSuspendDialog(true);
                      }
                    }
                  >

                    <ShieldAlert
                      className="h-4 w-4"
                    />

                    Suspend Account

                  </Button>

                ) : (

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      rounded-md
                      border
                      border-red-200
                      bg-red-50
                      px-3
                      py-2
                      text-sm
                      text-red-600
                    "
                  >

                    <ShieldAlert
                      className="h-4 w-4"
                    />

                    Account Suspended

                  </div>

                )}

              </div>

            </div>

          )}

        </div>

      </div>


      {/*====================================================
          SUSPEND CONFIRMATION
      ==================================================== */}

      <AlertDialog
        open={
          showSuspendDialog
        }
        onOpenChange={
          setShowSuspendDialog
        }
      >

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>
              Suspend this account?
            </AlertDialogTitle>


            <AlertDialogDescription>

              Are you sure you want to suspend{" "}

              <span
                className="
                  font-medium
                  text-zinc-900
                "
              >
                {displayName}
              </span>

              ?

              <br />
              <br />

              This will mark the account as
              suspended. The user's projects
              and account data will not be
              deleted.

            </AlertDialogDescription>

          </AlertDialogHeader>

          {suspendError && (
            <p role="alert" className="text-sm text-red-600">
              {suspendError}
            </p>
          )}

          <AlertDialogFooter>

            <AlertDialogCancel
              disabled={
                suspending
              }
            >
              Cancel
            </AlertDialogCancel>


            <AlertDialogAction
              disabled={
                suspending
              }
              onClick={
                handleConfirmSuspend
              }
              className="
                bg-red-600
                text-white
                hover:bg-red-700
              "
            >

              {
                suspending
                  ? "Suspending..."
                  : "Yes, Suspend Account"
              }

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

}