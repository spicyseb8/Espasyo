// admin/src/components/createfunc/createAccount.ts
import { auth } from "@/firebase/firebase";
import { API_BASE_URL } from "@/services/assets/projectApi";

export type AccountType = "user" | "employee";

export interface CreateAccountData {
  accountType: AccountType;
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  address?: string;
  role?: string;
}

export interface CreateAccountResponse {
  success: boolean;
  message: string;
  account?: {
    id: string;
    uid: string;
    name: string;
    email: string;
    accountType: AccountType;
    role?: string;
  };
}

export async function createAccount(
  data: CreateAccountData
): Promise<CreateAccountResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sign in with a superadmin account to create accounts.");
  }

  const token = await user.getIdToken();
  const response = await fetch(
    `${API_BASE_URL}/accounts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );

  let result: CreateAccountResponse;
  try {
    result = await response.json() as CreateAccountResponse;
  } catch {
    throw new Error("The account service returned an invalid response. Please try again.");
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ||
        "Failed to create account."
    );
  }

  return result;
}