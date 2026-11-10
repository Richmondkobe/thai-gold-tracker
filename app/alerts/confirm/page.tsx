import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "ยืนยันการแจ้งเตือนราคาทอง",
  robots: { index: false },
};

type ConfirmResult =
  | { status: "invalid" }
  | { status: "success" | "already"; alertType: "target" | "every_change" };

// Works the same for both alert types - confirmation is purely token-based;
// alert_type is only read to word the success message correctly.
async function confirmAlert(token: string | undefined): Promise<ConfirmResult> {
  if (!token) return { status: "invalid" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, confirmed, alert_type")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return { status: "invalid" };

  const alertType = data.alert_type === "every_change" ? "every_change" : "target";
  if (data.confirmed) return { status: "already", alertType };

  const { error: updateError } = await supabase
    .from("price_alerts")
    .update({ confirmed: true })
    .eq("id", data.id);

  if (updateError) return { status: "invalid" };
  return { status: "success", alertType };
}

export default async function ConfirmAlertPage(props: PageProps<"/alerts/confirm">) {
  const { token } = await props.searchParams;
  const result = await confirmAlert(typeof token === "string" ? token : undefined);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {result.status !== "invalid" ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            ยืนยันการแจ้งเตือนเรียบร้อยแล้ว
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {result.alertType === "every_change"
              ? "เราจะส่งอีเมลแจ้งเตือนทุกครั้งที่สมาคมค้าทองคำประกาศราคาทองใหม่ คุณยกเลิกได้ทุกเมื่อจากลิงก์ท้ายอีเมล"
              : "เราจะส่งอีเมลแจ้งเตือนเมื่อราคาทองถึงเป้าหมายที่คุณตั้งไว้"}
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
