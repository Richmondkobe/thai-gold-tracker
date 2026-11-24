// Backtest engine for /pro/backtest. Pure functions, no I/O: it is given the
// daily prices and returns the results, so it can be tested on its own.
//
// Rules shared by every strategy:
//   - The account is either all cash or all gold (fractional baht-weight).
//   - Every BUY pays the dealer's SELL price and every SELL receives the
//     dealer's BUY price, so the spread is paid on every round trip.
//   - A signal is read from prices up to and including day t and the order is
//     filled on the NEXT trading day, at that day's price. Filling on the
//     signal's own day would use a price the signal already "knew" about.
//   - The balance on any day is what the account could be cashed out for:
//     cash + gold x the dealer's BUY price.
//   - The first WARMUP_DAYS prices only warm up the averages. Every strategy,
//     buy-and-hold included, starts with the same cash on the same day.

export interface BacktestDay {
  /** "YYYY-MM-DD" (Bangkok calendar date). */
  date: string;
  /** Dealer buys from you at this price (ทองคำแท่ง รับซื้อ). */
  buy: number;
  /** Dealer sells to you at this price (ทองคำแท่ง ขายออก). */
  sell: number;
}

export type StrategyId = "hold" | "ma" | "breakout" | "dip";

export interface BacktestTrade {
  buyDate: string;
  buyPrice: number;
  /** Baht-weight bought. */
  units: number;
  cost: number;
  /** Null while the position is still open at the end of the test. */
  sellDate: string | null;
  sellPrice: number | null;
  /** Sale proceeds; for an open position, its value at the last dealer buy price. */
  value: number;
  profit: number;
}

export interface StrategyResult {
  id: StrategyId;
  finalBalance: number;
  totalReturnPercent: number;
  annualReturnPercent: number;
  /** Round trips started (buys), including one still open at the end. */
  tradeCount: number;
  closedTradeCount: number;
  winCount: number;
  /** Winning closed trades / closed trades; null when no trade has closed. */
  winRatePercent: number | null;
  /** True when the account is holding gold at the end of the test. */
  holdingAtEnd: boolean;
  /** Worst peak-to-trough fall of the balance, as a positive percent. */
  maxDrawdownPercent: number;
  drawdownPeakDate: string;
  drawdownTroughDate: string;
  /** Share of days spent holding gold. */
  daysInGoldPercent: number;
  /**
   * What the spread cost in total: for every buy, the gap between the price
   * paid and what the same gold could be sold back for that day.
   */
  spreadPaid: number;
  /** Balance per day, aligned with BacktestResult.dates. */
  balances: number[];
  trades: BacktestTrade[];
}

export interface BacktestResult {
  startCash: number;
  /** Day the accounts are opened (all cash); the first order fills the next day. */
  startDate: string;
  endDate: string;
  years: number;
  dates: string[];
  strategies: StrategyResult[];
}

export const START_CASH = 100_000;
export const WARMUP_DAYS = 50;
export const FAST_AVERAGE_DAYS = 20;
export const SLOW_AVERAGE_DAYS = 50;
export const BREAKOUT_DAYS = 20;
export const DIP_LOOKBACK_DAYS = 20;
export const DIP_FALL_PERCENT = 3;
export const DIP_RISE_PERCENT = 3;

export const STRATEGY_ORDER: StrategyId[] = ["hold", "ma", "breakout", "dip"];

export const STRATEGY_INFO: Record<StrategyId, { name: string; rule: string }> = {
  hold: {
    name: "Buy and hold",
    rule: "Buy gold on the first day and never sell. This is the comparison: a trading strategy is only worth the effort if it ends with more than this.",
  },
  ma: {
    name: `${FAST_AVERAGE_DAYS}/${SLOW_AVERAGE_DAYS}-day moving average crossover`,
    rule: `Hold gold while the average price of the last ${FAST_AVERAGE_DAYS} days is above the average of the last ${SLOW_AVERAGE_DAYS} days. Sell when it drops below, and stay in cash until it is above again.`,
  },
  breakout: {
    name: `${BREAKOUT_DAYS}-day breakout`,
    rule: `Buy when the price closes above every price of the previous ${BREAKOUT_DAYS} days (a new ${BREAKOUT_DAYS}-day high). Sell when it closes below every price of the previous ${BREAKOUT_DAYS} days (a new ${BREAKOUT_DAYS}-day low).`,
  },
  dip: {
    name: "Buy the dip",
    rule: `Buy when the price is ${DIP_FALL_PERCENT}% or more below its highest price of the last ${DIP_LOOKBACK_DAYS} days. Sell when the price is ${DIP_RISE_PERCENT}% or more above the price paid. There is no stop-loss: after a fall it keeps holding until the price comes back.`,
  },
};

type Signal = "buy" | "sell" | null;

interface SignalContext {
  /** Signal price series: the dealer's SELL price (the headline announced price). */
  price: number[];
  holding: boolean;
  /** Price paid per baht-weight for the open position; 0 when not holding. */
  entryPrice: number;
}

type SignalFn = (i: number, ctx: SignalContext) => Signal;

/** Mean of the `length` values ending at index i (inclusive). */
function average(values: number[], i: number, length: number): number {
  let sum = 0;
  for (let k = i - length + 1; k <= i; k++) sum += values[k];
  return sum / length;
}

function highest(values: number[], from: number, to: number): number {
  let max = -Infinity;
  for (let k = from; k <= to; k++) if (values[k] > max) max = values[k];
  return max;
}

