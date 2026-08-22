import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "ยืนยันการแจ้งเตือนราคาทอง",
  robots: { index: false },
};

async function confirmAlert(token: string | undefined) {
  if (!token) return "invalid" as const;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, confirmed")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return "invalid" as const;
  if (data.confirmed) return "already" as const;

  const { error: updateError } = await supabase
    .from("price_alerts")
    .update({ confirmed: true })
    .eq("id", data.id);

  if (updateError) return "invalid" as const;
  return "success" as const;
}

export default async function ConfirmAlertPage(props: PageProps<"/alerts/confirm">) {
  const { token } = await props.searchParams;
  const result = await confirmAlert(typeof token === "string" ? token : undefined);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {result === "success" || result === "already" ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            ยืนยันการแจ้งเตือนเรียบร้อยแล้ว
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            เราจะส่งอีเมลแจ้งเตือนเมื่อราคาทองถึงเป้าหมายที่คุณตั้งไว้
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            ลิงก์ยืนยันไม่ถูกต้อง
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง กรุณาสมัครรับการแจ้งเตือนใหม่อีกครั้ง
          </p>
        </>
      )}
      <Link href="/" className="mt-2 font-medium text-amber-600 hover:underline dark:text-amber-400">
        กลับไปหน้าราคาทองวันนี้
      </Link>
    </main>
  );
}
