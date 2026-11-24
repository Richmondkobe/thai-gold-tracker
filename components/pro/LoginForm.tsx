"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/pro/actions";

const INITIAL_STATE: LoginState = { error: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <label htmlFor="pro-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Password
      </label>
      <input
        id="pro-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
      />
      <p aria-live="polite" className="min-h-5 text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? "Checking..." : "Log in"}
      </button>
    </form>
  );
}
