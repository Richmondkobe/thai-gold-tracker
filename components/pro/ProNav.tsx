import Link from "next/link";
import { logoutAction } from "@/app/pro/actions";

const LINKS = [
  { href: "/pro", label: "Pro home" },
  { href: "/pro/backtest", label: "Backtest" },
  { href: "/pro/paper", label: "Paper trading" },
];

/** Links between the private pages, plus the log-out button. */
export function ProNav({ current }: { current: string }) {
  return (
    <nav
      aria-label="Private area"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 pb-3 text-sm dark:border-gray-800"
    >
      {LINKS.map((link) =>
        link.href === current ? (
          <span key={link.href} aria-current="page" className="font-semibold text-gray-900 dark:text-gray-50">
            {link.label}
          </span>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className="text-amber-700 hover:underline dark:text-amber-400"
          >
            {link.label}
          </Link>
        ),
      )}
      <form action={logoutAction} className="ml-auto">
        <button
          type="submit"
          className="text-gray-500 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-50"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