function lowest(values: number[], from: number, to: number): number {
  let min = Infinity;
  for (let k = from; k <= to; k++) if (values[k] < min) min = values[k];
  return min;
}

const SIGNALS: Record<StrategyId, SignalFn> = {
  // Buy once and never sell.
  hold: (_i, { holding }) => (holding ? null : "buy"),

  // Hold gold while the 20-day average is above the 50-day average.
  ma: (i, { price, holding }) => {
    const fast = average(price, i, FAST_AVERAGE_DAYS);
    const slow = average(price, i, SLOW_AVERAGE_DAYS);
    if (!holding && fast > slow) return "buy";
    if (holding && fast < slow) return "sell";
    return null;
  },

  // Buy when today's price is above every price of the previous 20 days;
  // sell when it is below every price of the previous 20 days.
  breakout: (i, { price, holding }) => {
    if (!holding && price[i] > highest(price, i - BREAKOUT_DAYS, i - 1)) return "buy";
    if (holding && price[i] < lowest(price, i - BREAKOUT_DAYS, i - 1)) return "sell";
    return null;
  },

  // Buy when the price is 3% or more below its highest price of the last 20
  // days; sell when it is 3% or more above the price paid. No stop-loss.
  dip: (i, { price, holding, entryPrice }) => {
    if (!holding) {
      const high = highest(price, i - DIP_LOOKBACK_DAYS + 1, i);
      return price[i] <= high * (1 - DIP_FALL_PERCENT / 100) ? "buy" : null;
    }
    return price[i] >= entryPrice * (1 + DIP_RISE_PERCENT / 100) ? "sell" : null;
  },
};

function simulate(id: StrategyId, days: BacktestDay[], startIndex: number): StrategyResult {
  const signal = SIGNALS[id];
  const price = days.map((d) => d.sell);
  const last = days.length - 1;

  let cash = START_CASH;
  let units = 0;
  let open: BacktestTrade | null = null;
  let pending: Signal = null;
  let daysInGold = 0;
  let spreadPaid = 0;

  const trades: BacktestTrade[] = [];
  const balances: number[] = [];

  for (let i = startIndex; i <= last; i++) {
    const day = days[i];

    // Fill the order decided at the previous day's close, at today's prices.
    if (pending === "buy" && units === 0) {
      units = cash / day.sell;
      open = {
        buyDate: day.date,
        buyPrice: day.sell,
        units,
        cost: cash,
        sellDate: null,
        sellPrice: null,
        value: 0,
        profit: 0,
      };
      trades.push(open);
      spreadPaid += units * (day.sell - day.buy);
      cash = 0;
    } else if (pending === "sell" && open) {
      cash = units * day.buy;
      open.sellDate = day.date;
      open.sellPrice = day.buy;
      open.value = cash;
      open.profit = cash - open.cost;
      open = null;
      units = 0;
    }

    balances.push(cash + units * day.buy);
    if (units > 0) daysInGold++;

    pending = signal(i, { price, holding: units > 0, entryPrice: open?.buyPrice ?? 0 });
  }

  // A position still open at the end is valued at the last dealer buy price.
  if (open) {
    open.value = units * days[last].buy;
    open.profit = open.value - open.cost;
  }

  const finalBalance = balances[balances.length - 1];

  let peak = balances[0];
  let peakIndex = 0;
  let maxDrawdown = 0;
  let drawdownPeakIndex = 0;
  let drawdownTroughIndex = 0;
  for (let k = 0; k < balances.length; k++) {
    if (balances[k] > peak) {
      peak = balances[k];
      peakIndex = k;
    }
    const drawdown = (peak - balances[k]) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      drawdownPeakIndex = peakIndex;
      drawdownTroughIndex = k;
    }
  }

  const closed = trades.filter((t) => t.sellDate !== null);
  const winCount = closed.filter((t) => t.profit > 0).length;
  const years = yearsBetween(days[startIndex].date, days[last].date);

  return {
    id,
    finalBalance,
    totalReturnPercent: (finalBalance / START_CASH - 1) * 100,
    annualReturnPercent: years > 0 ? ((finalBalance / START_CASH) ** (1 / years) - 1) * 100 : 0,
    tradeCount: trades.length,
    closedTradeCount: closed.length,
    winCount,
    winRatePercent: closed.length > 0 ? (winCount / closed.length) * 100 : null,
    holdingAtEnd: units > 0,
    maxDrawdownPercent: maxDrawdown * 100,
    drawdownPeakDate: days[startIndex + drawdownPeakIndex].date,
    drawdownTroughDate: days[startIndex + drawdownTroughIndex].date,
    daysInGoldPercent: (daysInGold / balances.length) * 100,
    spreadPaid,
    balances,
    trades,
  };
}

function yearsBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Runs every strategy over `days` (oldest first, one row per trading day).
 * Returns null when there is not enough history to warm up the averages.
 */
export function runBacktest(days: BacktestDay[]): BacktestResult | null {
  if (days.length < WARMUP_DAYS + 2) return null;

  // Accounts open (all cash) at the close of the last warm-up day - the first
  // day the 50-day average exists - so the first orders fill the day after.
  const startIndex = WARMUP_DAYS - 1;
  const last = days.length - 1;

  return {
    startCash: START_CASH,
    startDate: days[startIndex].date,
    endDate: days[last].date,
    years: yearsBetween(days[startIndex].date, days[last].date),
    dates: days.slice(startIndex).map((d) => d.date),
    strategies: STRATEGY_ORDER.map((id) => simulate(id, days, startIndex)),
  };
}
