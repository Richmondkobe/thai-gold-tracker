import Link from "next/link";
import { PaperResetForm, PaperTradeForms } from "@/components/pro/PaperTradeForms";
import { ProNav } from "@/components/pro/ProNav";
import { getLatestPrices } from "@/lib/gold-price-queries";
import { requireProSession } from "@/lib/pro/auth";
import {
  formatBaht,
  formatBahtWhole,
  formatDateTime,
  formatSignedBaht,
  formatSignedPercent,
  formatWeight,
} from "@/lib/pro/format";
import { PAPER_START_CASH, computeAccount, valueAccount } from "@/lib/pro/paper";
import { listPaperTrades } from "@/lib/pro/paper-store";

const CARD_CLASS =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const H2_CLASS = "text-lg font-bold text-gray-900 dark:text-gray-50";
const NOTE_CLASS = "text-sm text-gray-600 dark:text-gray-400";
const TH_CLASS = "px-2 py-2 text-left font-medium first:pl-0 last:pr-0";
const TD_CLASS = "px-2 py-2 tabular-nums first:pl-0 last:pr-0";
const UP_CLASS = "text-emerald-700 dark:text-emerald-400";
const DOWN_CLASS = "text-red-600 dark:text-red-400";

function signClass(value: number): string {
  if (value === 0) return "text-gray-900 dark:text-gray-50";
  return value > 0 ? UP_CLASS : DOWN_CLASS;
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50">{value}</dd>
      {note && <dd className="text-xs text-gray-500 dark:text-gray-400">{note}</dd>}
    </div>
  );
}

