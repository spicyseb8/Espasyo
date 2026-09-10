import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { UserRecord, EmployeeRecord } from "@/hooks/useUserDetails";
import Field from "./field";

interface AccountTabProps {
  type: "user" | "employee";
  data: UserRecord | EmployeeRecord | null;
  loading: boolean;
  error: string | null;
}

export default function AccountTab({
  type,
  data,
  loading,
  error,
}: AccountTabProps) {
  if (loading) {
    return (
      <div className="bg-white text-zinc-900 rounded-lg border border-zinc-200 p-6">
        <p className="text-sm text-zinc-500">Loading account...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white text-zinc-900 rounded-lg border border-zinc-200 p-6">
        <p className="text-sm text-red-500">
          {error ?? "Could not load this account."}
        </p>
      </div>
    );
  }

  const isUser = type === "user";
  const displayName = isUser
    ? (data as UserRecord).full_name
    : (data as EmployeeRecord).name;

  return (
    <div className="flex gap-8 items-stretch rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900">
      {/* Left: avatar */}
      <div className="flex w-56 flex-col items-center gap-3 py-4 text-center">
        <Avatar className="h-24 w-24">
          <AvatarImage src="" alt={displayName} />
          <AvatarFallback>{displayName?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-xs text-zinc-500">{data.email}</p>
        </div>
      </div>

      <Separator orientation="vertical" className="bg-zinc-200" />

      {/* Right: personal details — read-only, no password field ever rendered */}
      <div className="grid flex-1 grid-cols-2 gap-4 py-4">
        {isUser ? (
          <>
            <Field label="Full name" value={(data as UserRecord).full_name} />
            <Field label="Email" value={data.email} />
            <Field label="Phone" value={(data as UserRecord).phone_number} />
            <Field label="Created" value={data.created_at} />
            <Field label="Address" value={(data as UserRecord).address} />
            <Field label="Last updated" value={data.updated_at} />
          </>
        ) : (
          <>
            <Field label="Name" value={(data as EmployeeRecord).name} />
            <Field label="Email" value={data.email} />
            <Field label="Role" value={(data as EmployeeRecord).role} />
            <Field label="Created" value={data.created_at} />
            <Field label="Last updated" value={data.updated_at} />
          </>
        )}
      </div>
    </div>
  );
}