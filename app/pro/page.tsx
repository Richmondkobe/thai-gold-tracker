import Link from "next/link";
import { ProNav } from "@/components/pro/ProNav";
import { requireProSession } from "@/lib/pro/auth";

const CARD_CLASS =
  "block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-amber-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-amber-500";

export default async function ProHomePage() {
  await requireProSession();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <ProNav current="/pro" />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Trading test area</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Private pages for testing gold trading ideas with no real money. Nothing here is linked
        from the public site or shown to search engines.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/pro/backtest" prefetch={false} className={CARD_CLASS}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Backtest</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Four simple strategies replayed over the gold bar prices since 2016, with the dealer
            spread counted on every trade.
          </p>
        </Link>
        <Link href="/pro/paper" prefetch={false} className={CARD_CLASS}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Paper trading</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            A pretend ฿100,000 account. Buy and sell at the latest announced price and keep a
            record of every trade.
          </p>
        </Link>
      </div>
    </main>
  );
}
