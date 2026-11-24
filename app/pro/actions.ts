"use server";

import { redirect } from "next/navigation";
import {
  PRO_HOME_PATH,
  PRO_LOGIN_PATH,
  isProConfigured,
  logInWithPassword,
  logOut,
} from "@/lib/pro/auth";

export interface LoginState {
  error: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isProConfigured()) {
    return { error: "This area is not set up yet." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter the password." };
  }

  if (!(await logInWithPassword(password))) {
    return { error: "Wrong password." };
  }

  redirect(PRO_HOME_PATH);
}

export async function logoutAction(): Promise<void> {
  await logOut();
  redirect(PRO_LOGIN_PATH);
}