export default async function PaperTradingPage() {
  await requireProSession();

  const [[latest], stored] = await Promise.all([getLatestPrices(1), listPaperTrades()]);

  if (stored.status === "missing-table") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <ProNav current="/pro/paper" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Paper trading</h1>
        <section className={CARD_CLASS}>
          <h2 className={H2_CLASS}>One step left: create the table</h2>
          <p className={`mt-2 ${NOTE_CLASS}`}>
            The <code>paper_trades</code> table does not exist yet. Run the SQL in{" "}
            <code>supabase/migrations/0012_paper_trades.sql</code> in the Supabase SQL editor, then
            reload this page.
          </p>
        </section>
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <ProNav current="/pro/paper" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Paper trading</h1>
        <p className={NOTE_CLASS}>No gold price is available right now.</p>
      </main>
    );
  }

  const account = computeAccount(stored.trades);
  const valuation = valueAccount(account, latest.barBuy);
  const history = [...account.rows].reverse();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <ProNav current="/pro/paper" />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Paper trading</h1>
        <p className={`mt-2 ${NOTE_CLASS}`}>
          A pretend account that started with {formatBahtWhole(PAPER_START_CASH)}. No real money
          and no real orders. It trades 96.5% gold bars at the latest price announced by the Gold
          Traders Association.
        </p>
      </header>

      <section aria-labelledby="price-heading" className={CARD_CLASS}>
        <h2 id="price-heading" className={H2_CLASS}>
          Latest announced price
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <Stat
            label="You buy at (dealer's selling price)"
            value={<span className="text-xl">{formatBahtWhole(latest.barSell)}</span>}
          />
          <Stat
            label="You sell at (dealer's buying price)"
            value={<span className="text-xl">{formatBahtWhole(latest.barBuy)}</span>}
          />
        </dl>
        <p className={`mt-3 ${NOTE_CLASS}`}>
          Per baht-weight. Announced {formatDateTime(latest.announcedAt)} Bangkok time. The spread
          is {formatBahtWhole(latest.barSell - latest.barBuy)}.{" "}
          <Link href="/pro/paper" prefetch={false} className="text-amber-700 hover:underline dark:text-amber-400">
            Check for a newer price
          </Link>
        </p>
      </section>

      <section aria-labelledby="account-heading" className={CARD_CLASS}>
        <h2 id="account-heading" className={H2_CLASS}>
          Account
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Stat
            label="Balance"
            value={<span className="text-xl">{formatBaht(valuation.totalValue)}</span>}
            note="Cash plus gold, if sold now"
          />
          <Stat
            label="Total profit / loss"
            value={
              <span className={`text-xl ${signClass(valuation.totalProfit)}`}>
                {formatSignedBaht(valuation.totalProfit)}
              </span>
            }
            note={`${formatSignedPercent(valuation.totalProfitPercent, 2)} since the start`}
          />
          <Stat label="Cash" value={formatBaht(account.cash)} />
          <Stat
            label="Open position"
            value={
              account.position > 0 ? `${formatWeight(account.position)} baht-weight` : "None"
            }
            note={
              account.position > 0
                ? `Worth ${formatBaht(valuation.goldValue)} if sold now`
                : "The account holds no gold"
            }
          />
          <Stat
            label="Profit / loss on open position"
            value={
              account.position > 0 ? (
                <span className={signClass(valuation.unrealizedProfit)}>
                  {formatSignedBaht(valuation.unrealizedProfit)}
                </span>
              ) : (
                "-"
              )
            }
            note={
              account.position > 0
                ? `Average price paid ${formatBaht(account.averageCost)}`
                : undefined
            }
          />
          <Stat
            label="Profit / loss from finished sales"
            value={
              <span className={signClass(account.realizedProfit)}>
                {formatSignedBaht(account.realizedProfit)}
              </span>
            }
          />
        </dl>
      </section>

      <section aria-labelledby="trade-heading" className={CARD_CLASS}>
        <h2 id="trade-heading" className={`mb-3 ${H2_CLASS}`}>
          Trade
        </h2>
        <PaperTradeForms
          cash={account.cash}
          position={account.position}
          buyPrice={latest.barBuy}
          sellPrice={latest.barSell}
          quotedAt={latest.fetchedAt.toISOString()}
        />
      </section>

      <section aria-labelledby="history-heading" className={CARD_CLASS}>
        <h2 id="history-heading" className={H2_CLASS}>
          Trade history
        </h2>
        {history.length === 0 ? (
          <p className={`mt-2 ${NOTE_CLASS}`}>No trades yet.</p>
        ) : (
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-xs sm:text-sm">
              <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <tr>
                  <th scope="col" className={TH_CLASS}>#</th>
                  <th scope="col" className={TH_CLASS}>Time (Bangkok)</th>
                  <th scope="col" className={TH_CLASS}>Side</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>Baht-weight</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>Price</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>Cash</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>Profit / loss</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>Cash after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-300">
                {history.map((row) => (
                  <tr key={row.seq}>
                    <td className={TD_CLASS}>{row.seq}</td>
                    <td className={TD_CLASS}>{formatDateTime(row.createdAt)}</td>
                    <td className={`${TD_CLASS} font-medium text-gray-900 dark:text-gray-50`}>
                      {row.side === "buy" ? "Buy" : "Sell"}
                    </td>
                    <td className={`${TD_CLASS} text-right`}>{formatWeight(row.bahtWeight)}</td>
                    <td className={`${TD_CLASS} text-right`}>{formatBahtWhole(row.price)}</td>
                    <td className={`${TD_CLASS} text-right`}>
                      {row.side === "buy" ? "-" : "+"}
                      {formatBaht(row.amount)}
                    </td>
                    <td
                      className={`${TD_CLASS} text-right ${
                        row.realizedProfit === null ? "" : signClass(row.realizedProfit)
                      }`}
                    >
                      {row.realizedProfit === null ? "-" : formatSignedBaht(row.realizedProfit)}
                    </td>
                    <td className={`${TD_CLASS} text-right`}>{formatBaht(row.cashAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="reset-heading" className={CARD_CLASS}>
        <h2 id="reset-heading" className={H2_CLASS}>
          Start again
        </h2>
        <PaperResetForm />
      </section>
    </main>
  );
}
