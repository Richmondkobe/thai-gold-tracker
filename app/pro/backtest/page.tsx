import { BalanceChart, type ChartColor, type ChartSeries } from "@/components/pro/BalanceChart";
import { ProNav } from "@/components/pro/ProNav";
import { getDailyHistory } from "@/lib/gold-price-queries";
import { requireProSession } from "@/lib/pro/auth";
import {
  STRATEGY_INFO,
  WARMUP_DAYS,
  runBacktest,
  type BacktestResult,
  type StrategyId,
  type StrategyResult,
} from "@/lib/pro/backtest";
import {
  formatBaht,
  formatBahtWhole,
  formatDateString,
  formatSignedBaht,
  formatSignedPercent,
  formatWeight,
} from "@/lib/pro/format";

const CARD_CLASS =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const H2_CLASS = "text-lg font-bold text-gray-900 dark:text-gray-50";
const NOTE_CLASS = "text-sm text-gray-600 dark:text-gray-400";
const TH_CLASS = "px-2 py-2 text-left font-medium first:pl-0 last:pr-0";
const TD_CLASS = "px-2 py-2 tabular-nums first:pl-0 last:pr-0";
const UP_CLASS = "text-emerald-700 dark:text-emerald-400";
const DOWN_CLASS = "text-red-600 dark:text-red-400";

