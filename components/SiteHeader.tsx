import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const NAV_LINKS = [
  { href: "/gold-ornament-price", label: "ราคาทองรูปพรรณ" },
  { href: "/history", label: "ราคาทองย้อนหลัง" },
  { href: "/gold-price-chart", label: "กราฟราคาทอง" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <nav className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="font-bold text-gray-900 dark:text-gray-50">
          {SITE_NAME}
        </Link>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-gray-600 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-400"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
