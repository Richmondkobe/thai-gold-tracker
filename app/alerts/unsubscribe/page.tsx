import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "ยกเลิกการแจ้งเตือนราคาทอง",
  robots: { index: false },
};

async function unsubscribe(token: string) {
  "use server";
  const supabase = createAdminClient();
  await supabase.from("price_alerts").delete().eq("token", token);
  redirect(`/alerts/unsubscribe?done=1`);
}

export default async function UnsubscribeAlertPage(props: PageProps<"/alerts/unsubscribe">) {
  const { token, done } = await props.searchParams;
  const validToken = typeof token === "string" ? token : undefined;

  if (done === "1") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          ยกเลิกการแจ้งเตือนเรียบร้อยแล้ว
        </h1>
        <p className="text-gray-600 dark:text-gray-400">คุณจะไม่ได้รับอีเมลแจ้งเตือนราคาทองอีกต่อไป</p>
        <Link href="/" className="mt-2 font-medium text-amber-600 hover:underline dark:text-amber-400">
          กลับไปหน้าราคาทองวันนี้
        </Link>
      </main>
    );
  }

  if (!validToken) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          ลิงก์ไม่ถูกต้อง
        </h1>
        <Link href="/" className="font-medium text-amber-600 hover:underline dark:text-amber-400">
          กลับไปหน้าราคาทองวันนี้
        </Link>
      </main>
    );
  }

  const unsubscribeWithToken = unsubscribe.bind(null, validToken);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        ยกเลิกการแจ้งเตือนราคาทอง
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        คุณต้องการยกเลิกการรับการแจ้งเตือนราคาทองใช่หรือไม่
      </p>
      <form action={unsubscribeWithToken}>
        <SubmitButton />
      </form>
      <Link href="/" className="mt-2 font-medium text-amber-600 hover:underline dark:text-amber-400">
        กลับไปหน้าราคาทองวันนี้
      </Link>
    </main>
  );
}

function SubmitButton() {
  return (
    <button
      type="submit"
      className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
    >
      ยืนยันการยกเลิก
    </button>
  );
}
