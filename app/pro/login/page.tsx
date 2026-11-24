import { redirect } from "next/navigation";
import { LoginForm } from "@/components/pro/LoginForm";
import { PRO_HOME_PATH, hasProSession, isProConfigured } from "@/lib/pro/auth";

export default async function ProLoginPage() {
  if (await hasProSession()) redirect(PRO_HOME_PATH);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Private area</h1>
      {isProConfigured() ? (
        <LoginForm />
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This area is not set up yet. Add a <code>PRO_PASSWORD</code> environment variable (at
          least 8 characters) and redeploy.
        </p>
      )}
    </main>
  );
}
