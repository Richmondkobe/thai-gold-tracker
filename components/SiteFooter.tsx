import Link from "next/link";
import { TRUST_PAGES } from "@/lib/trust-pages";

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
        <nav aria-label="ข้อมูลเว็บไซต์">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_PAGES.map((p) => (
              <li key={p.slug}>
                <Link
                  href={p.pathTh}
                  className="text-sm text-gray-600 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-400"
                >
                  {p.nameTh}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          ข้อมูลราคาอ้างอิงจากประกาศสมาคมค้าทองคำ (goldtraders.or.th) —
          เว็บไซต์อิสระ ไม่เกี่ยวข้องกับสมาคมฯ
        </p>
      </div>
    </footer>
  );
}