// One colour per strategy, the same in every chart on the page.
const STRATEGY_COLOR: Record<StrategyId, ChartColor> = {
  hold: "blue",
  ma: "orange",
  breakout: "aqua",
  dip: "yellow",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Indexes of the last day of each week (plus the first day) - enough points for a 10-year line. */
function weeklyIndexes(dates: string[]): number[] {
  const lastOfWeek = new Map<number, number>();
  dates.forEach((date, i) => {
    lastOfWeek.set(Math.floor(new Date(`${date}T00:00:00Z`).getTime() / WEEK_MS), i);
  });
  return [...new Set([0, ...lastOfWeek.values()])].sort((a, b) => a - b);
}

function signClass(value: number): string {
  return value >= 0 ? UP_CLASS : DOWN_CLASS;
}

function winRateText(s: StrategyResult): string {
  if (s.winRatePercent === null) return "n/a";
  return `${s.winRatePercent.toFixed(0)}% (${s.winCount} of ${s.closedTradeCount})`;
}

function tradeCountText(s: StrategyResult): string {
  if (!s.holdingAtEnd) return String(s.tradeCount);
  return s.tradeCount === 1 ? "1 (still open)" : `${s.tradeCount} (1 still open)`;
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

function Summary({ result }: { result: BacktestResult }) {
  const hold = result.strategies.find((s) => s.id === "hold")!;
  const others = result.strategies.filter((s) => s.id !== "hold");
  const winners = others.filter((s) => s.finalBalance > hold.finalBalance);

  let headline: string;
  if (winners.length === 0) {
    headline = `None of the ${others.length} trading strategies beat buy and hold after the spread.`;
  } else if (winners.length === others.length) {
    headline = `All ${others.length} trading strategies beat buy and hold after the spread.`;
  } else {
    const names = winners.map((s) => STRATEGY_INFO[s.id].name).join(" and ");
    headline = `${winners.length} of the ${others.length} trading strategies beat buy and hold after the spread: ${names}.`;
  }

  return (
    <section aria-labelledby="summary-heading" className={CARD_CLASS}>
      <h2 id="summary-heading" className={H2_CLASS}>
        Summary
      </h2>
      <p className="mt-2 font-semibold text-gray-900 dark:text-gray-50">{headline}</p>
      <p className={`mt-2 ${NOTE_CLASS}`}>
        Buy and hold turned {formatBahtWhole(result.startCash)} into{" "}
        {formatBahtWhole(hold.finalBalance)} ({formatSignedPercent(hold.totalReturnPercent)}). Its
        worst fall along the way was {hold.maxDrawdownPercent.toFixed(1)}%.
      </p>
      <ul className="mt-3 flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
        {others.map((s) => {
          const gap = s.finalBalance - hold.finalBalance;
          const beat = gap > 0;
          return (
            <li key={s.id}>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                {STRATEGY_INFO[s.id].name}:
              </span>{" "}
              <span className={beat ? UP_CLASS : DOWN_CLASS}>
                {beat ? "beat buy and hold" : "did not beat buy and hold"}
              </span>
              . It ended with {formatBahtWhole(s.finalBalance)} (
              {formatSignedPercent(s.totalReturnPercent)}), which is{" "}
              {formatBahtWhole(Math.abs(gap))} {beat ? "more" : "less"}. It made {s.tradeCount}{" "}
              {s.tradeCount === 1 ? "trade" : "trades"} and paid about{" "}
              {formatBahtWhole(s.spreadPaid)} in spread. Its worst fall was{" "}
              {s.maxDrawdownPercent.toFixed(1)}%,{" "}
              {s.maxDrawdownPercent < hold.maxDrawdownPercent ? "smaller" : "larger"} than buy and
              hold&apos;s {hold.maxDrawdownPercent.toFixed(1)}%.
            </li>
          );
        })}
      </ul>
      <p className={`mt-3 ${NOTE_CLASS}`}>
        This is a replay of past prices. It shows what would have happened, not what will happen,
        and it is not advice.
      </p>
    </section>
  );
}

function TradeList({ strategy }: { strategy: StrategyResult }) {
  if (strategy.trades.length === 0) return null;
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-400">
        Show all {strategy.trades.length} {strategy.trades.length === 1 ? "trade" : "trades"}
      </summary>
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-xs sm:text-sm">
          <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th scope="col" className={TH_CLASS}>Bought</th>
              <th scope="col" className={`${TH_CLASS} text-right`}>Price paid</th>
              <th scope="col" className={`${TH_CLASS} text-right`}>Baht-weight</th>
              <th scope="col" className={TH_CLASS}>Sold</th>
              <th scope="col" className={`${TH_CLASS} text-right`}>Price received</th>
              <th scope="col" className={`${TH_CLASS} text-right`}>Profit / loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-300">
            {strategy.trades.map((t) => (
              <tr key={t.buyDate}>
                <td className={TD_CLASS}>{formatDateString(t.buyDate)}</td>
                <td className={`${TD_CLASS} text-right`}>{formatBahtWhole(t.buyPrice)}</td>
                <td className={`${TD_CLASS} text-right`}>{formatWeight(t.units)}</td>
                <td className={TD_CLASS}>
                  {t.sellDate ? formatDateString(t.sellDate) : "Still open"}
                </td>
                <td className={`${TD_CLASS} text-right`}>
                  {t.sellPrice !== null ? formatBahtWhole(t.sellPrice) : "-"}
                </td>
                <td className={`${TD_CLASS} text-right ${signClass(t.profit)}`}>
                  {formatSignedBaht(t.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default async function BacktestPage() {
  await requireProSession();

  // Every daily close on record (history starts 2016-01-02), oldest first.
  const daily = await getDailyHistory(36_500);
  const result = runBacktest(
    daily
      .filter((row) => row.priceDate >= "2016-01-01")
      .map((row) => ({ date: row.priceDate, buy: row.barBuy, sell: row.barSell })),
  );

  if (!result) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <ProNav current="/pro/backtest" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Backtest</h1>
        <p className={NOTE_CLASS}>There is not enough price history to run the backtest.</p>
      </main>
    );
  }

  const hold = result.strategies.find((s) => s.id === "hold")!;
  const indexes = weeklyIndexes(result.dates);
  const chartDates = indexes.map((i) => result.dates[i]);
  const toSeries = (s: StrategyResult): ChartSeries => ({
    name: STRATEGY_INFO[s.id].name,
    color: STRATEGY_COLOR[s.id],
    values: indexes.map((i) => Math.round(s.balances[i])),
  });
  const holdSeries = toSeries(hold);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <ProNav current="/pro/backtest" />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Backtest: gold bar strategies, 2016 to today
        </h1>
        <p className={`mt-2 ${NOTE_CLASS}`}>
          96.5% gold bar prices from the Gold Traders Association, {result.dates.length.toLocaleString("en-US")}{" "}
          trading days from {formatDateString(result.startDate)} to{" "}
          {formatDateString(result.endDate)} ({result.years.toFixed(1)} years). Each strategy starts
          with {formatBahtWhole(result.startCash)}. Every purchase pays the dealer&apos;s selling
          price and every sale gets the dealer&apos;s buying price, so the spread is always counted.
        </p>
      </header>

      <Summary result={result} />

      <section aria-labelledby="compare-heading" className={CARD_CLASS}>
        <h2 id="compare-heading" className={H2_CLASS}>
          Account balance, all four strategies
        </h2>
        <p className={`mb-4 mt-1 ${NOTE_CLASS}`}>
          What each account could be cashed out for, week by week. Move over the chart to read
          the values.
        </p>
        <BalanceChart
          dates={chartDates}
          series={result.strategies.map(toSeries)}
          label={`Account balance of the four strategies from ${formatDateString(result.startDate)} to ${formatDateString(result.endDate)}. Final balances: ${result.strategies
            .map((s) => `${STRATEGY_INFO[s.id].name} ${formatBahtWhole(s.finalBalance)}`)
            .join(", ")}.`}
        />

        <div className="relative mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-xs sm:text-sm">
            <caption className="sr-only">Results of each strategy</caption>
            <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className={TH_CLASS}>Strategy</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Final balance</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Total return</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Trades</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Win rate</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Worst drawdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-300">
              {result.strategies.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className={`${TD_CLASS} text-left font-medium text-gray-900 dark:text-gray-50`}>
                    {STRATEGY_INFO[s.id].name}
                  </th>
                  <td className={`${TD_CLASS} text-right`}>{formatBahtWhole(s.finalBalance)}</td>
                  <td className={`${TD_CLASS} text-right ${signClass(s.totalReturnPercent)}`}>
                    {formatSignedPercent(s.totalReturnPercent)}
                  </td>
                  <td className={`${TD_CLASS} text-right`}>{s.tradeCount}</td>
                  <td className={`${TD_CLASS} text-right`}>
                    {s.winRatePercent === null ? "n/a" : `${s.winRatePercent.toFixed(0)}%`}
                  </td>
                  <td className={`${TD_CLASS} text-right`}>-{s.maxDrawdownPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {result.strategies.map((s) => {
        const info = STRATEGY_INFO[s.id];
        const isHold = s.id === "hold";
        return (
          <section key={s.id} aria-labelledby={`${s.id}-heading`} className={CARD_CLASS}>
            <h2 id={`${s.id}-heading`} className={H2_CLASS}>
              {info.name}
            </h2>
            <p className={`mt-1 ${NOTE_CLASS}`}>{info.rule}</p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Stat
                label="Final balance"
                value={formatBaht(s.finalBalance)}
                note={
                  isHold
                    ? undefined
                    : `${formatSignedBaht(s.finalBalance - hold.finalBalance)} vs buy and hold`
                }
              />
              <Stat
                label="Total return"
                value={
                  <span className={signClass(s.totalReturnPercent)}>
                    {formatSignedPercent(s.totalReturnPercent)}
                  </span>
                }
                note={`${formatSignedPercent(s.annualReturnPercent)} a year on average`}
              />
              <Stat
                label="Number of trades"
                value={tradeCountText(s)}
                note={`About ${formatBahtWhole(s.spreadPaid)} paid in spread`}
              />
              <Stat
                label="Win rate"
                value={winRateText(s)}
                note={
                  s.winRatePercent === null
                    ? "No trade has been closed yet"
                    : "Closed trades that made money"
                }
              />
              <Stat
                label="Worst drawdown"
                value={`-${s.maxDrawdownPercent.toFixed(1)}%`}
                note={
                  s.maxDrawdownPercent > 0
                    ? `${formatDateString(s.drawdownPeakDate)} to ${formatDateString(s.drawdownTroughDate)}`
                    : undefined
                }
              />
              <Stat
                label="Time holding gold"
                value={`${s.daysInGoldPercent.toFixed(0)}%`}
                note="The rest of the time in cash"
              />
            </dl>

            <h3 className="mb-3 mt-5 text-sm font-semibold text-gray-900 dark:text-gray-50">
              Account balance{isHold ? "" : ", next to buy and hold"}
            </h3>
            <BalanceChart
              dates={chartDates}
              series={isHold ? [holdSeries] : [toSeries(s), holdSeries]}
              label={`Account balance of ${info.name}: from ${formatBahtWhole(result.startCash)} on ${formatDateString(result.startDate)} to ${formatBahtWhole(s.finalBalance)} on ${formatDateString(result.endDate)}.`}
            />

            <TradeList strategy={s} />
          </section>
        );
      })}

      <section aria-labelledby="method-heading" className={CARD_CLASS}>
        <h2 id="method-heading" className={H2_CLASS}>
          How the test works, and its limits
        </h2>
        <ul className={`mt-2 flex list-disc flex-col gap-2 pl-5 ${NOTE_CLASS}`}>
          <li>
            It uses one price per day: the last price announced that day. A signal is read after
            that last price, and the order is filled at the next trading day&apos;s last price. It
            never trades at a price it has already seen.
          </li>
          <li>
            The account is always all cash or all gold. Parts of a baht-weight are allowed, so the
            whole balance is used on each purchase.
          </li>
          <li>
            The balance on any day is what the gold could be sold for at the dealer&apos;s buying
            price, plus any cash. A position still open today is valued the same way.
          </li>
          <li>
            The first {WARMUP_DAYS} trading days of 2016 are only used to work out the averages.
            All four accounts open on {formatDateString(result.startDate)}, so they are compared
            over exactly the same period.
          </li>
          <li>
            Win rate counts closed trades only. A trade wins if it brought back more cash than it
            cost, after the spread.
          </li>
          <li>
            Worst drawdown is the biggest fall of the balance from a high point to a later low
            point.
          </li>
          <li>
            Not included: interest on cash, extra charges a shop may add for small bars, and the
            fact that a real order cannot always be filled at the announced price.
          </li>
          <li>
            Today&apos;s row uses the latest price so far, so the last numbers can move during the
            day.
          </li>
        </ul>
      </section>
    </main>
  );
}
