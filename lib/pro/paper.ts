// Paper trading maths for /pro/paper. Pure functions, no I/O.
//
// The account is never stored: it is worked out from the list of trades
// (paper_trades, migration 0012), starting from PAPER_START_CASH. A buy always
// pays the dealer's SELL price and a sell always receives the dealer's BUY
// price, exactly like the backtest.

export const PAPER_START_CASH = 100_000;

/** Gold is kept to 6 decimals of a baht-weight (matches numeric(14,6)). */
const WEIGHT_SCALE = 1_000_000;

export type PaperSide = "buy" | "sell";

export interface PaperTrade {
  /** 1, 2, 3, ... in the order the trades were made. */
  seq: number;
  side: PaperSide;
  /** Baht-weight of gold bought or sold. */
  bahtWeight: number;
  /** Price per baht-weight used: dealer SELL price for a buy, dealer BUY price for a sell. */
  price: number;
  /** Cash paid (buy) or received (sell). */
  amount: number;
  /** Official announcement time of the price used. */
  priceTime: Date;
  createdAt: Date;
}

/** A trade plus the state of the account right after it. */
export interface PaperTradeRow extends PaperTrade {
  /** Profit or loss banked by this sale (average-cost method); null for a buy. */
  realizedProfit: number | null;
  cashAfter: number;
  positionAfter: number;
}

export interface PaperAccount {
  cash: number;
  /** Baht-weight of gold held. */
  position: number;
  /** What the gold held cost in total. */
  costBasis: number;
  /** Average price paid per baht-weight held; 0 with no position. */
  averageCost: number;
  /** Profit or loss banked by all sales so far. */
  realizedProfit: number;
  rows: PaperTradeRow[];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundWeight(value: number): number {
  return Math.round(value * WEIGHT_SCALE) / WEIGHT_SCALE;
}

/** Replays the trades (in seq order) into the current account. */
export function computeAccount(trades: PaperTrade[]): PaperAccount {
  let cash = PAPER_START_CASH;
  let position = 0;
  let costBasis = 0;
  let realizedProfit = 0;
  const rows: PaperTradeRow[] = [];

  for (const trade of [...trades].sort((a, b) => a.seq - b.seq)) {
    let realized: number | null = null;

    if (trade.side === "buy") {
      cash = roundMoney(cash - trade.amount);
      position = roundWeight(position + trade.bahtWeight);
      costBasis = roundMoney(costBasis + trade.amount);
    } else {
      // Average-cost method: the gold sold carries its share of what was paid.
      const soldShare = position > 0 ? Math.min(1, trade.bahtWeight / position) : 1;
      const costOfSold = roundMoney(costBasis * soldShare);
      realized = roundMoney(trade.amount - costOfSold);
      realizedProfit = roundMoney(realizedProfit + realized);
      cash = roundMoney(cash + trade.amount);
      position = roundWeight(position - trade.bahtWeight);
      costBasis = roundMoney(costBasis - costOfSold);
      if (position <= 0) {
        position = 0;
        costBasis = 0;
      }
    }

    rows.push({ ...trade, realizedProfit: realized, cashAfter: cash, positionAfter: position });
  }

  return {
    cash,
    position,
    costBasis,
    averageCost: position > 0 ? costBasis / position : 0,
    realizedProfit,
    rows,
  };
}

export interface PaperOrder {
  side: PaperSide;
  bahtWeight: number;
  price: number;
  amount: number;
}

export type PaperOrderResult = { ok: true; order: PaperOrder } | { ok: false; error: string };

/**
 * A buy of up to `cashToSpend` at the dealer's SELL price. The weight is
 * rounded DOWN to 6 decimals, so the cost can never be more than asked for.
 */
export function planBuy(account: PaperAccount, cashToSpend: number, sellPrice: number): PaperOrderResult {
  if (!Number.isFinite(cashToSpend) || cashToSpend <= 0) {
    return { ok: false, error: "Enter how much cash to spend." };
  }
  if (!(sellPrice > 0)) return { ok: false, error: "No price is available right now." };
  if (cashToSpend > account.cash + 0.005) {
    return { ok: false, error: "That is more cash than the account has." };
  }

  const spend = Math.min(cashToSpend, account.cash);
  const bahtWeight = Math.floor((spend / sellPrice) * WEIGHT_SCALE + 1e-6) / WEIGHT_SCALE;
  const amount = Math.min(roundMoney(bahtWeight * sellPrice), account.cash);
  if (bahtWeight <= 0 || amount <= 0) {
    return { ok: false, error: "That amount is too small to buy any gold." };
  }
  return { ok: true, order: { side: "buy", bahtWeight, price: sellPrice, amount } };
}

/** A sale of `bahtWeight` at the dealer's BUY price. */
export function planSell(account: PaperAccount, bahtWeight: number, buyPrice: number): PaperOrderResult {
  if (!Number.isFinite(bahtWeight) || bahtWeight <= 0) {
    return { ok: false, error: "Enter how much gold to sell." };
  }
  if (!(buyPrice > 0)) return { ok: false, error: "No price is available right now." };
  if (account.position <= 0) return { ok: false, error: "The account holds no gold to sell." };

  const weight = roundWeight(bahtWeight);
  if (weight > account.position + 1e-9) {
    return { ok: false, error: "That is more gold than the account holds." };
  }
  const amount = roundMoney(weight * buyPrice);
  if (weight <= 0 || amount <= 0) {
    return { ok: false, error: "That amount is too small to sell." };
  }
  return { ok: true, order: { side: "sell", bahtWeight: weight, price: buyPrice, amount } };
}

export interface PaperValuation {
  /** Value of the gold held if sold now at the dealer's BUY price. */
  goldValue: number;
  /** Cash plus gold value: what the account could be cashed out for. */
  totalValue: number;
  /** Gain or loss on the gold still held. */
  unrealizedProfit: number;
  /** Total gain or loss against the starting cash. */
  totalProfit: number;
  totalProfitPercent: number;
}

export function valueAccount(account: PaperAccount, buyPrice: number): PaperValuation {
  const goldValue = roundMoney(account.position * buyPrice);
  const totalValue = roundMoney(account.cash + goldValue);
  const totalProfit = roundMoney(totalValue - PAPER_START_CASH);
  return {
    goldValue,
    totalValue,
    unrealizedProfit: roundMoney(goldValue - account.costBasis),
    totalProfit,
    totalProfitPercent: (totalProfit / PAPER_START_CASH) * 100,
  };
}
